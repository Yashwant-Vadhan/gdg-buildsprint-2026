import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isMockMode } from '../../lib/supabaseClient';
import { ShoppingBag, RefreshCw, AlertCircle, ShoppingCart } from 'lucide-react';

const INITIAL_STORE_ITEMS = [
  { id: 's1', name: 'Snicker Bar', price: 50.00, quantity_available: 20, category: 'Snacks', image: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=500&auto=format&fit=crop' },
  { id: 's2', name: 'Dairy Milk Silk', price: 80.05, quantity_available: 15, category: 'Sweets', image: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=500&auto=format&fit=crop' },
  { id: 's3', name: 'Kurkure Masala', price: 20.00, quantity_available: 30, category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=500&auto=format&fit=crop' },
  { id: 's4', name: 'Bingo Potato Chips', price: 20.00, quantity_available: 25, category: 'Snacks', image: 'https://images.unsplash.com/photo-1600952841320-db92ec4047ca?w=500&auto=format&fit=crop' },
  { id: 's5', name: 'Good Day Biscuits', price: 10.00, quantity_available: 40, category: 'Snacks', image: 'https://images.unsplash.com/photo-1558961309-dbdf000a127b?w=500&auto=format&fit=crop' }
];

const FALLBACK_STORE_IMG = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop";

export default function Store() {
  const { profile: user } = useAuth();
  const [items, setItems] = useState([]);
  const [walletBalance, setWalletBalance] = useState(0.00);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [qty, setQty] = useState(1);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchItems();
    fetchWalletBalance();

    if (!isMockMode) {
      const itemSub = supabase
        .channel('store_items_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'store_items' }, () => {
          fetchItems();
        })
        .subscribe();

      const balanceSub = supabase
        .channel('wallet_realtime_store')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` }, () => {
          fetchWalletBalance();
        })
        .subscribe();

      return () => {
        itemSub.unsubscribe();
        balanceSub.unsubscribe();
      };
    }
  }, []);

  const fetchItems = async () => {
    try {
      if (isMockMode) {
        const stored = localStorage.getItem('store_items');
        let parsed = stored ? JSON.parse(stored) : [];
        
        const needsReseed = parsed.length === 0 || !parsed.some(i => i.name === 'Snicker Bar');
        if (needsReseed) {
          localStorage.setItem('store_items', JSON.stringify(INITIAL_STORE_ITEMS));
          parsed = INITIAL_STORE_ITEMS;
        }
        setItems(parsed);
        return;
      }

      const { data, error } = await supabase
        .from('store_items')
        .select('*')
        .eq('is_available', true);

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error fetching store items:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const handleOpenBuyModal = (item) => {
    setSelectedItem(item);
    setQty(1);
    setMessage({ text: '', type: '' });
  };

  const handlePurchase = async () => {
    const totalCost = selectedItem.price * qty;
    if (walletBalance < totalCost) {
      setMessage({ text: 'Insufficient wallet balance. Top up at desk.', type: 'error' });
      return;
    }

    setOrdering(true);
    setMessage({ text: '', type: '' });

    try {
      if (isMockMode) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const newBalance = walletBalance - totalCost;
        localStorage.setItem(`wallet_balance_${user.id}`, newBalance.toFixed(2));
        setWalletBalance(newBalance);

        // Update item stock
        const storedItems = JSON.parse(localStorage.getItem('store_items') || '[]');
        const updatedItems = storedItems.map(i => {
          if (i.id === selectedItem.id) {
            return { ...i, quantity_available: Math.max(0, i.quantity_available - qty) };
          }
          return i;
        });
        localStorage.setItem('store_items', JSON.stringify(updatedItems));
        setItems(updatedItems);

        // Add transaction ledger log
        const txnId = 'txn-' + Math.floor(100000 + Math.random() * 900000);
        const storedTxns = JSON.parse(localStorage.getItem(`wallet_transactions_${user.id}`) || '[]');
        storedTxns.unshift({
          id: txnId,
          service: 'store',
          amount: totalCost,
          method: 'wallet',
          created_at: new Date().toISOString()
        });
        localStorage.setItem(`wallet_transactions_${user.id}`, JSON.stringify(storedTxns));

        setMessage({ text: 'Purchase completed successfully!', type: 'success' });
        setTimeout(() => setSelectedItem(null), 1500);
        return;
      }

      // Live mode debit via RPC
      const { data: walletData, error: walletErr } = await supabase
        .from('wallets')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (walletErr) throw walletErr;

      const { data: newBalance, error: debitError } = await supabase.rpc('debit_wallet', {
        p_wallet_id: walletData.id,
        p_amount: totalCost
      });
      if (debitError) throw debitError;

      const { error: stockErr } = await supabase.rpc('decrement_stock', {
        p_table: 'store_items',
        p_item_id: selectedItem.id,
        p_qty: qty
      });
      if (stockErr) throw stockErr;

      const { error: orderErr } = await supabase
        .from('store_orders')
        .insert({
          user_id: user.id,
          item_id: selectedItem.id,
          qty,
          amount: totalCost,
          status: 'Collected',
          collected_at: new Date().toISOString()
        });
      if (orderErr) throw orderErr;

      setMessage({ text: 'Purchase completed successfully!', type: 'success' });
      fetchItems();
      fetchWalletBalance();
      setTimeout(() => setSelectedItem(null), 2000);

    } catch (err) {
      console.error('Purchase error:', err);
      setMessage({ text: err.message || 'Transaction failed. Please try again.', type: 'error' });
    } finally {
      setOrdering(false);
    }
  };

  return (
    <div className="space-y-6 text-left pb-10">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-805 dark:text-slate-100 tracking-tight uppercase m-0">AU Cooperative Store</h1>
          <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-wider">Hostel Provision Supplies</p>
        </div>

        {/* Balance Status */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 shadow-sm text-xs font-bold text-slate-805 dark:text-slate-100">
          <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center text-brand font-black text-md animate-pulse">
            ₹
          </div>
          <div>
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Wallet Balance</p>
            <p className="text-xs font-black text-slate-800 dark:text-slate-100">₹{walletBalance.toFixed(2)}</p>
          </div>
          <button 
            onClick={() => { fetchItems(); fetchWalletBalance(); }}
            className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 rounded transition-colors cursor-pointer ml-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Item Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map(n => <div key={n} className="h-64 bg-white dark:bg-slate-900 border border-slate-202 dark:border-slate-800 rounded-2xl"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => {
            const isOutOfStock = item.quantity_available <= 0;
            return (
              <div 
                key={item.id} 
                className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between group hover:shadow-md transition-all ${
                  isOutOfStock ? 'opacity-70 bg-slate-50/50 dark:bg-slate-900/50' : ''
                }`}
              >
                <div className="h-40 w-full bg-slate-100 dark:bg-slate-850 relative overflow-hidden shrink-0 border-b border-slate-100 dark:border-slate-800">
                  <img
                    src={item.image || FALLBACK_STORE_IMG}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.target.src = FALLBACK_STORE_IMG;
                    }}
                  />
                  <span className="absolute top-3 left-3 text-[9px] uppercase font-black tracking-widest bg-white/90 dark:bg-slate-900/95 text-brand px-2 py-0.5 rounded shadow-sm">
                    {item.category}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="text-left space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="text-md font-black text-slate-808 dark:text-slate-100 uppercase tracking-tight">{item.name}</h3>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${
                        isOutOfStock 
                          ? 'bg-red-50 dark:bg-red-955/30 border-red-200 dark:border-red-900 text-brand' 
                          : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                      }`}>
                        {isOutOfStock ? 'Sold Out' : `${item.quantity_available} Left`}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Available at the hostel utility counter desk.</p>
                  </div>

                  <div className="flex justify-between items-center mt-6 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <span className="text-slate-450 dark:text-slate-550 text-[10px] uppercase font-black">Ledger Price</span>
                      <p className="text-lg font-black text-slate-808 dark:text-slate-100">₹{parseFloat(item.price).toFixed(2)}</p>
                    </div>
                    <button
                      onClick={() => handleOpenBuyModal(item)}
                      disabled={isOutOfStock}
                      className="px-4 py-2 bg-brand hover:bg-brand-hover disabled:opacity-30 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer shadow-sm"
                    >
                      Buy +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Checkout Modal */}
      {selectedItem && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-neutral-900/40 backdrop-blur-xs z-50 animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 relative shadow-lg text-slate-800 dark:text-slate-100">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-md font-black text-slate-850 dark:text-slate-100 flex items-center gap-2 uppercase tracking-tight"><ShoppingBag className="w-4 h-4 text-brand animate-bounce" /> Purchase Item</h2>
              <button 
                onClick={() => setSelectedItem(null)} 
                className="text-slate-450 hover:text-slate-650 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {message.text && (
              <div className={`p-3 rounded-lg border text-xs font-bold flex gap-2.5 ${
                message.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border border-brand-light text-brand'
              }`}>
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{message.text}</span>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-slate-400">
                <span>{selectedItem.name}</span>
                <span className="text-slate-808 dark:text-slate-100 font-black">₹{parseFloat(selectedItem.price).toFixed(2)}</span>
              </div>

              {/* Quantity Selector */}
              <div className="flex justify-between items-center bg-neutral-50 dark:bg-slate-800 border border-neutral-200 dark:border-slate-700 p-2.5 rounded-xl">
                <span className="text-xs text-neutral-500 font-black uppercase tracking-wider">Quantity</span>
                <div className="flex items-center gap-3">
                  <button 
                    disabled={qty <= 1} 
                    onClick={() => setQty(qty - 1)}
                    className="w-7 h-7 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center disabled:opacity-30 cursor-pointer text-xs font-black"
                  >
                    -
                  </button>
                  <span className="text-slate-808 dark:text-slate-100 font-black text-xs w-4 text-center">{qty}</span>
                  <button 
                    disabled={qty >= selectedItem.quantity_available} 
                    onClick={() => setQty(qty + 1)}
                    className="w-7 h-7 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center disabled:opacity-30 cursor-pointer text-xs font-black"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex justify-between items-center text-xs font-black uppercase tracking-wider">
                <span className="text-neutral-505 dark:text-slate-400">Subtotal Debit</span>
                <span className="text-lg font-black text-brand">₹{(selectedItem.price * qty).toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handlePurchase}
              disabled={ordering}
              className="w-full py-3 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
            >
              {ordering ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>Purchase with Wallet</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
