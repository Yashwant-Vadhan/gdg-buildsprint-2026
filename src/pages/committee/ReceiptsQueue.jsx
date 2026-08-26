import { useEffect, useState } from 'react';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';

const SEMESTER_CREDIT_AMOUNT = 2000;

export default function ReceiptsQueue() {
  const { user } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [errorById, setErrorById] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('fee_receipts')
        .select('*, users(name, roll_no)')
        .eq('status', 'pending')
        .order('uploaded_at', { ascending: true });
      if (error) setLoadError(error);
      else {
        setReceipts(data ?? []);
        setLoadError(null);
      }
    } catch (error) {
      setLoadError(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel('realtime:fee_receipts')
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
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Pending Fee Receipts</h1>

      {loading && <p className="text-gray-500">Loading…</p>}
      {loadError && <p className="text-danger">Failed to load receipts: {loadError.message}</p>}

      <div className="space-y-2">
        {receipts.map((receipt) => (
          <Card key={receipt.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium">
                  {receipt.users?.name} ({receipt.users?.roll_no})
                </p>
                <p className="text-sm text-gray-500">
                  Semester {receipt.semester} · uploaded {new Date(receipt.uploaded_at).toLocaleDateString()}
                </p>
                <a
                  href={receipt.receipt_file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary text-sm underline"
                >
                  View receipt
                </a>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="success"
                  disabled={busyId === receipt.id}
                  onClick={() => handleApprove(receipt)}
                >
                  Approve
                </Button>
                <Button
                  variant="danger"
                  disabled={busyId === receipt.id}
                  onClick={() => handleReject(receipt)}
                >
                  Reject
                </Button>
              </div>
            </div>
            {errorById[receipt.id] && (
              <p className="text-danger text-sm mt-2">{errorById[receipt.id]}</p>
            )}
          </Card>
        ))}
        {!loading && receipts.length === 0 && (
          <p className="text-gray-500">No pending receipts.</p>
        )}
      </div>
    </div>
  );
}
