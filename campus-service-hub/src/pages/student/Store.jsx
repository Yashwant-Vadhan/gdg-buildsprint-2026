import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isMockMode } from '../../lib/supabaseClient';
import { ShoppingCart, RefreshCw, AlertCircle, ShoppingBag, CreditCard, ShieldCheck } from 'lucide-react';

const INITIAL_STORE_ITEMS = [
  { id: 's1', name: "Cavin's Chocolate Milkshake", price: 40.00, quantity_available: 20, is_available: true, category: 'Milkshakes', image: 'https://images.unsplash.com/photo-1579954115545-a95591f280c2?w=500&auto=format&fit=crop' },
  { id: 's2', name: "Cavin's Butterscotch Milkshake", price: 40.00, quantity_available: 15, is_available: true, category: 'Milkshakes', image: 'https://images.unsplash.com/photo-1553787499-6f9133860278?w=500&auto=format&fit=crop' },
  { id: 's3', name: 'Premium Ice Cream', price: 40.00, quantity_available: 12, is_available: true, category: 'Ice Cream', image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=500&auto=format&fit=crop' },
  { id: 's4', name: 'Hide & Seek Biscuits', price: 30.00, quantity_available: 25, is_available: true, category: 'Biscuits', image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=500&auto=format&fit=crop' },
  { id: 's5', name: 'Bourbon Biscuits', price: 20.00, quantity_available: 22, is_available: true, category: 'Biscuits', image: 'https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?w=500&auto=format&fit=crop' },
  { id: 's6', name: 'Munch Chocolate Bar', price: 10.00, quantity_available: 40, is_available: true, category: 'Biscuits', image: 'https://images.unsplash.com/photo-1581798459219-318e76aecc7b?w=500&auto=format&fit=crop' },
  { id: 's7', name: 'Lays Potato Chips', price: 20.00, quantity_available: 30, is_available: true, category: 'Chips / Snacks', image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop' },
  { id: 's8', name: 'Murukku (Packet)', price: 30.00, quantity_available: 18, is_available: true, category: 'Chips / Snacks', image: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=500&auto=format&fit=crop' }
];

const FALLBACK_STORE_IMG = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop";

export default function Store() {
  const { user } = useAuth();
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0.00);
  const [selectedItem, setSelectedItem] = useState(null);
  const [qty, setQty] = useState(1);
  const [ordering, setOrdering] = useState(false);
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

      return () => itemSub.unsubscribe();
    }
  }, []);

  const fetchItems = async () => {
    try {
      if (isMockMode) {
        const stored = localStorage.getItem('store_items');
        let parsed = stored ? JSON.parse(stored) : [];
        
        // Enforce the new AU Hostel Store list by checking localStorage status
        const needsReseed = parsed.length === 0 || !parsed.some(i => i.name.includes("Cavin's")) || parsed.some(i => i.image && i.image.includes('photo-1572490122747-3968b75cc699'));
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

  const handleOpenBuyModal = (item) => {
    setSelectedItem(item);
    setQty(1);
    setMessage({ text: '', type: '' });
  };

  const handlePurchase = async () => {
    if (!selectedItem) return;
    
    const totalPrice = parseFloat(selectedItem.price) * qty;

    if (walletBalance < totalPrice) {
      setMessage({ text: 'Insufficient wallet ledger balance. Please upload academic fee receipts to top-up.', type: 'error' });
      return;
    }

    setOrdering(true);
    setMessage({ text: '', type: '' });

    try {
      if (isMockMode) {
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 1. Debit wallet
        const newBalance = walletBalance - totalPrice;
        setWalletBalance(newBalance);
        localStorage.setItem(`wallet_balance_${user.id}`, newBalance.toFixed(2));

        // 2. Decrement stock
        const updatedItems = items.map(item => {
          if (item.id === selectedItem.id) {
            return { ...item, quantity_available: Math.max(0, item.quantity_available - qty) };
          }
          return item;
        });
        setItems(updatedItems);
        localStorage.setItem('store_items', JSON.stringify(updatedItems));

        // 3. Add to ledger/transactions
        const storedTxns = JSON.parse(localStorage.getItem(`wallet_txns_${user.id}`) || '[]');
        const newTxn = {
          id: 'txn-' + Date.now(),
          service: 'store',
          amount: totalPrice,
          method: 'wallet',
          status: 'success',
          created_at: new Date().toISOString()
        };
        storedTxns.unshift(newTxn);
        localStorage.setItem(`wallet_txns_${user.id}`, JSON.stringify(storedTxns));

        setMessage({ text: `Purchase completed successfully. Ledger updated.`, type: 'success' });
        setTimeout(() => setSelectedItem(null), 2000);
        return;
      }

      // Real DB Transaction
      const { data: newBal, error: debitErr } = await supabase.rpc('debit_wallet', {
        p_wallet_id: user.id,
        p_amount: totalPrice
      });

      if (debitErr) {
        if (debitErr.message.includes('insufficient_balance')) {
          throw new Error('Insufficient wallet balance.');
        }
        throw debitErr;
      }

      const { error: stockErr } = await supabase.rpc('decrement_stock', {
        p_table: 'store_items',
        p_item_id: selectedItem.id,
        p_qty: qty
      });

      if (stockErr) throw stockErr;

      await supabase.from('payments').insert({
        user_id: user.id,
        service: 'store',
        amount: totalPrice,
        method: 'wallet',
        status: 'success'
      });

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
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase m-0 font-sans">AU Cooperative Store</h1>
          <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-wider">Hostel Provision Supplies</p>
        </div>

        {/* Balance Status */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 shadow-sm text-xs font-bold text-slate-800 dark:text-slate-100">
          <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center text-brand font-black text-md">
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
          {[1, 2, 3].map(n => <div key={n} className="h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl"></div>)}
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
                {/* Product Image */}
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
                      <h3 className="text-md font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{item.name}</h3>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${
                        isOutOfStock 
                          ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-brand' 
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
                      <p className="text-lg font-black text-slate-800 dark:text-slate-100">₹{parseFloat(item.price).toFixed(2)}</p>
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
              <h2 className="text-md font-black text-slate-850 dark:text-slate-100 flex items-center gap-2 uppercase tracking-tight"><ShoppingBag className="w-4 h-4 text-brand" /> Purchase Item</h2>
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
                <span className="text-slate-800 dark:text-slate-100 font-black">₹{parseFloat(selectedItem.price).toFixed(2)}</span>
              </div>

              {/* Quantity Selector */}
              <div className="flex justify-between items-center bg-neutral-50 dark:bg-slate-850 border border-neutral-200 dark:border-slate-800 p-2.5 rounded-xl">
                <span className="text-xs text-neutral-500 font-black uppercase tracking-wider">Quantity</span>
                <div className="flex items-center gap-3">
                  <button 
                    disabled={qty <= 1} 
                    onClick={() => setQty(qty - 1)}
                    className="w-7 h-7 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center justify-center disabled:opacity-30 cursor-pointer text-xs font-black"
                  >
                    -
                  </button>
                  <span className="text-slate-800 dark:text-slate-100 font-black text-xs w-4 text-center">{qty}</span>
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
                <span className="text-neutral-500 dark:text-slate-400">Subtotal Debit</span>
                <span className="text-lg font-black text-brand">₹{(selectedItem.price * qty).toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handlePurchase}
              disabled={ordering}
              className="w-full py-3 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white rounded-xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 text-xs cursor-pointer shadow-sm"
            >
              {ordering ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 shrink-0" /> Pay with wallet
                </>
              )}
            </button>

            <div className="flex justify-center items-center gap-2 text-[9px] text-neutral-450 border-t border-slate-100 pt-3 font-black uppercase tracking-widest">
              <ShieldCheck className="w-3.5 h-3.5 text-green-700" /> Secure Wallet transaction
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
