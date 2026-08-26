import React, { useEffect, useMemo, useState } from 'react';
import { supabase, isMockMode } from '../../lib/supabaseClient';
import QRScannerModal from '../../components/QRScannerModal';
import { QrCode, RefreshCw, AlertCircle, Plus } from 'lucide-react';
import { DEFAULT_ACCENT } from '../../lib/adminTheme';

const LOW_STOCK_THRESHOLD = 5;
const EMPTY_ITEM = { name: '', price: '', quantity_available: '', is_available: true };

function elapsedLabel(fromIso) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(fromIso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}

const STATUS_BADGE = {
  Received: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  Preparing: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
  Ready: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400',
};

/**
 * Shared Canteen/Store admin page: menu CRUD + live order queue + QR pickup scanner.
 * DESIGN.md specifies Store as "same structural pattern as Canteen" — configured here
 * instead of duplicated. Matches Sushil's StudentLayout visual language (theme-*, glass-card).
 */
export default function ServiceAdminPage({ label, itemsTable, ordersTable, statusFlow, itemFields, accent = DEFAULT_ACCENT }) {
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState(EMPTY_ITEM);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanBanner, setScanBanner] = useState(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [, setTick] = useState(0);

  const terminalStatus = statusFlow[statusFlow.length - 1];
  const activeStatuses = statusFlow.slice(0, -1);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: itemRows }, { data: orderRows }] = await Promise.all([
        supabase.from(itemsTable).select('*').order('name'),
        supabase.from(ordersTable).select('*').not('status', 'eq', terminalStatus).order('ordered_at', { ascending: true }),
      ]);
      setItems(itemRows ?? []);
      setOrders(orderRows ?? []);
    } catch (err) {
      console.error(`[ServiceAdminPage:${label}] load failed`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (isMockMode) return undefined;

    const channel = supabase
      .channel(`admin:${ordersTable}:${itemsTable}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: ordersTable }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: itemsTable }, load)
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsTable, ordersTable]);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const itemsById = useMemo(() => {
    const map = {};
    items.forEach((i) => { map[i.id] = i; });
    return map;
  }, [items]);

  const lowStockCount = items.filter((i) => i.quantity_available <= LOW_STOCK_THRESHOLD).length;
  const readyCount = orders.filter((o) => o.status === activeStatuses[activeStatuses.length - 1]).length;

  const handleAddItem = async (e) => {
    e.preventDefault();
    const payload = {};
    for (const field of itemFields) {
      const raw = newItem[field.key];
      payload[field.key] = field.type === 'number' ? Number(raw) || 0 : field.type === 'boolean' ? Boolean(raw) : raw;
    }
    const { error } = await supabase.from(itemsTable).insert(payload);
    if (!error) setNewItem(EMPTY_ITEM);
    load();
  };

  const handleUpdateItem = async (id, field, value) => {
    await supabase.from(itemsTable).update({ [field]: value }).eq('id', id);
    load();
  };

  const handleAdvanceStatus = async (order) => {
    const nextStatus = statusFlow[statusFlow.indexOf(order.status) + 1];
    if (!nextStatus) return;
    const { error } = await supabase.from(ordersTable).update({ status: nextStatus }).eq('id', order.id);
    if (error) {
      console.error('Failed to update order:', error.message);
    }
    load();
  };

  const handleScan = async (decodedText) => {
    if (scanBusy) return;
    setScanBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-order-qr', {
        body: { qr_string: decodedText, order_table: ordersTable },
      });
      if (error) {
        setScanBanner({ tone: 'danger', message: error.message || 'Scan failed' });
      } else if (!data?.success) {
        const already = data?.error?.toLowerCase().includes('already');
        setScanBanner({
          tone: already ? 'warning' : 'danger',
          message: already ? `Already collected at ${data.collected_at}` : data?.error || 'Invalid QR',
        });
      } else {
        setScanBanner({ tone: 'success', message: data.message || 'Verified — marked collected.' });
        load();
      }
    } catch (err) {
      setScanBanner({ tone: 'danger', message: err.message || 'Scan failed' });
    } finally {
      setScanBusy(false);
    }
  };

  return (
    <div className="space-y-6 text-left pb-24 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase m-0">{label} Admin</h1>
          <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-wider">Queue &amp; Stock Console</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setScanBanner(null); setScannerOpen(true); }}
            className={`flex items-center gap-2 px-4 py-2.5 ${accent.bg} ${accent.bgHover} text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all`}
          >
            <QrCode className="w-4 h-4" /> Scan QR
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card !p-4 text-center">
          <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{orders.length}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Active Orders</p>
        </div>
        <div className="glass-card !p-4 text-center">
          <p className={`text-2xl font-black ${readyCount > 0 ? accent.text : 'text-slate-800 dark:text-slate-100'}`}>{readyCount}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Ready Now</p>
        </div>
        <div className="glass-card !p-4 text-center">
          <p className={`text-2xl font-black ${lowStockCount > 0 ? 'text-amber-600' : 'text-slate-800 dark:text-slate-100'}`}>{lowStockCount}</p>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">Low Stock</p>
        </div>
      </div>

      {/* Order Queue */}
      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Order Queue</h2>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-3 animate-pulse">
            {activeStatuses.map((s) => <div key={s} className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {activeStatuses.map((status) => {
              const columnOrders = orders.filter((o) => o.status === status);
              return (
                <div key={status} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${STATUS_BADGE[status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {status}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">{columnOrders.length}</span>
                  </div>
                  {columnOrders.map((order) => {
                    const overdue = order.estimated_ready_at && new Date(order.estimated_ready_at) < new Date();
                    const nextStatus = statusFlow[statusFlow.indexOf(order.status) + 1];
                    return (
                      <div key={order.id} className={`glass-card !p-4 ${overdue ? 'border-red-400 dark:border-red-700' : ''}`}>
                        <p className="text-xs font-black uppercase text-slate-800 dark:text-slate-100">Token #{order.token_no ?? order.id.slice(0, 8)}</p>
                        <p className="text-[11px] text-slate-500 mt-1">{itemsById[order.item_id]?.name ?? 'Item'} · Qty {order.qty}</p>
                        <p className={`text-[10px] mt-1 font-bold uppercase ${overdue ? 'text-red-600' : 'text-slate-400'}`}>
                          {overdue ? 'Overdue — ' : ''}{elapsedLabel(order.ordered_at)}
                        </p>
                        {nextStatus && (
                          <button
                            onClick={() => handleAdvanceStatus(order)}
                            className={`mt-3 w-full py-2 bg-slate-100 dark:bg-slate-800 ${accent.bgHover} hover:text-white text-slate-700 dark:text-slate-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer`}
                          >
                            Mark {nextStatus}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {columnOrders.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic px-1">No orders</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Menu */}
      <section>
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Menu</h2>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="glass-panel text-center flex flex-col items-center">
            <AlertCircle className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-xs text-slate-500">No items yet — add one below.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {items.map((item) => {
              const outOfStock = item.quantity_available <= 0;
              const lowStock = !outOfStock && item.quantity_available <= LOW_STOCK_THRESHOLD;
              return (
                <div key={item.id} className="glass-card">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-black uppercase text-slate-800 dark:text-slate-100">{item.name}</p>
                    {outOfStock && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-red-50 dark:bg-red-950/30 text-red-600 shrink-0">Out</span>}
                    {lowStock && <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-700 shrink-0">Low</span>}
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                      ₹
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => handleUpdateItem(item.id, 'price', Number(e.target.value))}
                        className="w-16 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-100"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                      Qty
                      <input
                        type="number"
                        value={item.quantity_available}
                        onChange={(e) => handleUpdateItem(item.id, 'quantity_available', Number(e.target.value))}
                        className="w-16 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded px-2 py-1 text-slate-800 dark:text-slate-100"
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] font-bold text-slate-500 mt-3">
                    <input
                      type="checkbox"
                      checked={item.is_available}
                      onChange={(e) => handleUpdateItem(item.id, 'is_available', e.target.checked)}
                    />
                    Available
                  </label>
                </div>
              );
            })}
          </div>
        )}

        <form onSubmit={handleAddItem} className="glass-panel mt-3 grid gap-3 sm:grid-cols-3 md:grid-cols-4">
          {itemFields.map((field) => (
            <div key={field.key} className={field.type === 'boolean' ? 'flex items-center gap-2 pt-5' : ''}>
              {field.type === 'boolean' ? (
                <>
                  <input
                    id={`new-${field.key}`}
                    type="checkbox"
                    checked={Boolean(newItem[field.key])}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, [field.key]: e.target.checked }))}
                  />
                  <label htmlFor={`new-${field.key}`} className="text-xs font-bold text-slate-600 dark:text-slate-300">{field.label}</label>
                </>
              ) : (
                <>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{field.label}</label>
                  <input
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={newItem[field.key] ?? ''}
                    onChange={(e) => setNewItem((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className={`w-full py-2 px-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none ${accent.ring}`}
                  />
                </>
              )}
            </div>
          ))}
          <div className="flex items-end">
            <button
              type="submit"
              className={`w-full py-2.5 ${accent.bg} ${accent.bgHover} text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1`}
            >
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
          </div>
        </form>
      </section>

      <QRScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        banner={scanBanner}
        title={`Scan ${label.toLowerCase()} pickup QR`}
      />
    </div>
  );
}
