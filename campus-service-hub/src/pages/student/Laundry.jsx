import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isMockMode } from '../../lib/supabaseClient';
import { WashingMachine, Clock, RefreshCw, AlertCircle, CreditCard, ShieldCheck } from 'lucide-react';

const LAUNDRY_SERVICES = [
  { id: 'l1', name: 'wash_only', displayName: 'Wash Only', price: 40.00, est_duration_min: 120 },
  { id: 'l2', name: 'wash_dry', displayName: 'Wash & Dry', price: 60.00, est_duration_min: 180 },
  { id: 'l3', name: 'wash_dry_iron', displayName: 'Wash, Dry & Iron', price: 80.00, est_duration_min: 240 },
  { id: 'l4', name: 'iron_only', displayName: 'Iron Only', price: 30.00, est_duration_min: 60 },
];

const FULL_STATUS_STEPS = ['Registered', 'Collected', 'Washing', 'Drying', 'Ironing', 'Ready', 'Delivered'];

export default function Laundry() {
  const { user } = useAuth();
  
  const [walletBalance, setWalletBalance] = useState(0.00);
  const [activeOrders, setActiveOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [selectedService, setSelectedService] = useState(LAUNDRY_SERVICES[0]);

  useEffect(() => {
    fetchWalletBalance();
    fetchLaundryOrders();
  }, []);

  const fetchWalletBalance = async () => {
    try {
      if (isMockMode) {
        const stored = localStorage.getItem(`wallet_balance_${user.id}`) || '1500.00';
        setWalletBalance(parseFloat(stored));
        return;
      }

      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setWalletBalance(data?.balance || 0.00);
    } catch (err) {
      console.error('Error fetching wallet balance:', err);
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
        .select(`
          *,
          laundry_services (*)
        `)
        .eq('user_id', user.id)
        .order('registered_at', { ascending: false });

      if (error) throw error;
      setActiveOrders(data || []);
    } catch (err) {
      console.error('Error fetching laundry orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterLaundry = async () => {
    const price = selectedService.price;

    if (walletBalance < price) {
      setMessage({ text: 'Insufficient wallet ledger balance. Please upload academic fee receipts to top-up.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setMessage({ text: '', type: '' });

    try {
      if (isMockMode) {
        await new Promise(resolve => setTimeout(resolve, 1500));

        const newBalance = walletBalance - price;
        setWalletBalance(newBalance);
        localStorage.setItem(`wallet_balance_${user.id}`, newBalance.toFixed(2));

        const storedTxns = JSON.parse(localStorage.getItem(`wallet_txns_${user.id}`) || '[]');
        const newTxn = {
          id: 'txn-' + Date.now(),
          service: 'laundry',
          amount: price,
          method: 'wallet',
          status: 'success',
          created_at: new Date().toISOString()
        };
        storedTxns.unshift(newTxn);
        localStorage.setItem(`wallet_txns_${user.id}`, JSON.stringify(storedTxns));

        const newOrder = {
          id: 'laundry-' + Math.floor(100000 + Math.random() * 900000),
          user_id: user.id,
          service_id: selectedService.id,
          amount: price,
          status: 'Registered',
          registered_at: new Date().toISOString(),
          estimated_ready_at: new Date(Date.now() + (selectedService.est_duration_min * 60000)).toISOString(),
          laundry_services: selectedService
        };

        const existingOrders = JSON.parse(localStorage.getItem(`laundry_orders_${user.id}`) || '[]');
        existingOrders.unshift(newOrder);
        localStorage.setItem(`laundry_orders_${user.id}`, JSON.stringify(existingOrders));
        setActiveOrders(existingOrders);

        setMessage({ text: 'Laundry dispatched successfully! Leave your items at the laundry bin.', type: 'success' });
        return;
      }

      const { data: newBal, error: debitErr } = await supabase.rpc('debit_wallet', {
        p_wallet_id: user.id,
        p_amount: price
      });

      if (debitErr) throw debitErr;

      const { error: orderErr } = await supabase
        .from('laundry_orders')
        .insert({
          user_id: user.id,
          service_id: selectedService.id,
          amount: price,
          status: 'Registered',
          estimated_ready_at: new Date(Date.now() + (selectedService.est_duration_min * 60000)).toISOString()
        });

      if (orderErr) throw orderErr;

      await supabase.from('payments').insert({
        user_id: user.id,
        service: 'laundry',
        amount: price,
        method: 'wallet',
        status: 'success'
      });

      setMessage({ text: 'Laundry order registered successfully!', type: 'success' });
      fetchWalletBalance();
      fetchLaundryOrders();

    } catch (err) {
      console.error('Laundry registration error:', err);
      setMessage({ text: err.message || 'Failed to submit order. Please try again.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const simulateStatusAdvance = (orderId) => {
    const updatedList = activeOrders.map(order => {
      if (order.id !== orderId) return order;

      const steps = getFilteredSteps(order.laundry_services.name);
      const currentIndex = steps.indexOf(order.status);
      if (currentIndex < steps.length - 1) {
        const nextStatus = steps[currentIndex + 1];
        return { 
          ...order, 
          status: nextStatus,
          delivered_at: nextStatus === 'Delivered' ? new Date().toISOString() : null
        };
      }
      return order;
    });

    localStorage.setItem(`laundry_orders_${user.id}`, JSON.stringify(updatedList));
    setActiveOrders(updatedList);
  };

  const getFilteredSteps = (serviceName) => {
    if (serviceName === 'wash_only') {
      return ['Registered', 'Collected', 'Washing', 'Ready', 'Delivered'];
    }
    if (serviceName === 'wash_dry') {
      return ['Registered', 'Collected', 'Washing', 'Drying', 'Ready', 'Delivered'];
    }
    if (serviceName === 'iron_only') {
      return ['Registered', 'Collected', 'Ironing', 'Ready', 'Delivered'];
    }
    return FULL_STATUS_STEPS;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left pb-10">
      
      {/* Left Column */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-neutral-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm text-slate-800 dark:text-slate-100">
          
          <h2 className="text-xl font-black text-neutral-850 dark:text-slate-100 m-0 flex items-center gap-2 uppercase tracking-tight">
            <WashingMachine className="w-5 h-5 text-brand" /> Laundry dispatch
          </h2>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-1 font-bold uppercase tracking-wider">Fast-turnaround washing, drying & ironing request</p>

          {message.text && (
            <div className={`p-3 rounded-lg border text-xs font-bold flex gap-2.5 mt-4 ${
              message.type === 'success'
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-red-50 border border-brand-light text-brand'
            }`}>
              <AlertCircle className="w-4 h-4 shrink-0" />
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
                      : 'border-neutral-200 dark:border-slate-800 bg-white dark:bg-slate-850 text-neutral-500 dark:text-slate-400 hover:border-neutral-350 dark:hover:border-slate-700'
                  }`}
                >
                  <div>
                    <p className="font-bold">{service.displayName}</p>
                    <p className="text-[9px] text-neutral-450 dark:text-slate-500 font-bold uppercase mt-0.5">Time: {service.est_duration_min} mins</p>
                  </div>
                  <span className="font-black text-brand">₹{service.price.toFixed(2)}</span>
                </button>
              ))}
            </div>            {/* Review Summary */}
            <div className="bg-neutral-55 dark:bg-slate-850 border border-neutral-200 dark:border-slate-800 p-5 rounded-2xl flex flex-col justify-between">
              <div>
                <p className="text-[9px] text-neutral-500 dark:text-slate-400 uppercase font-black tracking-widest border-b border-neutral-200 dark:border-slate-850 pb-2">Order summary</p>
                <div className="space-y-2.5 mt-4 text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span className="text-neutral-550">Service:</span>
                    <span className="text-neutral-800 dark:text-slate-100 font-black">{selectedService.displayName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-550">Total charge:</span>
                    <span className="text-neutral-800 dark:text-slate-100 font-black">₹{selectedService.price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold uppercase text-xs">
                    <span className="text-neutral-550">Card balance:</span>
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
                  <ShieldCheck className="w-3.5 h-3.5 text-green-750" /> Secure payment
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
            <h2 className="text-sm font-black text-neutral-800 dark:text-slate-100 m-0 uppercase tracking-wider">Active bags</h2>
            <button onClick={fetchLaundryOrders} className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 rounded cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-2.5 animate-pulse">
              <div className="h-14 bg-neutral-100 rounded"></div>
            </div>
          ) : activeOrders.length === 0 ? (
            <p className="text-xs text-neutral-450 italic font-black text-center py-6">No active bags listed.</p>
          ) : (
            <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
              {activeOrders.map((order) => {
                const steps = getFilteredSteps(order.laundry_services.name);
                const currentIdx = steps.indexOf(order.status);
                return (
                  <div key={order.id} className="p-3.5 bg-neutral-55 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 rounded-xl text-xs space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-black text-neutral-800 dark:text-slate-100 uppercase tracking-tight">{order.laundry_services.displayName}</p>
                        <p className="text-[9px] text-neutral-450 dark:text-slate-500 mt-0.5">ID: #{order.id.split('-').pop()}</p>
                      </div>
                      <span className="text-[9px] font-black text-brand bg-brand-light border border-brand-light px-2 py-0.5 rounded-lg uppercase tracking-wider">
                        {order.status}
                      </span>
                    </div>

                    {/* Progress steps bar */}
                    {order.status !== 'Delivered' && (
                      <div className="flex items-center gap-1 py-1">
                        {steps.map((step, sIdx) => (
                          <div key={step} className="flex-1 flex items-center">
                            <div className={`h-1 rounded-full flex-1 transition-all ${
                              sIdx <= currentIdx ? 'bg-brand' : 'bg-neutral-200'
                            }`} title={step} />
                            {sIdx < steps.length - 1 && <div className="w-0.5" />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Est delivery time */}
                    {order.status !== 'Delivered' && (
                      <div className="flex items-center gap-1.5 text-[9px] text-neutral-500 font-bold uppercase tracking-wider">
                        <Clock className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Ready in: {new Date(order.estimated_ready_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    )}

                    {/* Simulate advancement in Mock Mode */}
                    {isMockMode && order.status !== 'Delivered' && (
                      <div className="pt-2 border-t border-neutral-200 flex justify-end">
                        <button
                          onClick={() => simulateStatusAdvance(order.id)}
                          className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-[8px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Simulate Advance →
                        </button>
                      </div>
                    )}
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
