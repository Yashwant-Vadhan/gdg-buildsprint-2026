import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { Receipt } from 'lucide-react';

function monthKey(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function PaymentsView() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('payments')
      .select('*')
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRows(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
    <div className="space-y-6 text-left">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase m-0">Payments</h1>
        <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-wider">Turnover by Service</p>
      </div>

      {loading ? (
        <div className="h-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
      ) : months.length === 0 ? (
        <div className="glass-panel text-center flex flex-col items-center">
          <Receipt className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-xs text-slate-500">No successful payments recorded yet.</p>
        </div>
      ) : (
        <div className="glass-panel overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b border-slate-200 dark:border-slate-800">
                <th className="py-2 pr-4 font-black uppercase tracking-wider text-slate-400">Month</th>
                {serviceList.map((s) => (
                  <th key={s} className="py-2 pr-4 font-black uppercase tracking-wider text-slate-400">{s.replace('_', ' ')}</th>
                ))}
                <th className="py-2 font-black uppercase tracking-wider text-slate-400">Total</th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => {
                const rowTotal = serviceList.reduce((sum, s) => sum + (summary[month][s] ?? 0), 0);
                return (
                  <tr key={month} className="border-b border-slate-100 dark:border-slate-800/50">
                    <td className="py-2 pr-4 font-bold text-slate-700 dark:text-slate-200">{month}</td>
                    {serviceList.map((s) => (
                      <td key={s} className="py-2 pr-4 text-slate-600 dark:text-slate-300">₹{(summary[month][s] ?? 0).toFixed(2)}</td>
                    ))}
                    <td className="py-2 font-black text-slate-800 dark:text-slate-100">₹{rowTotal.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
