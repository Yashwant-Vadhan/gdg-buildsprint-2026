import { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { supabase } from '../../lib/supabaseClient';

export default function WalletLog() {
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase
      .from('wallet_semester_credits')
      .select('*, users(name, roll_no)')
      .order('credited_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err);
        else setCredits(data ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Semester Credit History</h1>

      {loading && <p className="text-gray-500">Loading…</p>}
      {error && <p className="text-danger">Failed to load: {error.message}</p>}

      <div className="space-y-2">
        {credits.map((credit) => (
          <Card key={credit.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                {credit.users?.name} ({credit.users?.roll_no})
              </p>
              <p className="text-sm text-gray-500">
                Semester {credit.semester} · {new Date(credit.credited_at).toLocaleString()}
              </p>
            </div>
            <p className="font-semibold">₹{Number(credit.amount).toFixed(2)}</p>
          </Card>
        ))}
        {!loading && credits.length === 0 && (
          <p className="text-gray-500">No credits issued yet.</p>
        )}
      </div>
    </div>
  );
}
