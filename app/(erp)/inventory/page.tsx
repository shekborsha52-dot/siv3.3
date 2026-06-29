'use client';

import { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { formatCurrency } from '@/lib/format';
import { toast } from '@/hooks/use-toast';
import JsBarcode from 'jsbarcode';
import { Package, Plus, Search, CreditCard as Edit, Trash2, TriangleAlert as AlertTriangle, ChartBar as BarChart3, Boxes, TrendingDown, RefreshCw, X, Warehouse, Palette, Ruler, ChevronDown, ChevronUp, ChevronRight, Info, Settings, Barcode, Camera, Printer, Download, Upload } from 'lucide-react';
import type { Product, Category, Brand, Warehouse as WarehouseType, ProductColor, ProductSize, ProductUnit } from '@/lib/types';

function StockByWarehouse({ productId, warehouses, inventoryByWarehouse }: { productId: string; warehouses: WarehouseType[]; inventoryByWarehouse: Record<string, Record<string, number>> }) {
  const stockByWh = inventoryByWarehouse[productId] || {};
  return (
    <div className="text-xs space-y-0.5">
      {warehouses.map(w => {
        const qty = stockByWh[w.id] || 0;
        return (
          <div key={w.id} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{w.name}:</span>
            <span className={qty > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}>{qty}</span>
          </div>
        );
      })}
    </div>
  );
}

interface ProductWithStock extends Omit<Product, 'category' | 'brand'> {
  total_stock?: number;
  category?: { name: string };
  brand?: { name: string };
  product_colors?: { id: string; name: string; hex_code: string }[];
  product_sizes?: { id: string; name: string }[];
}

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [inventoryByWarehouse, setInventoryByWarehouse] = useState<Record<string, Record<string, number>>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [allColors, setAllColors] = useState<{ id: string; name: string; hex_code: string }[]>([]);
  const [allSizes, setAllSizes] = useState<{ id: string; name: string }[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithStock | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductWithStock | null>(null);
  const [barcodeProduct, setBarcodeProduct] = useState<ProductWithStock | null>(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [stats, setStats] = useState({ total: 0, lowStock: 0, outOfStock: 0, value: 0 });
  const importFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [prodRes, catRes, brandRes, invRes, whRes, colorRes, sizeRes] = await Promise.all([
      supabase.from('products').select('*, category:categories(name), brand:brands(name), product_colors(id, name, hex_code), product_sizes(id, name)').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').eq('is_active', true),
      supabase.from('brands').select('*').eq('is_active', true),
      supabase.from('inventory_items').select('product_id, warehouse_id, quantity_on_hand'),
      supabase.from('warehouses').select('*').eq('is_active', true).order('is_default', { ascending: false }),
      supabase.from('product_colors').select('id, name, hex_code').order('name'),
      supabase.from('product_sizes').select('id, name').order('name'),
    ]);

    const stockMap: Record<string, number> = {};
    const byWarehouse: Record<string, Record<string, number>> = {};
    (invRes.data || []).forEach((i: any) => {
      stockMap[i.product_id] = (stockMap[i.product_id] || 0) + Number(i.quantity_on_hand);
      if (!byWarehouse[i.product_id]) byWarehouse[i.product_id] = {};
      byWarehouse[i.product_id][i.warehouse_id] = Number(i.quantity_on_hand);
    });

    const prods = (prodRes.data || []).map((p: any) => ({
      ...p,
      total_stock: stockMap[p.id] || 0,
    }));

    setProducts(prods);
    setCategories(catRes.data || []);
    setBrands(brandRes.data || []);
    setWarehouses(whRes.data || []);
    setInventoryByWarehouse(byWarehouse);

    const seenColors = new Set<string>();
    const uniqueColors = (colorRes.data || []).filter((c: any) => {
      if (seenColors.has(c.name)) return false;
      seenColors.add(c.name);
      return true;
    });
    setAllColors(uniqueColors);

    const seenSizes = new Set<string>();
    const uniqueSizes = (sizeRes.data || []).filter((s: any) => {
      if (seenSizes.has(s.name)) return false;
      seenSizes.add(s.name);
      return true;
    });
    setAllSizes(uniqueSizes);

    const activeProds = prods.filter((p: any) => p.is_active);
    const lowStock = activeProds.filter((p: any) => (p.total_stock || 0) > 0 && (p.total_stock || 0) <= p.min_stock_level).length;
    const outOfStock = activeProds.filter((p: any) => (p.total_stock || 0) === 0).length;
    const value = activeProds.reduce((sum: number, p: any) => sum + (p.total_stock || 0) * p.cost_price, 0);

    setStats({ total: activeProds.length, lowStock, outOfStock, value });
    setLoading(false);
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCategory || p.category_id === filterCategory;
    const matchBrand = !filterBrand || p.brand_id === filterBrand;
    const matchWarehouse = !filterWarehouse || (inventoryByWarehouse[p.id]?.[filterWarehouse] || 0) > 0;
    const matchStatus = !filterStatus || (
      filterStatus === 'low' ? (p.total_stock || 0) <= p.min_stock_level && (p.total_stock || 0) > 0 :
      filterStatus === 'out' ? (p.total_stock || 0) === 0 :
      filterStatus === 'ok' ? (p.total_stock || 0) > p.min_stock_level : true
    );
    const matchColor = !filterColor || p.product_colors?.some(c => c.name === filterColor);
    const matchSize = !filterSize || p.product_sizes?.some(s => s.name === filterSize);
    return matchSearch && matchCat && matchBrand && matchWarehouse && matchStatus && matchColor && matchSize;
  });

  function getStockBadge(qty: number, min: number) {
    if (qty === 0) return <span className="badge-status bg-red-50 text-red-600">Out of Stock</span>;
    if (qty <= min) return <span className="badge-status bg-amber-50 text-amber-600">Low Stock</span>;
    return <span className="badge-status bg-green-50 text-green-600">In Stock</span>;
  }

  function exportProducts() {
    const rows = filtered.map((p, i) => ({
      '#': i + 1,
      Name: p.name,
      SKU: p.sku,
      Category: (p as any).category?.name || '',
      Brand: (p as any).brand?.name || '',
      Unit: p.unit || '',
      'Cost Price': p.cost_price,
      'Sale Price': p.sale_price,
      'Min Stock Level': p.min_stock_level,
      'Current Stock': p.total_stock || 0,
      Description: (p as any).description || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `inventory-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: 'Exported', description: `${rows.length} products exported to Excel` });
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);

        if (rows.length === 0) { toast({ title: 'Empty file', description: 'No rows found in the spreadsheet', variant: 'destructive' }); return; }

        let imported = 0, skipped = 0;
        const sectionHeaders = ['suzan metal', 'rosa metal', 'astra metal', 'products name', 'sanitary ware', 'metal'];

        for (const row of rows) {
          const name = row['Name'] || row['name'] || row['__EMPTY'] || row['__EMPTY_2'];
          const sku = row['SKU'] || row['sku'] || row['__EMPTY_1'] || row['__EMPTY_3'];

          if (!name || !sku) { skipped++; continue; }

          const nameStr = String(name).trim();
          const skuStr = String(sku).trim();

          if (sectionHeaders.some(h => nameStr.toLowerCase() === h || skuStr.toLowerCase().includes(h.toLowerCase()))) { skipped++; continue; }
          if (!/^[A-Za-z0-9]/.test(skuStr)) { skipped++; continue; }

          const catName = row['Category'] || row['category'];
          const brandName = row['Brand'] || row['brand'];

          let category_id = null;
          if (catName) {
            const cat = categories.find(c => c.name.toLowerCase() === String(catName).toLowerCase());
            category_id = cat?.id || null;
          }
          let brand_id = null;
          if (brandName) {
            const br = brands.find(b => b.name.toLowerCase() === String(brandName).toLowerCase());
            brand_id = br?.id || null;
          }

          const { data: productData, error } = await supabase.from('products').upsert({
            name: nameStr,
            sku: skuStr,
            unit: String(row['Unit'] || row['unit'] || 'pcs'),
            cost_price: Number(row['Cost Price'] || row['cost_price'] || 0),
            sale_price: Number(row['Sale Price'] || row['sale_price'] || 0),
            min_stock_level: Number(row['Min Stock Level'] || row['min_stock_level'] || 0),
            description: String(row['Description'] || row['description'] || ''),
            category_id,
            brand_id,
            is_active: true,
          }, { onConflict: 'tenant_id,sku' }).select();

          if (!error && productData && productData[0]) {
            imported++;
            const currentStock = Number(row['Current Stock'] || row['current_stock'] || 0);
            if (currentStock > 0) {
              await supabase.from('inventory_items').upsert({
                product_id: productData[0].id,
                warehouse_id: '33000000-0000-0000-0000-000000000001',
                quantity_on_hand: currentStock,
                quantity_reserved: 0,
              }, { onConflict: 'product_id,warehouse_id' });
            }
          } else {
            skipped++;
          }
        }
        toast({ title: 'Import Complete', description: `${imported} products imported, ${skipped} skipped` });
        loadData();
      } catch (err: any) {
        toast({ title: 'Import Failed', description: err.message || 'Invalid file format', variant: 'destructive' });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleDelete() {
    if (!deletingProduct) return;
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', deletingProduct.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Product deleted successfully' });
      loadData();
    }
    setDeletingProduct(null);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Manage products and stock levels</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowManageModal(true)}
            className="flex items-center gap-2 border border-border hover:bg-muted text-foreground px-3 py-2 rounded-lg text-sm font-semibold transition"
          >
            <Settings className="w-4 h-4" />
            Manage
          </button>
          <button
            onClick={exportProducts}
            className="flex items-center gap-2 border border-border hover:bg-muted text-foreground px-3 py-2 rounded-lg text-sm font-semibold transition"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => importFileRef.current?.click()}
            className="flex items-center gap-2 border border-border hover:bg-muted text-foreground px-3 py-2 rounded-lg text-sm font-semibold transition"
          >
            <Upload className="w-4 h-4" />
            Import
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleImport}
          />
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Products', value: stats.total, icon: Boxes, color: 'text-blue-500 bg-blue-50' },
          { label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle, color: 'text-amber-500 bg-amber-50' },
          { label: 'Out of Stock', value: stats.outOfStock, icon: TrendingDown, color: 'text-red-500 bg-red-50' },
          { label: 'Inventory Value', value: formatCurrency(stats.value), icon: BarChart3, color: 'text-green-500 bg-green-50' },
        ].map((s) => (
          <div key={s.label} className="stat-card flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${s.color}`}>
              <s.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-border p-4 shadow-sm flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or SKU..."
            className="w-full pl-8 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="">All Categories</option>
          {categories.filter(c => !c.parent_id).map(c => (
            <optgroup key={c.id} label={c.name}>
              <option key={c.id} value={c.id}>{c.name}</option>
              {categories.filter(sc => sc.parent_id === c.id).map(sc => (
                <option key={sc.id} value={sc.id}>&nbsp;&nbsp;{sc.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select value={filterBrand} onChange={e => setFilterBrand(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="">All Brands</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={filterWarehouse} onChange={e => setFilterWarehouse(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="">All Warehouses</option>
          {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
          <option value="">All Status</option>
          <option value="ok">In Stock</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
        {allColors.length > 0 && (
          <select value={filterColor} onChange={e => setFilterColor(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">All Colors</option>
            {allColors.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        )}
        {allSizes.length > 0 && (
          <select value={filterSize} onChange={e => setFilterSize(e.target.value)} className="border border-border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20">
            <option value="">All Sizes</option>
            {allSizes.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        )}
        <button onClick={loadData} className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 text-sm hover:bg-muted transition">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="table-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Product</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">SKU</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Category</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Brand</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Stock</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Cost</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Sale Price</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">No products found</td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className={`hover:bg-muted/30 transition-colors ${!p.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-muted rounded-lg overflow-hidden shrink-0">
                          {p.image_url ? (
                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-muted-foreground" /></div>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.enable_multi_unit ? <span className="text-blue-600">Multi-unit</span> : p.unit}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{p.sku}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{p.category?.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-foreground">{p.brand?.name || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="group relative">
                        <span className={`text-sm font-bold cursor-help ${(p.total_stock || 0) === 0 ? 'text-red-500' : (p.total_stock || 0) <= p.min_stock_level ? 'text-amber-500' : 'text-foreground'}`}>
                          {p.total_stock || 0}
                        </span>
                        <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg p-3 z-10 hidden group-hover:block min-w-[180px]">
                          <p className="text-xs font-semibold mb-2 text-foreground">Stock by Location:</p>
                          <StockByWarehouse productId={p.id} warehouses={warehouses} inventoryByWarehouse={inventoryByWarehouse} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-foreground">{formatCurrency(p.cost_price)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-foreground">{formatCurrency(p.sale_price)}</td>
                    <td className="px-4 py-3">{getStockBadge(p.total_stock || 0, p.min_stock_level)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setBarcodeProduct(p)} title="View Barcode" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-green-50 text-muted-foreground hover:text-green-600 transition">
                          <Barcode className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setEditingProduct(p)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-600 transition">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeletingProduct(p)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <ProductModal categories={categories} brands={brands} warehouses={warehouses} onClose={() => setShowAddModal(false)} onSaved={loadData} />
      )}
      {editingProduct && (
        <ProductModal categories={categories} brands={brands} warehouses={warehouses} product={editingProduct} onClose={() => setEditingProduct(null)} onSaved={loadData} />
      )}
      {deletingProduct && (
        <DeleteConfirmModal product={deletingProduct} onClose={() => setDeletingProduct(null)} onConfirm={handleDelete} />
      )}
      {barcodeProduct && (
        <BarcodeModal product={barcodeProduct} onClose={() => setBarcodeProduct(null)} />
      )}
      {showManageModal && (
        <ManageCatalogModal categories={categories} brands={brands} onClose={() => setShowManageModal(false)} onSaved={loadData} />
      )}
    </div>
  );
}

function ProductModal({ categories, brands, warehouses, product, onClose, onSaved }: {
  categories: Category[];
  brands: Brand[];
  warehouses: WarehouseType[];
  product?: ProductWithStock | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!product;
  const [form, setForm] = useState({
    name: product?.name || '',
    sku: product?.sku || '',
    unit: product?.unit || 'pcs',
    cost_price: product?.cost_price?.toString() || '',
    sale_price: product?.sale_price?.toString() || '',
    category_id: product?.category_id || '',
    brand_id: product?.brand_id || '',
    min_stock_level: product?.min_stock_level?.toString() || '0',
    description: product?.description || '',
    is_active: product?.is_active ?? true,
    enable_multi_unit: product?.enable_multi_unit ?? false,
    enable_colors: product?.enable_colors ?? false,
    enable_sizes: product?.enable_sizes ?? false,
  });
  const [stockByWarehouse, setStockByWarehouse] = useState<Record<string, string>>(
    warehouses.reduce((acc, w) => ({ ...acc, [w.id]: '0' }), {})
  );
  const [colors, setColors] = useState<ProductColor[]>([]);
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [units, setUnits] = useState<ProductUnit[]>([]);
  const [showUnits, setShowUnits] = useState(true);
  const [showColors, setShowColors] = useState(true);
  const [showSizes, setShowSizes] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (product?.id) {
      loadProductVariants(product.id);
    }
  }, [product?.id]);

  async function loadProductVariants(productId: string) {
    const [colorRes, sizeRes, unitRes] = await Promise.all([
      supabase.from('product_colors').select('*').eq('product_id', productId).order('sort_order'),
      supabase.from('product_sizes').select('*').eq('product_id', productId).order('sort_order'),
      supabase.from('product_units').select('*').eq('product_id', productId).order('sort_order'),
    ]);
    setColors((colorRes.data || []) as ProductColor[]);
    setSizes((sizeRes.data || []) as ProductSize[]);
    setUnits((unitRes.data || []) as ProductUnit[]);
  }

  function addColor() {
    setColors([...colors, {
      id: `temp-${Date.now()}`,
      product_id: product?.id || '',
      name: '',
      hex_code: '#000000',
      is_default: colors.length === 0,
      sort_order: colors.length,
      created_at: new Date().toISOString(),
    }]);
  }

  function addSize() {
    setSizes([...sizes, {
      id: `temp-${Date.now()}`,
      product_id: product?.id || '',
      name: '',
      dimensions: '',
      is_default: sizes.length === 0,
      sort_order: sizes.length,
      created_at: new Date().toISOString(),
    }]);
  }

  function addUnit() {
    const hasBaseUnit = units.some(u => u.is_base_unit);
    setUnits([...units, {
      id: `temp-${Date.now()}`,
      product_id: product?.id || '',
      unit_name: '',
      unit_short: '',
      conversion_factor: 1,
      is_base_unit: !hasBaseUnit,
      is_sale_unit: units.length === 0,
      price: 0,
      cost_price: 0,
      sort_order: units.length,
      is_active: true,
      created_at: new Date().toISOString(),
    }]);
  }

  function updateColor(index: number, field: keyof ProductColor, value: any) {
    const updated = [...colors];
    (updated[index] as any)[field] = value;
    if (field === 'is_default' && value === true) {
      updated.forEach((c, i) => { if (i !== index) c.is_default = false; });
    }
    setColors(updated);
  }

  function updateSize(index: number, field: keyof ProductSize, value: any) {
    const updated = [...sizes];
    (updated[index] as any)[field] = value;
    if (field === 'is_default' && value === true) {
      updated.forEach((s, i) => { if (i !== index) s.is_default = false; });
    }
    setSizes(updated);
  }

  function updateUnit(index: number, field: keyof ProductUnit, value: any) {
    const updated = [...units];
    (updated[index] as any)[field] = value;
    if (field === 'is_base_unit' && value === true) {
      updated.forEach((u, i) => { if (i !== index) u.is_base_unit = false; });
    }
    if (field === 'is_sale_unit' && value === true) {
      updated.forEach((u, i) => { if (i !== index) u.is_sale_unit = false; });
    }
    setUnits(updated);
  }

  function removeColor(index: number) {
    setColors(colors.filter((_, i) => i !== index));
  }

  function removeSize(index: number) {
    setSizes(sizes.filter((_, i) => i !== index));
  }

  function removeUnit(index: number) {
    setUnits(units.filter((_, i) => i !== index));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (form.enable_multi_unit) {
      if (units.length === 0) {
        setError('Please add at least one unit when multi-unit is enabled');
        return;
      }
      if (!units.some(u => u.is_base_unit)) {
        setError('Please mark one unit as the base unit');
        return;
      }
    }

    setSaving(true);
    setError('');

    const baseUnit = form.enable_multi_unit ? units.find(u => u.is_base_unit)?.unit_name || form.unit : form.unit;

    const data: any = {
      name: form.name,
      sku: form.sku,
      unit: form.unit,
      base_unit: baseUnit,
      enable_multi_unit: form.enable_multi_unit,
      enable_colors: form.enable_colors,
      enable_sizes: form.enable_sizes,
      cost_price: Number(form.cost_price),
      sale_price: Number(form.sale_price),
      category_id: form.category_id || null,
      brand_id: form.brand_id || null,
      min_stock_level: Number(form.min_stock_level),
      description: form.description || null,
      is_active: form.is_active,
    };

    let productId = product?.id;

    try {
      if (isEdit) {
        const { error } = await supabase.from('products').update(data).eq('id', product!.id);
        if (error) throw error;
      } else {
        const { data: newProduct, error } = await supabase.from('products').insert(data).select('id').single();
        if (error) throw error;
        productId = newProduct.id;
      }

      if (productId) {
        if (form.enable_colors && colors.length > 0) {
          await supabase.from('product_colors').delete().eq('product_id', productId);
          const validColors = colors.filter(c => c.name.trim());
          for (const color of validColors) {
            await supabase.from('product_colors').insert({
              product_id: productId,
              name: color.name,
              hex_code: color.hex_code,
              image_url: color.image_url || null,
              is_default: color.is_default,
              sort_order: color.sort_order,
            });
          }
        }

        if (form.enable_sizes && sizes.length > 0) {
          await supabase.from('product_sizes').delete().eq('product_id', productId);
          const validSizes = sizes.filter(s => s.name.trim());
          for (const size of validSizes) {
            await supabase.from('product_sizes').insert({
              product_id: productId,
              name: size.name,
              dimensions: size.dimensions || null,
              is_default: size.is_default,
              sort_order: size.sort_order,
            });
          }
        }

        if (form.enable_multi_unit && units.length > 0) {
          await supabase.from('product_units').delete().eq('product_id', productId);
          const validUnits = units.filter(u => u.unit_name.trim());
          for (const unit of validUnits) {
            await supabase.from('product_units').insert({
              product_id: productId,
              unit_name: unit.unit_name,
              unit_short: unit.unit_short || null,
              conversion_factor: unit.conversion_factor,
              is_base_unit: unit.is_base_unit,
              is_sale_unit: unit.is_sale_unit,
              price: unit.price,
              cost_price: unit.cost_price,
              barcode: unit.barcode || null,
              sort_order: unit.sort_order,
              is_active: unit.is_active,
            });
          }
        }

        if (!isEdit) {
          for (const [warehouseId, qty] of Object.entries(stockByWarehouse)) {
            const quantity = Number(qty);
            if (quantity > 0) {
              await supabase.from('inventory_items').insert({
                tenant_id: '00000000-0000-0000-0000-000000000001',
                product_id: productId,
                warehouse_id: warehouseId,
                quantity_on_hand: quantity,
              });

              await supabase.from('stock_movements').insert({
                tenant_id: '00000000-0000-0000-0000-000000000001',
                product_id: productId,
                warehouse_id: warehouseId,
                movement_type: 'opening',
                quantity: quantity,
                unit_cost: Number(form.cost_price),
                reference_type: 'product_creation',
                reference_id: productId,
                notes: 'Initial stock on product creation',
              });
            }
          }
        }
      }

      toast({ title: 'Success', description: isEdit ? 'Product updated successfully' : 'Product created successfully' });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold">{isEdit ? 'Edit Product' : 'Add New Product'}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Product Name *</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">SKU *</label>
              <input required value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">Select category</option>
                {categories.filter(c => !c.parent_id).map(c => (
                  <optgroup key={c.id} label={c.name}>
                    <option key={c.id} value={c.id}>{c.name}</option>
                    {categories.filter(sc => sc.parent_id === c.id).map(sc => (
                      <option key={sc.id} value={sc.id}>&nbsp;&nbsp;&nbsp;{sc.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Brand</label>
              <select value={form.brand_id} onChange={e => setForm({ ...form, brand_id: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
                <option value="">Select brand</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 p-3 bg-muted/30 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.enable_multi_unit} onChange={e => setForm({ ...form, enable_multi_unit: e.target.checked })} className="rounded" />
              <span className="text-sm flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Multi-Unit Pricing</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.enable_colors} onChange={e => setForm({ ...form, enable_colors: e.target.checked })} className="rounded" />
              <span className="text-sm flex items-center gap-1"><Palette className="w-3.5 h-3.5" /> Color Variants</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.enable_sizes} onChange={e => setForm({ ...form, enable_sizes: e.target.checked })} className="rounded" />
              <span className="text-sm flex items-center gap-1"><Ruler className="w-3.5 h-3.5" /> Size Variants</span>
            </label>
          </div>

          {!form.enable_multi_unit && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Unit</label>
                <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
                  {['pcs', 'sqft', 'bag', 'tin', 'set', 'box', 'kg', 'ltr', 'meter', 'coil', 'roll', 'carton'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Cost Price *</label>
                <input type="number" required min="0" step="0.01" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Sale Price *</label>
                <input type="number" required min="0" step="0.01" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>
          )}

          {form.enable_multi_unit && (
            <div className="border border-border rounded-lg overflow-hidden">
              <button type="button" onClick={() => setShowUnits(!showUnits)} className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
                <span className="font-medium text-sm flex items-center gap-2"><Package className="w-4 h-4" /> Units & Pricing ({units.length})</span>
                {showUnits ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showUnits && (
                <div className="p-4 space-y-3 bg-white">
                  <div className="text-xs text-muted-foreground mb-2 flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Define units. The <strong>base unit</strong> is the smallest (stock tracked in this). Conversion factor = how many base units equal 1 of this unit. Example: 1 Box = 100 pieces means Box has conversion_factor = 100.</span>
                  </div>
                  {units.map((unit, index) => (
                    <div key={unit.id} className="grid grid-cols-12 gap-2 p-2 bg-muted/30 rounded-lg items-center">
                      <div className="col-span-2">
                        <input placeholder="Unit name" value={unit.unit_name} onChange={e => updateUnit(index, 'unit_name', e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                      </div>
                      <div className="col-span-1">
                        <input placeholder="Short" value={unit.unit_short || ''} onChange={e => updateUnit(index, 'unit_short', e.target.value)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                      </div>
                      <div className="col-span-1">
                        <input type="number" placeholder="Conv." value={unit.conversion_factor} onChange={e => updateUnit(index, 'conversion_factor', parseFloat(e.target.value) || 1)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" placeholder="Sale Price" value={unit.price} onChange={e => updateUnit(index, 'price', parseFloat(e.target.value) || 0)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" placeholder="Cost Price" value={unit.cost_price} onChange={e => updateUnit(index, 'cost_price', parseFloat(e.target.value) || 0)} className="w-full border border-border rounded px-2 py-1 text-sm" />
                      </div>
                      <div className="col-span-2 flex gap-1 flex-wrap">
                        <button type="button" onClick={() => updateUnit(index, 'is_base_unit', !unit.is_base_unit)} className={`px-2 py-1 rounded text-[10px] font-medium ${unit.is_base_unit ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>Base</button>
                        <button type="button" onClick={() => updateUnit(index, 'is_sale_unit', !unit.is_sale_unit)} className={`px-2 py-1 rounded text-[10px] font-medium ${unit.is_sale_unit ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'}`}>Sale</button>
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <button type="button" onClick={() => removeUnit(index)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                  <button type="button" onClick={addUnit} className="w-full py-2 border-2 border-dashed border-blue-300 rounded-lg text-blue-600 hover:bg-blue-50 transition text-sm font-medium">
                    <Plus className="w-4 h-4 inline mr-1" /> Add Unit
                  </button>
                </div>
              )}
            </div>
          )}

          {form.enable_colors && (
            <div className="border border-border rounded-lg overflow-hidden">
              <button type="button" onClick={() => setShowColors(!showColors)} className="w-full flex items-center justify-between px-4 py-3 bg-pink-50 text-pink-700 hover:bg-pink-100 transition">
                <span className="font-medium text-sm flex items-center gap-2"><Palette className="w-4 h-4" /> Colors ({colors.length})</span>
                {showColors ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showColors && (
                <div className="p-4 space-y-2 bg-white">
                  {colors.map((color, index) => (
                    <div key={color.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                      <input type="color" value={color.hex_code || '#000000'} onChange={e => updateColor(index, 'hex_code', e.target.value)} className="w-8 h-8 rounded cursor-pointer" />
                      <input placeholder="Color name" value={color.name} onChange={e => updateColor(index, 'name', e.target.value)} className="flex-1 border border-border rounded px-2 py-1 text-sm" />
                      <button type="button" onClick={() => updateColor(index, 'is_default', !color.is_default)} className={`px-2 py-1 rounded text-[10px] font-medium ${color.is_default ? 'bg-pink-500 text-white' : 'bg-muted text-muted-foreground'}`}>Default</button>
                      <button type="button" onClick={() => removeColor(index)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={addColor} className="w-full py-2 border-2 border-dashed border-pink-300 rounded-lg text-pink-600 hover:bg-pink-50 transition text-sm font-medium">
                    <Plus className="w-4 h-4 inline mr-1" /> Add Color
                  </button>
                </div>
              )}
            </div>
          )}

          {form.enable_sizes && (
            <div className="border border-border rounded-lg overflow-hidden">
              <button type="button" onClick={() => setShowSizes(!showSizes)} className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 text-purple-700 hover:bg-purple-100 transition">
                <span className="font-medium text-sm flex items-center gap-2"><Ruler className="w-4 h-4" /> Sizes ({sizes.length})</span>
                {showSizes ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showSizes && (
                <div className="p-4 space-y-2 bg-white">
                  {sizes.map((size, index) => (
                    <div key={size.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                      <input placeholder="Size name" value={size.name} onChange={e => updateSize(index, 'name', e.target.value)} className="flex-1 border border-border rounded px-2 py-1 text-sm" />
                      <input placeholder="Dimensions" value={size.dimensions || ''} onChange={e => updateSize(index, 'dimensions', e.target.value)} className="w-32 border border-border rounded px-2 py-1 text-sm" />
                      <button type="button" onClick={() => updateSize(index, 'is_default', !size.is_default)} className={`px-2 py-1 rounded text-[10px] font-medium ${size.is_default ? 'bg-purple-500 text-white' : 'bg-muted text-muted-foreground'}`}>Default</button>
                      <button type="button" onClick={() => removeSize(index)} className="text-red-500 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={addSize} className="w-full py-2 border-2 border-dashed border-purple-300 rounded-lg text-purple-600 hover:bg-purple-50 transition text-sm font-medium">
                    <Plus className="w-4 h-4 inline mr-1" /> Add Size
                  </button>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1">Min Stock Level</label>
            <input type="number" min="0" value={form.min_stock_level} onChange={e => setForm({ ...form, min_stock_level: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>

          {!isEdit && (
            <div className="border-t border-border pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Warehouse className="w-4 h-4 text-muted-foreground" />
                <label className="text-xs font-medium">Initial Stock by Warehouse</label>
              </div>
              <div className="space-y-2">
                {warehouses.map(wh => (
                  <div key={wh.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                    <span className="text-sm">{wh.name} {wh.is_default && <span className="text-xs text-blue-600">(Default)</span>}</span>
                    <input
                      type="number"
                      min="0"
                      value={stockByWarehouse[wh.id] || '0'}
                      onChange={e => setStockByWarehouse({ ...stockByWarehouse, [wh.id]: e.target.value })}
                      className="w-24 border border-border rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
          </div>
          {isEdit && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
              <span className="text-sm">Active</span>
            </label>
          )}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60">
              {saving ? 'Saving...' : isEdit ? 'Update Product' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ product, onClose, onConfirm }: { product: ProductWithStock; onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-lg font-bold text-center mb-2">Delete Product?</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Are you sure you want to delete <span className="font-semibold text-foreground">{product.name}</span>? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition">Cancel</button>
            <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition">Delete</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BarcodeModal({ product, onClose }: { product: ProductWithStock; onClose: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, product.sku, {
          format: 'CODE128',
          width: 2,
          height: 80,
          displayValue: true,
          fontSize: 14,
          margin: 10,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (e) {
        console.error('Barcode generation error:', e);
      }
    }
  }, [product.sku]);

  function handlePrint() {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const svgHTML = new XMLSerializer().serializeToString(svgEl);
    const w = window.open('', '_blank', 'width=500,height=350');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Barcode - ${product.sku}</title></head><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;font-family:sans-serif;margin:0"><p style="margin:0 0 4px;font-size:13px;font-weight:600">${product.name}</p><p style="margin:0 0 12px;font-size:11px;color:#666">SKU: ${product.sku}</p>${svgHTML}<script>window.onload=function(){window.print();setTimeout(function(){window.close();},500);}<\/script></body></html>`);
    w.document.close();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold">Product Barcode</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 flex flex-col items-center">
          <p className="text-sm font-semibold text-foreground mb-0.5">{product.name}</p>
          <p className="text-xs text-muted-foreground mb-4">SKU: {product.sku}</p>
          <div className="border border-border rounded-lg p-4 bg-white w-full flex justify-center">
            <svg ref={svgRef} />
          </div>
          <button
            onClick={handlePrint}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition"
          >
            <Printer className="w-4 h-4" />Print Barcode
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageCatalogModal({ categories, brands, onClose, onSaved }: {
  categories: Category[];
  brands: Brand[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<'categories' | 'brands'>('categories');
  const [newName, setNewName] = useState('');
  const [parentCategory, setParentCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const parentCategories = categories.filter(c => !c.parent_id);
  const subCategories = categories.filter(c => c.parent_id);

  function getSubCategories(parentId: string) {
    return subCategories.filter(sc => sc.parent_id === parentId);
  }

  function toggleCategory(id: string) {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCategories(newExpanded);
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    const table = tab === 'categories' ? 'categories' : 'brands';
    const insertData: any = { name: newName.trim(), is_active: true, slug: newName.trim().toLowerCase().replace(/\s+/g, '-') };
    if (tab === 'categories' && parentCategory) {
      insertData.parent_id = parentCategory;
    }
    const { error } = await supabase.from(table).insert(insertData);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `${tab === 'categories' ? 'Category' : 'Brand'} added` });
      setNewName('');
      setParentCategory('');
      onSaved();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const table = tab === 'categories' ? 'categories' : 'brands';
    const { error } = await supabase.from(table).update({ is_active: false }).eq('id', id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `${tab === 'categories' ? 'Category' : 'Brand'} deleted` });
      onSaved();
    }
  }

  const items = tab === 'categories' ? parentCategories : brands;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-bold">Manage Catalog</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex border-b border-border">
          <button
            onClick={() => { setTab('categories'); setNewName(''); setParentCategory(''); }}
            className={`flex-1 py-3 text-sm font-medium transition ${tab === 'categories' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Categories ({categories.length})
          </button>
          <button
            onClick={() => { setTab('brands'); setNewName(''); }}
            className={`flex-1 py-3 text-sm font-medium transition ${tab === 'brands' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Brands ({brands.length})
          </button>
        </div>
        <div className="p-4">
          <div className="space-y-2 mb-4">
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder={`New ${tab === 'categories' ? 'category' : 'brand'} name...`}
                className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                onClick={handleAdd}
                disabled={saving || !newName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {tab === 'categories' && (
              <select
                value={parentCategory}
                onChange={e => setParentCategory(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
              >
                <option value="">Top-level category</option>
                {parentCategories.map(c => (
                  <option key={c.id} value={c.id}>Sub-category of: {c.name}</option>
                ))}
              </select>
            )}
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">No {tab} added yet. Add one above.</p>
            ) : tab === 'categories' ? (
              parentCategories.map(cat => {
                const subs = getSubCategories(cat.id);
                const isExpanded = expandedCategories.has(cat.id);
                return (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 group">
                      <div className="flex items-center gap-2">
                        {subs.length > 0 && (
                          <button onClick={() => toggleCategory(cat.id)} className="text-muted-foreground hover:text-foreground">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <span className="text-sm text-foreground font-medium">{cat.name}</span>
                        {subs.length > 0 && <span className="text-xs text-muted-foreground">({subs.length})</span>}
                      </div>
                      <button
                        onClick={() => handleDelete(cat.id)}
                        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {isExpanded && subs.length > 0 && (
                      <div className="ml-6 space-y-1 border-l border-border pl-2">
                        {subs.map(sub => (
                          <div key={sub.id} className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-muted/50 group">
                            <span className="text-sm text-muted-foreground">{sub.name}</span>
                            <button
                              onClick={() => handleDelete(sub.id)}
                              className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              brands.map(item => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/50 group">
                  <span className="text-sm text-foreground">{item.name}</span>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
