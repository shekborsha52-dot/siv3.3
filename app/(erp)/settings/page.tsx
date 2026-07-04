'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/hooks/use-toast';
import { Settings, User, Bell, Shield, Palette, Building2, Save, Database, RefreshCw, Trash2 } from 'lucide-react';

type SettingsTab = 'general' | 'profile' | 'notifications' | 'security' | 'appearance' | 'data';

interface CompanySettings {
  name: string;
  license: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  dateFormat: string;
  logo_url: string;
}

interface NotificationSettings {
  lowStock: boolean;
  newOrders: boolean;
  paymentReceived: boolean;
  overdueInvoices: boolean;
  deliveryUpdates: boolean;
  poApprovals: boolean;
}

interface AppearanceSettings {
  darkMode: boolean;
  theme: string;
  interface: string;
}

interface ProfileData {
  full_name: string;
  email: string;
  phone: string;
  role: string;
}

const themes = ['#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings state
  const [company, setCompany] = useState<CompanySettings>({
    name: 'SI Building Solutions',
    license: '',
    phone: '',
    email: '',
    address: '',
    currency: 'BDT',
    dateFormat: 'DD/MM/YYYY',
    logo_url: '',
  });
  const [notifications, setNotifications] = useState<NotificationSettings>({
    lowStock: true,
    newOrders: true,
    paymentReceived: true,
    overdueInvoices: false,
    deliveryUpdates: true,
    poApprovals: true,
  });
  const [appearance, setAppearance] = useState<AppearanceSettings>({
    darkMode: false,
    theme: '#2563eb',
    interface: 'desktop',
  });
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '',
    email: '',
    phone: '',
    role: 'manager',
  });

  // Password state
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);

    const [companyRes, notifRes, appearRes, profileRes] = await Promise.all([
      supabase.from('app_settings').select('*').eq('setting_key', 'company').single(),
      supabase.from('app_settings').select('*').eq('setting_key', 'notifications').single(),
      supabase.from('app_settings').select('*').eq('setting_key', 'appearance').single(),
      supabase.from('profiles').select('*').limit(1).single(),
    ]);

    if (companyRes.data?.setting_value) {
      setCompany({ ...company, ...companyRes.data.setting_value as CompanySettings });
    }
    if (notifRes.data?.setting_value) {
      setNotifications({ ...notifications, ...notifRes.data.setting_value as NotificationSettings });
    }
    if (appearRes.data?.setting_value) {
      setAppearance({ ...appearance, ...appearRes.data.setting_value as AppearanceSettings });
    }
    if (profileRes.data) {
      setProfile({
        full_name: profileRes.data.full_name,
        email: profileRes.data.email,
        phone: profileRes.data.phone || '',
        role: profileRes.data.role,
      });
    }

    setLoading(false);
  }

  async function saveSettings(settingsKey: string, settingsValue: object) {
    setSaving(true);

    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { setting_key: settingsKey, setting_value: settingsValue, updated_at: new Date().toISOString() },
        { onConflict: 'setting_key' }
      );

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Settings saved successfully' });
    }

    setSaving(false);
  }

  async function saveProfile() {
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: profile.full_name,
        phone: profile.phone,
        updated_at: new Date().toISOString(),
      })
      .eq('email', profile.email);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Profile updated successfully' });
    }

    setSaving(false);
  }

  async function changePassword() {
    if (passwords.new !== passwords.confirm) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }
    if (passwords.new.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password: passwords.new,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Password updated successfully' });
      setPasswords({ current: '', new: '', confirm: '' });
    }

    setSaving(false);
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'data', label: 'Data', icon: Database },
  ];

  const roleLabels: Record<string, string> = {
    super_admin: 'Super Admin',
    manager: 'Manager',
    sales_executive: 'Sales Executive',
    inventory_manager: 'Inventory Manager',
    accountant: 'Accountant',
    delivery_staff: 'Delivery Staff',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Configure your ERP system preferences</p>
      </div>

      {/* Mobile: horizontal scroll tabs | Desktop: sidebar + content */}
      <div className="lg:flex lg:gap-5">
        {/* Sidebar (desktop) / Tab bar (mobile) */}
        <div className="lg:w-48 lg:shrink-0">
          {/* Mobile horizontal scrollable tabs */}
          <div className="flex lg:hidden overflow-x-auto gap-1 pb-2 -mx-1 px-1 scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm whitespace-nowrap shrink-0 transition font-medium ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
          {/* Desktop vertical nav */}
          <nav className="hidden lg:block space-y-0.5">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as SettingsTab)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-600 font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 bg-white rounded-xl border border-border shadow-sm mt-3 lg:mt-0">
          {activeTab === 'general' && (
            <div>
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-base font-bold">General Settings</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Configure your business information</p>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center">
                    <Building2 className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{company.name}</h3>
                    <p className="text-xs text-muted-foreground">Construction Materials & Home Improvement</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Company Name</label>
                    <input
                      value={company.name}
                      onChange={e => setCompany({ ...company, name: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Trade License #</label>
                    <input
                      value={company.license}
                      onChange={e => setCompany({ ...company, license: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Phone</label>
                    <input
                      value={company.phone}
                      onChange={e => setCompany({ ...company, phone: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Email</label>
                    <input
                      value={company.email}
                      onChange={e => setCompany({ ...company, email: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium mb-1">Address</label>
                    <input
                      value={company.address}
                      onChange={e => setCompany({ ...company, address: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium mb-1">Company Logo URL</label>
                    <input
                      value={company.logo_url}
                      onChange={e => setCompany({ ...company, logo_url: e.target.value })}
                      placeholder="https://example.com/logo.png"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    {company.logo_url && (
                      <div className="mt-2 flex items-center gap-3">
                        <img src={company.logo_url} alt="Logo preview" className="h-10 w-10 object-contain rounded border border-border" />
                        <p className="text-xs text-muted-foreground">Logo preview</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Currency</label>
                    <select
                      value={company.currency}
                      onChange={e => setCompany({ ...company, currency: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                    >
                      <option value="BDT">BDT - Bangladeshi Taka</option>
                      <option value="USD">USD - US Dollar</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Date Format</label>
                    <select
                      value={company.dateFormat}
                      onChange={e => setCompany({ ...company, dateFormat: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none"
                    >
                      <option>DD/MM/YYYY</option>
                      <option>MM/DD/YYYY</option>
                      <option>YYYY-MM-DD</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div>
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-base font-bold">Appearance</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Customize the look and feel</p>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Dark Mode</p>
                    <p className="text-xs text-muted-foreground">Switch to dark interface theme</p>
                  </div>
                  <button
                    onClick={() => setAppearance({ ...appearance, darkMode: !appearance.darkMode })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${appearance.darkMode ? 'bg-blue-600' : 'bg-muted'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${appearance.darkMode ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                </div>
                <div>
                  <p className="text-sm font-medium mb-3">Interface Mode</p>
                  <div className="grid grid-cols-2 gap-3">
                    {['desktop', 'mobile'].map(mode => (
                      <button
                        key={mode}
                        onClick={() => setAppearance({ ...appearance, interface: mode })}
                        className={`p-4 rounded-xl border-2 text-center text-sm font-medium transition capitalize ${appearance.interface === mode ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-border text-muted-foreground hover:border-blue-300'}`}
                      >
                        {mode} ERP
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-3">Color Theme</p>
                  <div className="flex gap-2">
                    {themes.map(color => (
                      <button
                        key={color}
                        onClick={() => setAppearance({ ...appearance, theme: color })}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${appearance.theme === color ? 'border-slate-900 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-base font-bold">Security</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Manage account security settings</p>
              </div>
              <div className="p-6 space-y-5">
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
                  <Shield className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold text-green-700">Your account is secure</p>
                    <p className="text-xs text-green-600">RBAC is active for all users</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-3">Change Password</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">New Password</label>
                      <input
                        type="password"
                        value={passwords.new}
                        onChange={e => setPasswords({ ...passwords, new: e.target.value })}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Confirm Password</label>
                      <input
                        type="password"
                        value={passwords.confirm}
                        onChange={e => setPasswords({ ...passwords, confirm: e.target.value })}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <button
                      onClick={changePassword}
                      disabled={saving || !passwords.new || !passwords.confirm}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60"
                    >
                      Update Password
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-base font-bold">Notifications</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Configure alert preferences</p>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { key: 'lowStock', label: 'Low stock alerts', desc: 'Get notified when products reach minimum stock level' },
                  { key: 'newOrders', label: 'New orders', desc: 'Alert for new online store orders' },
                  { key: 'paymentReceived', label: 'Payment received', desc: 'Notify when customer payment is recorded' },
                  { key: 'overdueInvoices', label: 'Overdue invoices', desc: 'Daily digest of overdue invoices' },
                  { key: 'deliveryUpdates', label: 'Delivery updates', desc: 'Status changes for deliveries' },
                  { key: 'poApprovals', label: 'Purchase order approvals', desc: 'Notify managers for PO approval' },
                ].map(n => (
                  <div key={n.key} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{n.label}</p>
                      <p className="text-xs text-muted-foreground">{n.desc}</p>
                    </div>
                    <button
                      onClick={() => setNotifications({ ...notifications, [n.key]: !notifications[n.key as keyof NotificationSettings] })}
                      className={`relative w-10 h-5 rounded-full transition-colors ${notifications[n.key as keyof NotificationSettings] ? 'bg-blue-600' : 'bg-muted'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${notifications[n.key as keyof NotificationSettings] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div>
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-base font-bold">My Profile</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                    {profile.full_name?.[0]?.toUpperCase() || 'A'}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">JPG, PNG. Max 2MB</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">Full Name</label>
                    <input
                      value={profile.full_name}
                      onChange={e => setProfile({ ...profile, full_name: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Phone</label>
                    <input
                      value={profile.phone}
                      onChange={e => setProfile({ ...profile, phone: e.target.value })}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Email</label>
                    <input
                      value={profile.email}
                      readOnly
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/30 text-muted-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Role</label>
                    <input
                      value={roleLabels[profile.role] || profile.role}
                      readOnly
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-muted/30 text-muted-foreground"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div>
              <div className="px-6 py-4 border-b border-border">
                <h2 className="text-base font-bold">Data Management</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Manage seed data and reset options</p>
              </div>
              <div className="p-6 space-y-5">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm font-semibold text-amber-700">Warning</p>
                  <p className="text-xs text-amber-600 mt-1">These actions are irreversible. Please backup your data before proceeding.</p>
                </div>

                <div className="border border-border rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Reset Seed Data</p>
                      <p className="text-xs text-muted-foreground">Remove all sample/demo data and start fresh</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('Are you sure you want to remove ALL seed data? This will delete sample products, customers, and transactions.')) return;
                        setSaving(true);

                        const tables = [
                          'invoice_items', 'payments', 'invoices', 'quotations',
                          'stock_movements', 'inventory_items', 'purchase_order_items', 'purchase_orders',
                          'delivery_items', 'deliveries', 'products', 'customers', 'suppliers',
                          'product_colors', 'product_sizes', 'product_units'
                        ];

                        for (const table of tables) {
                          await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
                        }

                        toast({ title: 'Success', description: 'All seed data has been removed' });
                        setSaving(false);
                      }}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60"
                    >
                      <Trash2 className="w-4 h-4" />
                      Clear All Data
                    </button>
                  </div>
                </div>

                <div className="border border-border rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Reset Categories & Brands</p>
                      <p className="text-xs text-muted-foreground">Remove all categories and brands</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('Remove all categories and brands?')) return;
                        setSaving(true);
                        await supabase.from('products').update({ category_id: null, brand_id: null }).neq('id', '00000000-0000-0000-0000-000000000000');
                        await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                        await supabase.from('brands').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                        toast({ title: 'Success', description: 'Categories and brands cleared' });
                        setSaving(false);
                      }}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reset
                    </button>
                  </div>
                </div>

                <div className="border border-border rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Re-seed Demo Data</p>
                      <p className="text-xs text-muted-foreground">Add sample products, customers, and transactions</p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('This will add sample data. Continue?')) return;
                        setSaving(true);

                        const sampleCustomers = [
                          { id: 'seed-cust-1', code: 'CUST-001', name: 'Abdul Rahman', type: 'retail', country: 'Bangladesh', is_active: true, credit_limit: 50000, credit_days: 30, outstanding_balance: 0, total_purchases: 0, loyalty_points: 100, discount_percent: 5 },
                          { id: 'seed-cust-2', code: 'CUST-002', name: 'Karim Construction', type: 'contractor', country: 'Bangladesh', is_active: true, credit_limit: 200000, credit_days: 45, outstanding_balance: 0, total_purchases: 0, loyalty_points: 0, discount_percent: 10 },
                          { id: 'seed-cust-3', code: 'CUST-003', name: 'Fatima Interiors', type: 'interior_designer', country: 'Bangladesh', is_active: true, credit_limit: 100000, credit_days: 30, outstanding_balance: 0, total_purchases: 0, loyalty_points: 50, discount_percent: 8 },
                        ];
                        await supabase.from('customers').upsert(sampleCustomers, { onConflict: 'id' });

                        const sampleCategories = [
                          { id: 'seed-cat-1', name: 'Cement & Concrete', slug: 'cement-concrete', is_active: true, sort_order: 1 },
                          { id: 'seed-cat-2', name: 'Steel & Iron', slug: 'steel-iron', is_active: true, sort_order: 2 },
                          { id: 'seed-cat-3', name: 'Paints & Finishes', slug: 'paints-finishes', is_active: true, sort_order: 3 },
                          { id: 'seed-cat-4', name: 'Tiles & Flooring', slug: 'tiles-flooring', is_active: true, sort_order: 4 },
                        ];
                        await supabase.from('categories').upsert(sampleCategories, { onConflict: 'id' });

                        const sampleBrands = [
                          { id: 'seed-brand-1', name: 'Holcim', slug: 'holcim', is_active: true },
                          { id: 'seed-brand-2', name: 'BSRM', slug: 'bsrm', is_active: true },
                          { id: 'seed-brand-3', name: 'Asian Paints', slug: 'asian-paints', is_active: true },
                          { id: 'seed-brand-4', name: 'Rak Ceramics', slug: 'rak-ceramics', is_active: true },
                        ];
                        await supabase.from('brands').upsert(sampleBrands, { onConflict: 'id' });

                        const sampleProducts = [
                          { id: 'seed-prod-1', sku: 'CEM-001', name: 'Holcim Portland Cement 50kg', category_id: 'seed-cat-1', brand_id: 'seed-brand-1', unit: 'bag', cost_price: 520, sale_price: 550, min_stock_level: 100, is_active: true, is_online: true, warranty_months: 0, tax_rate: 0 },
                          { id: 'seed-prod-2', sku: 'STL-001', name: 'BSRM 500 Grade Rebar 12mm', category_id: 'seed-cat-2', brand_id: 'seed-brand-2', unit: 'ton', cost_price: 85000, sale_price: 88000, min_stock_level: 10, is_active: true, is_online: true, warranty_months: 0, tax_rate: 0 },
                          { id: 'seed-prod-3', sku: 'PNT-001', name: 'Asian Paints Emulsion White 20L', category_id: 'seed-cat-3', brand_id: 'seed-brand-3', unit: 'tin', cost_price: 3200, sale_price: 3500, min_stock_level: 20, is_active: true, is_online: true, warranty_months: 12, tax_rate: 0 },
                          { id: 'seed-prod-4', sku: 'TIL-001', name: 'RAK Floor Tiles 2x2 White', category_id: 'seed-cat-4', brand_id: 'seed-brand-4', unit: 'sqft', cost_price: 65, sale_price: 85, min_stock_level: 500, is_active: true, is_online: true, warranty_months: 0, tax_rate: 0 },
                        ];
                        await supabase.from('products').upsert(sampleProducts, { onConflict: 'id' });

                        const defaultWarehouse = await supabase.from('warehouses').select('id').limit(1).single();
                        if (defaultWarehouse.data) {
                          const inventoryItems = sampleProducts.map(p => ({
                            product_id: p.id,
                            warehouse_id: defaultWarehouse.data.id,
                            quantity_on_hand: p.min_stock_level * 2,
                            quantity_reserved: 0,
                            quantity_incoming: 0,
                          }));
                          await supabase.from('inventory_items').upsert(inventoryItems, { onConflict: 'product_id,warehouse_id' });
                        }

                        toast({ title: 'Success', description: 'Sample data has been added' });
                        setSaving(false);
                      }}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60"
                    >
                      <Database className="w-4 h-4" />
                      Add Sample Data
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-3">
            <button
              onClick={() => {
                if (activeTab === 'general') saveSettings('company', company);
                else if (activeTab === 'notifications') saveSettings('notifications', notifications);
                else if (activeTab === 'appearance') saveSettings('appearance', appearance);
                else if (activeTab === 'profile') saveProfile();
              }}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
