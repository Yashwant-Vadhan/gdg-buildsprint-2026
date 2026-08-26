import React, { useEffect, useState } from 'react';
import { supabase, isMockMode } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { CheckCircle, XCircle, FileText } from 'lucide-react';

const SEMESTER_CREDIT_AMOUNT = 2000;

export default function ReceiptsQueue() {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [errorById, setErrorById] = useState({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('fee_receipts')
      .select('*, users(name, roll_no)')
      .eq('status', 'pending')
      .order('uploaded_at', { ascending: true });
    setReceipts(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (isMockMode) return undefined;
    const channel = supabase
      .channel('committee:fee_receipts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_receipts' }, load)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const handleApprove = async (receipt) => {
    setBusyId(receipt.id);
    setErrorById((prev) => ({ ...prev, [receipt.id]: null }));

    const { error: rpcError } = await supabase.rpc('credit_wallet_once_per_semester', {
      p_user_id: receipt.user_id,
      p_semester: receipt.semester,
      p_amount: SEMESTER_CREDIT_AMOUNT,
      p_receipt_id: receipt.id,
    });

    if (rpcError) {
      setErrorById((prev) => ({ ...prev, [receipt.id]: rpcError.message }));
      setBusyId(null);
      return;
    }

    await supabase
      .from('fee_receipts')
      .update({ status: 'approved', reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', receipt.id);

    setBusyId(null);
    load();
  };

  const handleReject = async (receipt) => {
    setBusyId(receipt.id);
    await supabase
      .from('fee_receipts')
      .update({ status: 'rejected', reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', receipt.id);
    setBusyId(null);
    load();
  };

  return (
    <div className="space-y-6 text-left">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase m-0">Fee Receipts</h1>
        <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-wider">Pending Semester Credit Approvals</p>
      </div>

      {loading ? (
        <div className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse" />
      ) : receipts.length === 0 ? (
        <div className="glass-panel text-center flex flex-col items-center">
          <FileText className="w-8 h-8 text-slate-400 mb-2" />
          <p className="text-xs text-slate-500">No pending receipts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {receipts.map((receipt) => (
            <div key={receipt.id} className="glass-card">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black uppercase text-slate-800 dark:text-slate-100">
                    {receipt.users?.name} <span className="text-slate-400 font-bold">({receipt.users?.roll_no})</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Semester {receipt.semester} · uploaded {new Date(receipt.uploaded_at).toLocaleDateString()}
                  </p>
                  <a href={receipt.receipt_file_url} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-indigo-400 text-[11px] font-bold underline">
                    View receipt
                  </a>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    disabled={busyId === receipt.id}
                    onClick={() => handleApprove(receipt)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    disabled={busyId === receipt.id}
                    onClick={() => handleReject(receipt)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
              {errorById[receipt.id] && (
                <p className="text-red-600 text-[11px] font-bold mt-2">{errorById[receipt.id]}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
