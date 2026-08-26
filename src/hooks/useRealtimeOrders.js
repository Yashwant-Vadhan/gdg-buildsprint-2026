import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Subscribes to a single orders table, optionally scoped to `status in excludeStatuses`
 * being excluded (e.g. hide already-Collected/Delivered orders from a live admin queue).
 * Per TECH_RULES "Realtime scope": one admin's service queue, never a global channel.
 */
export function useRealtimeOrders(table, { excludeStatuses = [] } = {}) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    let query = supabase.from(table).select('*').order('ordered_at', { ascending: true });
    if (excludeStatuses.length > 0) {
      query = query.not('status', 'in', `(${excludeStatuses.join(',')})`);
    }
    try {
      const { data, error: err } = await query;
      if (err) {
        setError(err);
      } else {
        setOrders(data ?? []);
        setError(null);
      }
    } catch (err) {
      setError(err);
    }
    setLoading(false);
  }, [table, excludeStatuses.join(',')]);

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel(`realtime:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, refresh]);

  return { orders, loading, error, refresh };
}
