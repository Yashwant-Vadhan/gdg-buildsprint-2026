import { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { supabase } from '../../lib/supabaseClient';

function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function PaymentsView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from('payments')
      .select('*')
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err);
        else setRows(data ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, []);

  // { [month]: { [service]: total } }
  const summary = {};
  const services = new Set();
  for (const row of rows) {
    const month = monthKey(row.created_at);
    services.add(row.service);
    summary[month] = summary[month] ?? {};
    summary[month][row.service] = (summary[month][row.service] ?? 0) + Number(row.amount);
  }
  const months = Object.keys(summary).sort().reverse();
  const serviceList = Array.from(services).sort();

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Payments — Turnover by Service</h1>

      {loading && <p className="text-gray-500">Loading…</p>}
      {error && <p className="text-danger">Failed to load payments: {error.message}</p>}

      {!loading && !error && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200">
                <th className="py-2 pr-4">Month</th>
                {serviceList.map((s) => (
                  <th key={s} className="py-2 pr-4 capitalize">{s.replace('_', ' ')}</th>
                ))}
                <th className="py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => {
                const rowTotal = serviceList.reduce((sum, s) => sum + (summary[month][s] ?? 0), 0);
                return (
                  <tr key={month} className="border-b border-gray-100">
                    <td className="py-2 pr-4">{month}</td>
                    {serviceList.map((s) => (
                      <td key={s} className="py-2 pr-4">₹{(summary[month][s] ?? 0).toFixed(2)}</td>
                    ))}
                    <td className="py-2 font-medium">₹{rowTotal.toFixed(2)}</td>
                  </tr>
                );
              })}
              {months.length === 0 && (
                <tr>
                  <td colSpan={serviceList.length + 2} className="py-4 text-gray-500 text-center">
                    No successful payments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
