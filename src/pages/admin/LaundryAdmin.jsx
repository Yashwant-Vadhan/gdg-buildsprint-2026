import { useEffect, useState } from 'react';
import Card from '../../components/Card';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import Modal from '../../components/Modal';
import QRScanner from '../../components/QRScanner';
import { supabase } from '../../lib/supabaseClient';
import { useRealtimeOrders } from '../../hooks/useRealtimeOrders';

// Per PRD §Module: Laundry — skip sub-states the chosen service doesn't include.
const STATUS_FLOW_BY_SERVICE = {
  wash_only: ['Registered', 'Collected', 'Washing', 'Ready', 'Delivered'],
  wash_dry: ['Registered', 'Collected', 'Washing', 'Drying', 'Ready', 'Delivered'],
  wash_dry_iron: ['Registered', 'Collected', 'Washing', 'Drying', 'Ironing', 'Ready', 'Delivered'],
  iron_only: ['Registered', 'Collected', 'Ironing', 'Ready', 'Delivered'],
};

const STATUS_TONE = {
  Registered: 'neutral',
  Collected: 'neutral',
  Washing: 'warning',
  Drying: 'warning',
  Ironing: 'warning',
  Ready: 'success',
  Delivered: 'neutral',
};

export default function LaundryAdmin() {
  const [services, setServices] = useState({});
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanBusy, setScanBusy] = useState(false);

  const { orders, loading, error } = useRealtimeOrders('laundry_orders', {
    excludeStatuses: ['Delivered'],
  });

  useEffect(() => {
    supabase
      .from('laundry_services')
      .select('*')
      .then(({ data }) => {
        const byId = {};
        (data ?? []).forEach((s) => { byId[s.id] = s; });
        setServices(byId);
      })
      .catch(() => {
        // fall back to STATUS_FLOW_BY_SERVICE default when services can't be loaded
      });
  }, []);

  const flowFor = (order) => {
    const serviceName = services[order.service_id]?.name;
    return STATUS_FLOW_BY_SERVICE[serviceName] ?? STATUS_FLOW_BY_SERVICE.wash_dry_iron;
  };

  const handleAdvanceStatus = async (order) => {
    const flow = flowFor(order);
    const nextStatus = flow[flow.indexOf(order.status) + 1];
    if (!nextStatus) return;
    await supabase.from('laundry_orders').update({ status: nextStatus }).eq('id', order.id);
  };

  const handleScan = async (decodedText) => {
    if (scanBusy) return;
    setScanBusy(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('verify-order-qr', {
        body: { qrPayload: decodedText },
      });
      if (fnError) {
        setScanResult({ tone: 'danger', message: fnError.message || 'Scan failed' });
      } else if (!data?.success) {
        const already = data?.error?.toLowerCase().includes('already');
        setScanResult({ tone: already ? 'warning' : 'danger', message: data?.error || 'Invalid QR' });
      } else {
        setScanResult({ tone: 'success', message: 'Verified — marked delivered.' });
      }
    } catch (err) {
      setScanResult({ tone: 'danger', message: err.message || 'Scan failed' });
    } finally {
      setScanBusy(false);
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Laundry — Admin</h1>
        <Button onClick={() => { setScanResult(null); setScannerOpen(true); }}>Scan QR</Button>
      </div>

      {loading && <p className="text-gray-500">Loading orders…</p>}
      {error && <p className="text-danger">Failed to load orders: {error.message}</p>}

      <div className="space-y-2">
        {orders.map((order) => {
          const flow = flowFor(order);
          const nextStatus = flow[flow.indexOf(order.status) + 1];
          return (
            <Card key={order.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{services[order.service_id]?.name ?? 'Service'}</p>
                <p className="text-sm text-gray-500">
                  ₹{order.amount} · registered {new Date(order.registered_at).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={STATUS_TONE[order.status] ?? 'neutral'}>{order.status}</Badge>
                {nextStatus && (
                  <Button variant="secondary" onClick={() => handleAdvanceStatus(order)}>
                    Mark {nextStatus}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
        {!loading && orders.length === 0 && <p className="text-gray-500">No active laundry orders.</p>}
      </div>

      <Modal open={scannerOpen} onClose={() => setScannerOpen(false)} title="Scan delivery QR">
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
        {scannerOpen && (
          <QRScanner onScan={handleScan} onError={(err) => setScanResult({ tone: 'danger', message: err.message })} />
        )}
      </Modal>
    </div>
  );
}
