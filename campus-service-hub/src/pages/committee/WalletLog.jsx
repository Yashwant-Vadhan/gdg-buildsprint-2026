import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { History } from 'lucide-react';

export default function WalletLog() {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('wallet_semester_credits')
      .select('*, users(name, roll_no)')
      .order('credited_at', { ascending: false })
      .then(({ data }) => {
        setCredits(data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 text-left">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase m-0">Wallet Log</h1>
        <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-wider">Semester Credit History</p>
      </div>

      {loading ? (
        <div className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
      ) : credits.length === 0 ? (
        <div className="glass-panel text-center flex flex-col items-center">
          <History className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-xs text-slate-500">No credits issued yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {credits.map((credit) => (
            <div key={credit.id} className="glass-card flex items-center justify-between">
              <div>
                <p className="text-sm font-black uppercase text-slate-800 dark:text-slate-100">
                  {credit.users?.name} <span className="text-slate-400 font-bold">({credit.users?.roll_no})</span>
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Semester {credit.semester} · {new Date(credit.credited_at).toLocaleString()}
                </p>
              </div>
              <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">₹{Number(credit.amount).toFixed(2)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
