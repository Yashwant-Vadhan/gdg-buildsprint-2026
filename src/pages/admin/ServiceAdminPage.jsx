import { useEffect, useMemo, useState } from 'react';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import QRScanner from '../../components/QRScanner';
import Skeleton from '../../components/Skeleton';
import Toast from '../../components/Toast';
import { supabase } from '../../lib/supabaseClient';
import { useRealtimeOrders } from '../../hooks/useRealtimeOrders';

const STATUS_TONE = {
  Received: 'neutral',
  Preparing: 'warning',
  Ready: 'success',
  Collected: 'neutral',
};

const LOW_STOCK_THRESHOLD = 5;
const TICK_INTERVAL_MS = 30_000;

const EMPTY_ITEM = { name: '', price: '', quantity_available: '', is_available: true };

function elapsedLabel(fromIso) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(fromIso).getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ago`;
}

function StatCard({ label, value, tone = 'neutral' }) {
  const toneClass = {
    neutral: 'text-gray-900',
    warning: 'text-warning',
    danger: 'text-danger',
  }[tone];
  return (
    <Card className="flex-1 min-w-[120px] text-center py-3">
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </Card>
  );
}

/**
 * Shared Canteen/Store admin page: menu CRUD + live order queue + QR pickup scanner.
 * DESIGN.md specifies Store as "same structural pattern as Canteen" — configured here
 * instead of duplicated.
 */
export default function ServiceAdminPage({
  label,
  itemsTable,
  ordersTable,
  statusFlow,
  itemFields,
  verifyFunctionName,
}) {
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [itemsError, setItemsError] = useState(null);
  const [newItem, setNewItem] = useState(EMPTY_ITEM);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [, setTick] = useState(0);

  const terminalStatus = statusFlow[statusFlow.length - 1];
  const activeStatuses = statusFlow.slice(0, -1);

  const { orders, loading: ordersLoading, error: ordersError } = useRealtimeOrders(ordersTable, {
    excludeStatuses: [terminalStatus],
  });

  // Re-render periodically so "Xm ago" elapsed-time labels stay live.
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), TICK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const itemsById = useMemo(() => {
    const map = {};
    items.forEach((item) => { map[item.id] = item; });
    return map;
  }, [items]);

  const lowStockCount = useMemo(
    () => items.filter((item) => item.quantity_available <= LOW_STOCK_THRESHOLD).length,
    [items]
  );
  const readyCount = orders.filter((o) => o.status === statusFlow[statusFlow.length - 2]).length;

  const loadItems = async () => {
    setItemsLoading(true);
    try {
      const { data, error } = await supabase.from(itemsTable).select('*').order('name');
      if (error) {
        setItemsError(error);
      } else {
        setItems(data ?? []);
        setItemsError(null);
      }
    } catch (error) {
      setItemsError(error);
    }
    setItemsLoading(false);
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddItem = async (e) => {
    e.preventDefault();
    const payload = {};
    for (const field of itemFields) {
      const raw = newItem[field.key];
      payload[field.key] = field.type === 'number' ? Number(raw) || 0 : field.type === 'boolean' ? Boolean(raw) : raw;
    }
    const { error } = await supabase.from(itemsTable).insert(payload);
    if (!error) {
      setNewItem(EMPTY_ITEM);
      setToast({ tone: 'success', message: `${payload.name || 'Item'} added to menu.` });
      loadItems();
    } else {
      setToast({ tone: 'danger', message: `Failed to add item: ${error.message}` });
    }
  };

  const handleUpdateItem = async (id, field, value) => {
    const { error } = await supabase.from(itemsTable).update({ [field]: value }).eq('id', id);
    if (error) {
      setToast({ tone: 'danger', message: `Failed to update: ${error.message}` });
    }
    loadItems();
  };

  const handleRemoveItem = async (item) => {
    const { error } = await supabase.from(itemsTable).delete().eq('id', item.id);
    if (error) {
      setToast({ tone: 'danger', message: `Failed to remove: ${error.message}` });
    } else {
      setToast({ tone: 'success', message: `${item.name} removed.` });
    }
    loadItems();
  };

  const handleAdvanceStatus = async (order) => {
    const currentIndex = statusFlow.indexOf(order.status);
    const nextStatus = statusFlow[currentIndex + 1];
    if (!nextStatus) return;
    const { error } = await supabase.from(ordersTable).update({ status: nextStatus }).eq('id', order.id);
    if (error) {
      setToast({ tone: 'danger', message: `Failed to update order: ${error.message}` });
    }
  };

  const handleScan = async (decodedText) => {
    if (scanBusy) return;
    setScanBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(verifyFunctionName, {
        body: { qrPayload: decodedText },
      });
      if (error) {
        setScanResult({ tone: 'danger', message: error.message || 'Scan failed' });
      } else if (!data?.success) {
        const already = data?.error?.toLowerCase().includes('already');
        setScanResult({
          tone: already ? 'warning' : 'danger',
          message: data?.error || 'Invalid QR',
        });
      } else {
        setScanResult({ tone: 'success', message: 'Verified — marked collected.' });
      }
    } catch (err) {
      setScanResult({ tone: 'danger', message: err.message || 'Scan failed' });
    } finally {
      setScanBusy(false);
    }
  };

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{label} — Admin</h1>
        <Button onClick={() => { setScanResult(null); setScannerOpen(true); }}>Scan QR</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <StatCard label="Active Orders" value={orders.length} />
        <StatCard label="Ready Now" value={readyCount} tone={readyCount > 0 ? 'warning' : 'neutral'} />
        <StatCard label="Low Stock Items" value={lowStockCount} tone={lowStockCount > 0 ? 'danger' : 'neutral'} />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-2">Order Queue</h2>
        {ordersError && <p className="text-danger mb-2">Failed to load orders: {ordersError.message}</p>}

        {ordersLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {activeStatuses.map((status) => (
              <Skeleton key={status} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {activeStatuses.map((status) => {
              const columnOrders = orders.filter((o) => o.status === status);
              return (
                <div key={status} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{status}</Badge>
                    <span className="text-xs text-gray-400">{columnOrders.length}</span>
                  </div>
                  {columnOrders.map((order) => {
                    const overdue = order.estimated_ready_at && new Date(order.estimated_ready_at) < new Date();
                    const nextStatus = statusFlow[statusFlow.indexOf(order.status) + 1];
                    return (
                      <Card key={order.id} className={overdue ? 'border-danger' : ''}>
                        <p className="font-medium">Token #{order.token_no ?? order.id.slice(0, 8)}</p>
                        <p className="text-sm text-gray-600">
                          {itemsById[order.item_id]?.name ?? 'Item'} · Qty {order.qty}
                        </p>
                        <p className={`text-xs mt-1 ${overdue ? 'text-danger font-medium' : 'text-gray-400'}`}>
                          {overdue ? 'Overdue — ' : ''}ordered {elapsedLabel(order.ordered_at)}
                        </p>
                        {nextStatus && (
                          <Button
                            variant="secondary"
                            className="mt-2 w-full"
                            onClick={() => handleAdvanceStatus(order)}
                          >
                            Mark {nextStatus}
                          </Button>
                        )}
                      </Card>
                    );
                  })}
                  {columnOrders.length === 0 && (
                    <p className="text-sm text-gray-400 italic">No orders</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Menu</h2>
        {itemsError && <p className="text-danger mb-2">Failed to load menu: {itemsError.message}</p>}

        {itemsLoading ? (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {items.map((item) => {
              const outOfStock = item.quantity_available <= 0;
              const lowStock = !outOfStock && item.quantity_available <= LOW_STOCK_THRESHOLD;
              return (
                <Card key={item.id}>
                  <div className="flex items-start justify-between">
                    <p className="font-medium">{item.name}</p>
                    {outOfStock && <Badge tone="danger">Out of stock</Badge>}
                    {lowStock && <Badge tone="warning">Low stock</Badge>}
                  </div>
                  <label className="flex items-center gap-2 text-sm mt-2">
                    Price ₹
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => handleUpdateItem(item.id, 'price', Number(e.target.value))}
                      className="w-20 min-h-[36px] border border-gray-300 rounded px-2 py-1"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm mt-2">
                    Qty
                    <input
                      type="number"
                      value={item.quantity_available}
                      onChange={(e) => handleUpdateItem(item.id, 'quantity_available', Number(e.target.value))}
                      className="w-20 min-h-[36px] border border-gray-300 rounded px-2 py-1"
                    />
                  </label>
                  <div className="flex items-center justify-between mt-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.is_available}
                        onChange={(e) => handleUpdateItem(item.id, 'is_available', e.target.checked)}
                      />
                      Available
                    </label>
                    <button
                      onClick={() => handleRemoveItem(item)}
                      className="text-xs text-danger hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="mt-3">
          <h3 className="font-medium mb-3">Add Item</h3>
          <form onSubmit={handleAddItem} className="grid gap-3 sm:grid-cols-3 md:grid-cols-4">
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
                    <label htmlFor={`new-${field.key}`} className="text-sm">{field.label}</label>
                  </>
                ) : (
                  <>
                    <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={newItem[field.key] ?? ''}
                      onChange={(e) => setNewItem((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="w-full min-h-[44px] border border-gray-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </>
                )}
              </div>
            ))}
            <div className="flex items-end">
              <Button type="submit" className="w-full">Add Item</Button>
            </div>
          </form>
        </Card>
      </section>

      <Modal open={scannerOpen} onClose={() => setScannerOpen(false)} title="Scan pickup QR">
        {scanResult && (
          <div
            className={`mb-3 rounded-lg p-3 text-sm ${
              scanResult.tone === 'success'
                ? 'bg-green-100 text-success'
                : scanResult.tone === 'warning'
                ? 'bg-amber-100 text-warning'
                : 'bg-red-100 text-danger'
            }`}
          >
            {scanResult.message}
          </div>
        )}
        {scannerOpen && <QRScanner onScan={handleScan} onError={(err) => setScanResult({ tone: 'danger', message: err.message })} />}
      </Modal>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
