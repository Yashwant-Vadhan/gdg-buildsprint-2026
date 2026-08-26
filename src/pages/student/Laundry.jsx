import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isMockMode } from '../../lib/supabaseClient';
import { WashingMachine, CreditCard, ShieldCheck, RefreshCw, Clock, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

const LAUNDRY_SERVICES = [
  { id: 'l1', name: 'wash_only', displayName: 'Wash Only', price: 20.00, est_duration_min: 60 },
  { id: 'l2', name: 'wash_dry', displayName: 'Wash & Dry', price: 30.00, est_duration_min: 90 },
  { id: 'l3', name: 'wash_dry_iron', displayName: 'Wash, Dry & Iron', price: 45.00, est_duration_min: 120 },
  { id: 'l4', name: 'iron_only', displayName: 'Iron Only', price: 15.00, est_duration_min: 30 }
];

export default function Laundry() {
  const { profile: user } = useAuth();
  const [selectedService, setSelectedService] = useState(LAUNDRY_SERVICES[0]);
  const [walletBalance, setWalletBalance] = useState(0.00);
  const [activeOrders, setActiveOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchWalletBalance();
    fetchLaundryOrders();

    if (!isMockMode) {
      const balanceSub = supabase
        .channel('wallet_balance_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` }, () => {
          fetchWalletBalance();
        })
        .subscribe();

      const laundrySub = supabase
        .channel('laundry_orders_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'laundry_orders', filter: `user_id=eq.${user.id}` }, () => {
          fetchLaundryOrders();
        })
        .subscribe();

      return () => {
        balanceSub.unsubscribe();
        laundrySub.unsubscribe();
      };
    }
  }, []);

  const fetchWalletBalance = async () => {
    try {
      if (isMockMode) {
        const bal = parseFloat(localStorage.getItem(`wallet_balance_${user.id}`) || '0.00');
        setWalletBalance(bal);
        return;
      }
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      setWalletBalance(parseFloat(data.balance));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLaundryOrders = async () => {
    setLoading(true);
    try {
      if (isMockMode) {
        const stored = JSON.parse(localStorage.getItem(`laundry_orders_${user.id}`) || '[]');
        setActiveOrders(stored);
        return;
      }
      const { data, error } = await supabase
        .from('laundry_orders')
        .select('*, laundry_services(*)')
        .eq('user_id', user.id)
        .order('registered_at', { ascending: false });
      if (error) throw error;
      setActiveOrders(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterLaundry = async () => {
    if (walletBalance < selectedService.price) {
      setMessage({ text: 'Insufficient wallet balance. Top up at wallet desk.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setMessage({ text: '', type: '' });

    try {
      if (isMockMode) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const newBalance = walletBalance - selectedService.price;
        localStorage.setItem(`wallet_balance_${user.id}`, newBalance.toFixed(2));
        setWalletBalance(newBalance);

        // Add transaction ledger log
        const txnId = 'txn-' + Math.floor(100000 + Math.random() * 900000);
        const storedTxns = JSON.parse(localStorage.getItem(`wallet_transactions_${user.id}`) || '[]');
        storedTxns.unshift({
          id: txnId,
          service: 'laundry',
          amount: selectedService.price,
          method: 'wallet',
          created_at: new Date().toISOString()
        });
        localStorage.setItem(`wallet_transactions_${user.id}`, JSON.stringify(storedTxns));

        // Create laundry order
        const newOrder = {
          id: 'laundry-' + Math.floor(100000 + Math.random() * 900000),
          user_id: user.id,
          service_id: selectedService.id,
          amount: selectedService.price,
          status: 'Registered',
          registered_at: new Date().toISOString(),
          estimated_ready_at: new Date(Date.now() + selectedService.est_duration_min * 60000).toISOString(),
          laundry_services: selectedService
        };
        const storedOrders = JSON.parse(localStorage.getItem(`laundry_orders_${user.id}`) || '[]');
        storedOrders.unshift(newOrder);
        localStorage.setItem(`laundry_orders_${user.id}`, JSON.stringify(storedOrders));
        setActiveOrders(storedOrders);

        setMessage({ text: 'Laundry bag registered successfully!', type: 'success' });
        return;
      }

      // Live mode debit and insert via RPC/Transactions
      const { data: walletData, error: walletErr } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (walletErr) throw walletErr;

      const { data: newBalance, error: debitError } = await supabase.rpc('debit_wallet', {
        p_wallet_id: walletData.id,
        p_amount: selectedService.price
      });
      if (debitError) throw debitError;

      const { error: insertErr } = await supabase
        .from('laundry_orders')
        .insert({
          user_id: user.id,
          service_id: selectedService.id,
          amount: selectedService.price,
          status: 'Registered',
          estimated_ready_at: new Date(Date.now() + selectedService.est_duration_min * 60000).toISOString()
        });
      if (insertErr) throw insertErr;

      setMessage({ text: 'Laundry bag registered successfully!', type: 'success' });
      fetchWalletBalance();
      fetchLaundryOrders();

    } catch (err) {
      console.error(err);
      setMessage({ text: err.message || 'Transaction failed. Please try again.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const getFilteredSteps = (serviceName) => {
    const base = ['Registered', 'Collected', 'Washing'];
    if (serviceName === 'wash_only') return [...base, 'Ready', 'Delivered'];
    if (serviceName === 'wash_dry') return [...base, 'Drying', 'Ready', 'Delivered'];
    return [...base, 'Drying', 'Ironing', 'Ready', 'Delivered'];
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left pb-10">
      
      {/* Left Column */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm text-slate-800 dark:text-slate-100">
          
          <h2 className="text-xl font-black text-neutral-850 dark:text-slate-105 m-0 flex items-center gap-2 uppercase tracking-tight">
            <WashingMachine className="w-5 h-5 text-brand" /> Laundry dispatch
          </h2>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1 font-bold uppercase tracking-wider">Fast-turnaround washing, drying & ironing request</p>

          {message.text && (
            <div className={`p-3 rounded-lg border text-xs font-bold flex gap-2.5 mt-4 ${
              message.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border border-brand-light text-brand'
            }`}>
              <span className="w-4 h-4 shrink-0">⚠</span>
              <span>{message.text}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
            {/* Service Select Cards */}
            <div className="space-y-2">
              <label className="block text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-2">Service Selection</label>
              {LAUNDRY_SERVICES.map((service) => (
                <button
                  key={service.id}
                  onClick={() => setSelectedService(service)}
                  className={`w-full p-3.5 rounded-xl border text-left transition-all flex justify-between items-center cursor-pointer text-xs ${
                    selectedService.id === service.id
                      ? 'border-brand bg-brand-light text-neutral-900 font-black'
                      : 'border-neutral-200 dark:border-slate-805 bg-white dark:bg-slate-850 text-neutral-550 dark:text-slate-400 hover:border-neutral-350 dark:hover:border-slate-700'
                  }`}
                >
                  <div>
                    <p className="font-bold">{service.displayName}</p>
                    <p className="text-[9px] text-neutral-450 dark:text-slate-500 font-bold uppercase mt-0.5">Time: {service.est_duration_min} mins</p>
                  </div>
                  <span className="font-black text-brand">₹{service.price.toFixed(2)}</span>
                </button>
              ))}
            </div>

            {/* Review Summary */}
            <div className="bg-neutral-50 dark:bg-slate-850 border border-neutral-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <p className="text-[9px] text-neutral-500 dark:text-slate-400 uppercase font-black tracking-widest border-b border-neutral-200 dark:border-slate-850 pb-2">Order summary</p>
                <div className="space-y-2.5 mt-4 text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Service:</span>
                    <span className="text-neutral-800 dark:text-slate-100 font-black">{selectedService.displayName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Total charge:</span>
                    <span className="text-neutral-800 dark:text-slate-100 font-black">₹{selectedService.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold uppercase text-xs">
                    <span className="text-neutral-500">Card balance:</span>
                    <span className={`font-black ${walletBalance < selectedService.price ? 'text-brand' : 'text-neutral-700 dark:text-slate-300'}`}>
                      ₹{walletBalance.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={handleRegisterLaundry}
                  disabled={submitting}
                  className="w-full py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white rounded-xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer shadow-sm"
                >
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 shrink-0" /> Pay with wallet
                    </>
                  )}
                </button>
                
                <div className="flex items-center justify-center gap-1.5 text-[9px] text-neutral-400 font-black uppercase tracking-widest">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-700" /> Secure payment
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm text-slate-800 dark:text-slate-100">
          <div className="flex justify-between items-center border-b border-neutral-100 dark:border-slate-850 pb-2">
            <h2 className="text-sm font-black text-neutral-805 dark:text-slate-100 m-0 uppercase tracking-wider">Active bags</h2>
            <button onClick={fetchLaundryOrders} className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 rounded cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2.5 animate-pulse">
              <div className="h-14 bg-neutral-100 rounded"></div>
            </div>
          ) : activeOrders.length === 0 ? (
            <p className="text-xs text-neutral-450 italic font-semibold py-4 text-center">No active bags currently.</p>
          ) : (
            <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
              {activeOrders.map((order) => {
                const steps = getFilteredSteps(order.laundry_services?.name || 'wash_only');
                const currentIdx = steps.indexOf(order.status);
                return (
                  <div key={order.id} className="p-3.5 bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl text-xs space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-black text-neutral-800 dark:text-slate-105 uppercase tracking-tight">{order.laundry_services?.displayName || 'Service'}</p>
                        <p className="text-[9px] text-neutral-450 dark:text-slate-500 mt-0.5">ID: #{order.id.split('-').pop()}</p>
                      </div>
                      <span className="text-[9px] font-black text-brand bg-brand-light border border-brand-light px-2 py-0.5 rounded-lg uppercase tracking-wider">
                        {order.status}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-705">
                      <div className="flex justify-between text-[9px] text-slate-400 uppercase font-black">
                        <span>Progress</span>
                        <span>{Math.round(((currentIdx + 1) / steps.length) * 100)}%</span>
                      </div>
                      
                      {/* Live Tracker progress line */}
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-brand rounded-full transition-all duration-500"
                          style={{ width: `${((currentIdx + 1) / steps.length) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
