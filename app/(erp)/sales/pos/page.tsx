'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { toast } from '@/hooks/use-toast';
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Smartphone, CircleCheck as CheckCircle2, X, Receipt, ChevronDown } from 'lucide-react';
import type { ProductUnit } from '@/lib/types';
import { isMultiUnitEnabled, getDefaultSaleUnit, convertToBaseUnit } from '@/lib/unit-utils';

interface CartItem {
  id: string;
  name: string;
  sku: string;
  sale_price: number;
  quantity: number;
  image_url?: string;
  inventory_item_id?: string;
  warehouse_id?: string;
  stock_available: number;
  selected_unit?: ProductUnit;
  unit_price: number;
  base_quantity: number;
}

interface ProductData {
  id: string;
  name: string;
  sku: string;
  sale_price: number;
  cost_price: number;
  image_url?: string;
  unit?: string;
  base_unit?: string;
  enable_multi_unit?: boolean;
  inventory_items: {
    id: string;
    warehouse_id: string;
    quantity_on_hand: number;
  }[];
  units?: ProductUnit[];
}

const WALK_IN_CUSTOMER_ID = '00000000-0000-0000-0000-000000000001';

export default function POSPage() {
  const [products, setProducts] = useState<ProductData[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(WALK_IN_CUSTOMER_ID);
  const [customers, setCustomers] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState(0);
  const [orderComplete, setOrderComplete] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastInvoiceNumber, setLastInvoiceNumber] = useState('');
  const [unitSelectorProduct, setUnitSelectorProduct] = useState<ProductData | null>(null);

  useEffect(() => {
    loadProducts();
    loadCustomers();
  }, []);

  async function loadProducts() {
    setLoading(true);
    const { data } = await supabase
      .from('products')
      .select(`id, name, sku, sale_price, cost_price, image_url, unit, base_unit, enable_multi_unit,
        inventory_items(id, warehouse_id, quantity_on_hand),
        units:product_units(id, product_id, unit_name, unit_short, conversion_factor, is_base_unit, is_sale_unit, price, cost_price, is_active, sort_order)`)
      .eq('is_active', true)
      .limit(100);
    setProducts((data || []) as ProductData[]);
    setLoading(false);
  }

  async function loadCustomers() {
    const { data } = await supabase
      .from('customers')
      .select('id, name, code')
      .eq('is_active', true)
      .limit(100);
    setCustomers(data || []);
  }

  const filteredProducts = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  function getStockInBaseUnits(product: ProductData): number {
    return product.inventory_items?.reduce((s: number, i: any) => s + Number(i.quantity_on_hand), 0) || 0;
  }

  function addToCart(product: ProductData, selectedUnit?: ProductUnit) {
    const invItems = product.inventory_items || [];
    const bestInv = invItems.length > 0
      ? invItems.reduce((a, b) => (a.quantity_on_hand > b.quantity_on_hand ? a : b))
      : null;

    const stockAvailableInBase = bestInv ? bestInv.quantity_on_hand : 0;

    if (stockAvailableInBase <= 0) {
      toast({ title: 'Out of stock', description: `${product.name} is not available`, variant: 'destructive' });
      return;
    }

    const unit = selectedUnit || getDefaultSaleUnit(product as any);
    const unitPrice = unit.price || product.sale_price;

    setCart(prev => {
      const existingIndex = prev.findIndex(i => i.id === product.id && i.selected_unit?.id === unit.id);

      if (existingIndex >= 0) {
        const existing = prev[existingIndex];
        const newQty = existing.quantity + 1;
        const newBaseQty = convertToBaseUnit(newQty, unit);

        if (newBaseQty > stockAvailableInBase) {
          toast({ title: 'Stock limit', description: `Only ${stockAvailableInBase} base units available`, variant: 'destructive' });
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = { ...existing, quantity: newQty, base_quantity: newBaseQty };
        return updated;
      }

      return [...prev, {
        id: product.id,
        name: product.name,
        sku: product.sku,
        sale_price: unitPrice,
        quantity: 1,
        image_url: product.image_url,
        inventory_item_id: bestInv?.id,
        warehouse_id: bestInv?.warehouse_id,
        stock_available: stockAvailableInBase,
        selected_unit: unit,
        unit_price: unitPrice,
        base_quantity: convertToBaseUnit(1, unit),
      }];
    });

    setUnitSelectorProduct(null);
  }

  function handleProductClick(product: ProductData) {
    if (isMultiUnitEnabled(product as any)) {
      setUnitSelectorProduct(product);
    } else {
      addToCart(product);
    }
  }

  function updateQty(id: string, unitId: string | undefined, delta: number) {
    setCart(prev => prev.map(i => {
      if (i.id !== id || i.selected_unit?.id !== unitId) return i;
      const newQty = Math.max(0, i.quantity + delta);
      const newBaseQty = i.selected_unit ? convertToBaseUnit(newQty, i.selected_unit) : newQty;
      if (newBaseQty > i.stock_available) {
        toast({ title: 'Stock limit', description: `Only ${i.stock_available} base units available`, variant: 'destructive' });
        return i;
      }
      return { ...i, quantity: newQty, base_quantity: newBaseQty };
    }).filter(i => i.quantity > 0));
  }

  function removeFromCart(id: string, unitId?: string) {
    setCart(prev => prev.filter(i => !(i.id === id && (unitId ? i.selected_unit?.id === unitId : true))));
  }

  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;

  async function processOrder() {
    if (cart.length === 0) return;
    setProcessing(true);

    try {
      const invoiceNumber = `POS-${Date.now().toString().slice(-8)}`;
      setLastInvoiceNumber(invoiceNumber);

      const customerId = selectedCustomer || WALK_IN_CUSTOMER_ID;

      const { data: invoice, error: invError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNumber,
          customer_id: customerId,
          invoice_date: new Date().toISOString().split('T')[0],
          subtotal: subtotal,
          discount_amount: discountAmount,
          tax_amount: 0,
          total_amount: total,
          amount_paid: total,
          status: 'paid',
          is_pos: true,
        })
        .select()
        .single();

      if (invError) throw invError;
      if (!invoice) throw new Error('Invoice not created');

      const invoiceItems = cart.map(item => ({
        invoice_id: invoice.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount_percent: discount,
        tax_rate: 0,
        subtotal: item.quantity * item.unit_price,
        unit_name: item.selected_unit?.unit_name,
        unit_conversion_factor: item.selected_unit?.conversion_factor,
        base_quantity: item.base_quantity,
      }));

      const { error: itemsError } = await supabase.from('invoice_items').insert(invoiceItems);
      if (itemsError) throw itemsError;

      const { error: payError } = await supabase.from('payments').insert({
        payment_number: `PAY-${Date.now().toString().slice(-6)}`,
        payment_type: 'received',
        reference_type: 'invoice',
        reference_id: invoice.id,
        customer_id: customerId,
        amount: total,
        payment_method: paymentMethod,
        payment_date: new Date().toISOString().split('T')[0],
        notes: 'POS sale',
      });
      if (payError) console.error('Payment record error:', payError.message);

      for (const item of cart) {
        if (item.inventory_item_id && item.warehouse_id) {
          const { data: invData } = await supabase
            .from('inventory_items')
            .select('quantity_on_hand')
            .eq('id', item.inventory_item_id)
            .single();

          if (invData) {
            const newQty = Math.max(0, (invData.quantity_on_hand || 0) - item.base_quantity);
            await supabase
              .from('inventory_items')
              .update({ quantity_on_hand: newQty, updated_at: new Date().toISOString() })
              .eq('id', item.inventory_item_id);
          }

          const product = products.find(p => p.id === item.id);
          await supabase.from('stock_movements').insert({
            product_id: item.id,
            warehouse_id: item.warehouse_id,
            movement_type: 'sale',
            quantity: -item.base_quantity,
            unit_cost: item.selected_unit?.cost_price || product?.cost_price || 0,
            reference_type: 'invoice',
            reference_id: invoice.id,
            reference_number: invoiceNumber,
            notes: `POS sale - ${item.quantity} ${item.selected_unit?.unit_name || 'units'}`,
          });
        }
      }

      if (customerId !== WALK_IN_CUSTOMER_ID) {
        const { data: custData } = await supabase
          .from('customers')
          .select('total_purchases')
          .eq('id', customerId)
          .single();
        if (custData) {
          await supabase
            .from('customers')
            .update({ total_purchases: (custData.total_purchases || 0) + total })
            .eq('id', customerId);
        }
      }

      setCart([]);
      setDiscount(0);
      setSelectedCustomer(WALK_IN_CUSTOMER_ID);
      setOrderComplete(true);
      toast({ title: 'Success', description: `Order ${invoiceNumber} completed successfully` });
      loadProducts();
    } catch (error: any) {
      console.error('POS error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to process order', variant: 'destructive' });
    }

    setProcessing(false);
    setTimeout(() => setOrderComplete(false), 4000);
  }

  const paymentMethods = [
    { id: 'cash', label: 'Cash', icon: Banknote, color: 'text-green-600 bg-green-50 border-green-200' },
    { id: 'card', label: 'Card', icon: CreditCard, color: 'text-blue-600 bg-blue-50 border-blue-200' },
    { id: 'bkash', label: 'bKash', icon: Smartphone, color: 'text-pink-600 bg-pink-50 border-pink-200' },
    { id: 'nagad', label: 'Nagad', icon: Smartphone, color: 'text-orange-600 bg-orange-50 border-orange-200' },
  ];

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4 animate-fade-in">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search products by name or SKU..."
              className="w-full pl-10 pr-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
            />
          </div>
          <select value={selectedCustomer} onChange={e => setSelectedCustomer(e.target.value)} className="border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none min-w-[180px]">
            <option value={WALK_IN_CUSTOMER_ID}>Walk-in Customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 content-start pb-4">
          {loading ? Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-border p-3 animate-pulse"><div className="h-20 bg-muted rounded-lg mb-2" /><div className="h-3 bg-muted rounded mb-1" /><div className="h-3 bg-muted rounded w-2/3" /></div>
          )) : filteredProducts.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">No products found</div>
          ) : filteredProducts.map(p => {
            const stock = getStockInBaseUnits(p);
            const multiUnit = isMultiUnitEnabled(p as any);
            const saleUnit = p.units?.find(u => u.is_sale_unit);
            const displayPrice = saleUnit?.price || p.sale_price;

            const inCart = cart.filter(c => c.id === p.id);
            const cartQty = inCart.reduce((sum, c) => sum + c.base_quantity, 0);
            const available = stock - cartQty;

            return (
              <button
                key={p.id}
                onClick={() => handleProductClick(p)}
                disabled={available <= 0}
                className="bg-white rounded-xl border border-border p-3 text-left hover:border-blue-400 hover:shadow-md transition-all group disabled:opacity-50 disabled:cursor-not-allowed relative"
              >
                {multiUnit && (
                  <span className="absolute top-2 right-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Multi-unit</span>
                )}
                <div className="w-full h-20 bg-muted rounded-lg overflow-hidden mb-2">
                  {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="w-full h-full flex items-center justify-center text-muted-foreground text-2xl">?</div>}
                </div>
                <p className="text-xs font-semibold text-foreground leading-tight mb-0.5 line-clamp-2">{p.name}</p>
                <p className="text-[10px] text-muted-foreground mb-1">{p.sku}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-blue-600">{formatCurrency(displayPrice)}</p>
                    {multiUnit && saleUnit && (
                      <p className="text-[9px] text-muted-foreground">per {saleUnit.unit_name}</p>
                    )}
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${available > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>{available}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-80 flex flex-col bg-white rounded-2xl border border-border shadow-sm overflow-hidden relative">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground flex items-center gap-2"><ShoppingCart className="w-4 h-4" />Cart ({cart.length})</h2>
          {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs text-red-500 hover:underline">Clear</button>}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center py-12">
              <div>
                <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Cart is empty</p>
                <p className="text-xs text-muted-foreground">Click products to add</p>
              </div>
            </div>
          ) : cart.map(item => (
            <div key={`${item.id}-${item.selected_unit?.id || 'default'}`} className="flex items-center gap-2 bg-muted/30 rounded-xl p-2">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
                {item.image_url ? <img src={item.image_url} alt="" className="w-full h-full object-cover" /> : <span className="text-base">?</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-foreground truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatCurrency(item.unit_price)}
                  {item.selected_unit && <span className="ml-1">/ {item.selected_unit.unit_short || item.selected_unit.unit_name}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(item.id, item.selected_unit?.id, -1)} className="w-5 h-5 rounded-full bg-white border border-border flex items-center justify-center hover:bg-muted transition"><Minus className="w-2.5 h-2.5" /></button>
                <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                <button onClick={() => updateQty(item.id, item.selected_unit?.id, 1)} className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition"><Plus className="w-2.5 h-2.5" /></button>
              </div>
              <button onClick={() => removeFromCart(item.id, item.selected_unit?.id || undefined)} className="text-muted-foreground hover:text-red-500 transition"><X className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <div className="p-3 border-t border-border space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground flex-1">Discount %</span>
              <input type="number" min="0" max="100" value={discount} onChange={e => setDiscount(Number(e.target.value))} className="w-16 border border-border rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              {discount > 0 && <div className="flex justify-between text-red-500"><span>Discount ({discount}%)</span><span>-{formatCurrency(discountAmount)}</span></div>}
              <div className="flex justify-between font-bold text-base text-foreground pt-1 border-t border-border"><span>Total</span><span>{formatCurrency(total)}</span></div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {paymentMethods.map(m => (
                <button key={m.id} onClick={() => setPaymentMethod(m.id)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border-2 text-xs font-medium transition ${paymentMethod === m.id ? m.color + ' border-current' : 'border-border text-muted-foreground hover:border-blue-200'}`}>
                  <m.icon className="w-3 h-3" />{m.label}
                </button>
              ))}
            </div>

            <button
              onClick={processOrder}
              disabled={processing}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-60 text-sm"
            >
              {processing ? 'Processing...' : `Charge ${formatCurrency(total)}`}
            </button>
          </div>
        )}

        {orderComplete && (
          <div className="absolute inset-0 bg-white flex flex-col items-center justify-center rounded-2xl z-10">
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-3" />
            <h3 className="font-bold text-lg text-foreground">Order Complete!</h3>
            <p className="text-sm text-muted-foreground mt-1">{lastInvoiceNumber}</p>
            <div className="flex items-center gap-2 mt-4">
              <button onClick={() => setOrderComplete(false)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition">New Order</button>
            </div>
          </div>
        )}
      </div>

      {unitSelectorProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-bold text-sm">{unitSelectorProduct.name}</h3>
                <p className="text-xs text-muted-foreground">Select unit for this sale</p>
              </div>
              <button onClick={() => setUnitSelectorProduct(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-2">
              {unitSelectorProduct.units?.filter(u => u.is_active).map(unit => (
                <button
                  key={unit.id}
                  onClick={() => addToCart(unitSelectorProduct, unit)}
                  className="w-full flex items-center justify-between p-3 border border-border rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition"
                >
                  <div className="text-left">
                    <p className="text-sm font-semibold">{unit.unit_name} {unit.unit_short && <span className="text-muted-foreground font-normal">({unit.unit_short})</span>}</p>
                    <p className="text-xs text-muted-foreground">
                      1 {unit.unit_name} = {unit.conversion_factor} {unitSelectorProduct.base_unit || 'base units'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-blue-600">{formatCurrency(unit.price)}</p>
                    <p className="text-[10px] text-muted-foreground">per {unit.unit_short || unit.unit_name}</p>
                  </div>
                </button>
              ))}
              {(!unitSelectorProduct.units || unitSelectorProduct.units.filter(u => u.is_active).length === 0) && (
                <button
                  onClick={() => addToCart(unitSelectorProduct)}
                  className="w-full flex items-center justify-between p-3 border border-border rounded-xl hover:border-blue-400 hover:bg-blue-50/50 transition"
                >
                  <p className="text-sm font-semibold">{unitSelectorProduct.unit || 'Piece'}</p>
                  <p className="text-sm font-bold text-blue-600">{formatCurrency(unitSelectorProduct.sale_price)}</p>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
