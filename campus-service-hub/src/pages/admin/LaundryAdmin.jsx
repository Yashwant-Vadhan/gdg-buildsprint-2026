import React, { useEffect, useState } from 'react';
import { supabase, isMockMode } from '../../lib/supabaseClient';
import QRScannerModal from '../../components/QRScannerModal';
import { QrCode, RefreshCw } from 'lucide-react';
import { ACCENT_BY_ROLE } from '../../lib/adminTheme';

const accent = ACCENT_BY_ROLE.laundry_admin;

const STATUS_FLOW_BY_SERVICE = {
  wash_only: ['Registered', 'Collected', 'Washing', 'Ready', 'Delivered'],
  wash_dry: ['Registered', 'Collected', 'Washing', 'Drying', 'Ready', 'Delivered'],
  wash_dry_iron: ['Registered', 'Collected', 'Washing', 'Drying', 'Ironing', 'Ready', 'Delivered'],
  iron_only: ['Registered', 'Collected', 'Ironing', 'Ready', 'Delivered'],
};

const STATUS_BADGE = {
  Registered: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  Collected: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  Washing: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
  Drying: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
  Ironing: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
  Ready: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400',
};

export default function LaundryAdmin() {
  const [orders, setOrders] = useState([]);
  const [services, setServices] = useState({});
  const [loading, setLoading] = useState(true);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanBanner, setScanBanner] = useState(null);
  const [scanBusy, setScanBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: serviceRows }, { data: orderRows }] = await Promise.all([
        supabase.from('laundry_services').select('*'),
        supabase.from('laundry_orders').select('*').not('status', 'eq', 'Delivered').order('registered_at', { ascending: true }),
      ]);
      const byId = {};
      (serviceRows ?? []).forEach((s) => { byId[s.id] = s; });
      setServices(byId);
      setOrders(orderRows ?? []);
    } catch (err) {
      console.error('[LaundryAdmin] load failed', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    if (isMockMode) return undefined;
    const channel = supabase
      .channel('admin:laundry_orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'laundry_orders' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const flowFor = (order) => STATUS_FLOW_BY_SERVICE[services[order.service_id]?.name] ?? STATUS_FLOW_BY_SERVICE.wash_dry_iron;

  const handleAdvanceStatus = async (order) => {
    const flow = flowFor(order);
    const nextStatus = flow[flow.indexOf(order.status) + 1];
    if (!nextStatus) return;
    await supabase.from('laundry_orders').update({ status: nextStatus }).eq('id', order.id);
    load();
  };

  const handleScan = async (decodedText) => {
    if (scanBusy) return;
    setScanBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-order-qr', {
        body: { qr_string: decodedText, order_table: 'laundry_orders' },
      });
      if (error) {
        setScanBanner({ tone: 'danger', message: error.message || 'Scan failed' });
      } else if (!data?.success) {
        const already = data?.error?.toLowerCase().includes('already');
        setScanBanner({
          tone: already ? 'warning' : 'danger',
          message: already ? `Already delivered at ${data.collected_at}` : data?.error || 'Invalid QR',
        });
      } else {
        setScanBanner({ tone: 'success', message: data.message || 'Verified — marked delivered.' });
        load();
      }
    } catch (err) {
      setScanBanner({ tone: 'danger', message: err.message || 'Scan failed' });
    } finally {
      setScanBusy(false);
    }
  };

  return (
    <div className="space-y-6 text-left pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase m-0">Laundry Admin</h1>
          <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-wider">Wash · Dry · Iron Queue</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer">
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

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl" />)}
        </div>
      ) : orders.length === 0 ? (
        <p className="text-xs text-slate-500">No active laundry orders.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {orders.map((order) => {
            const flow = flowFor(order);
            const nextStatus = flow[flow.indexOf(order.status) + 1];
            return (
              <div key={order.id} className="glass-card">
                <p className="text-xs font-black uppercase text-slate-800 dark:text-slate-100">{services[order.service_id]?.name?.replace(/_/g, ' ') ?? 'Service'}</p>
                <p className="text-[11px] text-slate-500 mt-1">₹{order.amount} · registered {new Date(order.registered_at).toLocaleTimeString()}</p>
                <span className={`inline-block mt-2 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${STATUS_BADGE[order.status] ?? 'bg-slate-100 text-slate-600'}`}>
                  {order.status}
                </span>
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
        </div>
      )}

      <QRScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        banner={scanBanner}
        title="Scan delivery QR"
      />
    </div>
  );
}
