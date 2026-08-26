import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isMockMode } from '../../lib/supabaseClient';
import { Clock, AlertCircle, RefreshCw, Plus, Minus, Search, ShoppingCart } from 'lucide-react';

const INITIAL_CANTEEN_MENU = [
  { id: 'c1', name: 'Veg Puff', price: 12.00, quantity_available: 15, prep_time_min: 5, is_available: true, category: 'Snacks', image: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=500&auto=format&fit=crop' },
  { id: 'c2', name: 'Egg Puff', price: 15.00, quantity_available: 10, prep_time_min: 5, is_available: true, category: 'Snacks', image: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=500&auto=format&fit=crop' },
  { id: 'c3', name: 'Chicken Puff', price: 18.00, quantity_available: 12, prep_time_min: 5, is_available: true, category: 'Snacks', image: 'https://images.unsplash.com/photo-1608039829572-78524f79c4c7?w=500&auto=format&fit=crop' },
  { id: 'c4', name: 'Samosa (2 pcs)', price: 10.00, quantity_available: 20, prep_time_min: 5, is_available: true, category: 'Snacks', image: 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=500&auto=format&fit=crop' },
  { id: 'c5', name: 'Sundal', price: 10.00, quantity_available: 15, prep_time_min: 5, is_available: true, category: 'Snacks', image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&auto=format&fit=crop' },
  { id: 'c6', name: 'Honey Bun', price: 12.00, quantity_available: 8, prep_time_min: 3, is_available: true, category: 'Snacks', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop' },
  { id: 'c7', name: 'Jam Bun', price: 15.00, quantity_available: 8, prep_time_min: 3, is_available: true, category: 'Snacks', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&auto=format&fit=crop' },
  { id: 'c8', name: 'Cake Piece', price: 30.00, quantity_available: 10, prep_time_min: 2, is_available: true, category: 'Sweets', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=500&auto=format&fit=crop' },
  { id: 'c9', name: 'Kulfi', price: 20.00, quantity_available: 15, prep_time_min: 2, is_available: true, category: 'Sweets', image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=500&auto=format&fit=crop' },
  { id: 'c10', name: 'Coffee', price: 10.00, quantity_available: 40, prep_time_min: 4, is_available: true, category: 'Beverages', image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&auto=format&fit=crop' },
  { id: 'c11', name: 'Tea', price: 10.00, quantity_available: 45, prep_time_min: 4, is_available: true, category: 'Beverages', image: 'https://images.unsplash.com/photo-1594631252845-29fc458dd836?w=500&auto=format&fit=crop' },
  { id: 'c12', name: 'Badam Milk', price: 30.00, quantity_available: 20, prep_time_min: 5, is_available: true, category: 'Beverages', image: 'https://images.unsplash.com/photo-1553530666-ba11a7da3888?w=500&auto=format&fit=crop' },
  { id: 'c13', name: 'Rose Milk', price: 30.00, quantity_available: 20, prep_time_min: 5, is_available: true, category: 'Beverages', image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500&auto=format&fit=crop' },
  { id: 'c14', name: 'Ice Cream', price: 20.00, quantity_available: 25, prep_time_min: 2, is_available: true, category: 'Ice Cream', image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=500&auto=format&fit=crop' }
];

const FALLBACK_FOOD_IMG = "https://images.unsplash.com/photo-1495147466023-ac5c588e2e94?w=500&auto=format&fit=crop";

export default function Canteen() {
  const { profile: user } = useAuth();
  const navigate = useNavigate();
  
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queueLength, setQueueLength] = useState(3);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [iceCreamPrices, setIceCreamPrices] = useState({});
  const [cart, setCart] = useState({});

  useEffect(() => {
    fetchItems();
    fetchQueueLength();

    if (!isMockMode) {
      const itemSub = supabase
        .channel('canteen_items_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'canteen_items' }, () => {
          fetchItems();
        })
        .subscribe();

      const orderSub = supabase
        .channel('canteen_orders_realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'canteen_orders' }, () => {
          fetchQueueLength();
        })
        .subscribe();

      return () => {
        itemSub.unsubscribe();
        orderSub.unsubscribe();
      };
    }
  }, []);

  const fetchItems = async () => {
    try {
      if (isMockMode) {
        const stored = localStorage.getItem('canteen_items');
        let parsed = stored ? JSON.parse(stored) : [];
        
        const needsReseed = parsed.length === 0 || !parsed.some(i => i.name === 'Veg Puff');
        if (needsReseed) {
          localStorage.setItem('canteen_items', JSON.stringify(INITIAL_CANTEEN_MENU));
          parsed = INITIAL_CANTEEN_MENU;
        }
        setItems(parsed);

        const iceCreamNode = parsed.find(i => i.name === 'Ice Cream');
        if (iceCreamNode) {
          setIceCreamPrices(prev => ({ ...prev, [iceCreamNode.id]: parseFloat(iceCreamNode.price) }));
        }
        return;
      }

      const { data, error } = await supabase
        .from('canteen_items')
        .select('*')
        .eq('is_available', true);

      if (error) throw error;
      
      setItems(data || []);
      const iceCreamNode = data?.find(i => i.name === 'Ice Cream');
      if (iceCreamNode) {
        setIceCreamPrices(prev => ({ ...prev, [iceCreamNode.id]: parseFloat(iceCreamNode.price) }));
      }
    } catch (err) {
      console.error('Error fetching canteen items:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueueLength = async () => {
    try {
      if (isMockMode) {
        setQueueLength(Math.floor(2 + Math.random() * 4));
        return;
      }

      const { count, error } = await supabase
        .from('canteen_orders')
        .select('*', { count: 'exact', head: true })
        .not('status', 'eq', 'Collected');

      if (error) throw error;
      setQueueLength(count || 0);
    } catch (err) {
      console.error('Error fetching queue length:', err);
    }
  };

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev[item.id];
      const basePrice = parseFloat(item.price);
      
      const selectedPrice = item.name === 'Ice Cream' 
        ? (iceCreamPrices[item.id] || basePrice) 
        : basePrice;

      if (existing) {
        return {
          ...prev,
          [item.id]: {
            ...existing,
            qty: Math.min(item.quantity_available, existing.qty + 1)
          }
        };
      }
      return {
        ...prev,
        [item.id]: { item, qty: 1, selectedPrice }
      };
    });
  };

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const existing = prev[itemId];
      if (!existing) return prev;
      if (existing.qty <= 1) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return {
        ...prev,
        [itemId]: { ...existing, qty: existing.qty - 1 }
      };
    });
  };

  const handleCheckoutCart = () => {
    const cartList = Object.values(cart);
    if (cartList.length === 0) return;
    
    if (cartList.length === 1) {
      const single = cartList[0];
      navigate('/student/canteen/checkout', { 
        state: { 
          item: { 
            ...single.item, 
            price: single.selectedPrice 
          }, 
          qty: single.qty 
        } 
      });
    } else {
      navigate('/student/canteen/checkout', { state: { cart: cartList } });
    }
  };

  const categories = ['All', 'Snacks', 'Beverages', 'Sweets', 'Ice Cream'];

  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const cartTotalQty = Object.values(cart).reduce((sum, i) => sum + i.qty, 0);
  const cartTotalPrice = Object.values(cart).reduce((sum, i) => sum + (i.selectedPrice * i.qty), 0);

  return (
    <div className="space-y-6 text-left pb-24 relative">
      
      {/* Canteen Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight uppercase m-0">AU Campus Canteen</h1>
          <p className="text-xs text-slate-500 mt-1 font-bold uppercase tracking-wider">Refectory Student Portal</p>
        </div>

        {/* Dynamic Queue Info Card */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 shadow-sm text-xs font-bold text-slate-800 dark:text-slate-100">
          <span className="w-2.5 h-2.5 rounded-full bg-brand animate-ping shrink-0"></span>
          <span className="text-slate-750 dark:text-slate-300">Canteen Queue:</span>
          <span className="text-brand font-black">{queueLength} orders cooking</span>
          <button 
            onClick={() => { fetchItems(); fetchQueueLength(); }}
            className="p-1 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 rounded transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Category Horizontal Filter List */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search puff, tea, samosa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-brand transition-colors text-xs"
          />
        </div>
        
        {/* Horizontal Category Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap border transition-all ${
                selectedCategory === category
                  ? 'bg-brand border-brand text-white'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-slate-350 dark:hover:border-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Canteen Item Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map(n => <div key={n} className="h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl"></div>)}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 text-center rounded-2xl shadow-sm flex flex-col items-center">
          <AlertCircle className="w-10 h-10 text-slate-400 mb-3" />
          <h3 className="text-md font-bold text-slate-800 dark:text-slate-200">No items available</h3>
          <p className="text-xs text-slate-500 mt-1">There are no items matching this category currently.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => {
            const isOutOfStock = item.quantity_available <= 0;
            const cartItem = cart[item.id];
            
            const basePrice = parseFloat(item.price);
            const selectedPrice = item.name === 'Ice Cream' 
              ? (iceCreamPrices[item.id] || basePrice) 
              : basePrice;

            return (
              <div
                key={item.id}
                className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between group hover:shadow-md transition-all ${
                  isOutOfStock ? 'opacity-70 bg-slate-50/50 dark:bg-slate-900/50' : ''
                }`}
              >
                {/* Food Image header */}
                <div className="h-40 w-full bg-slate-100 dark:bg-slate-850 relative overflow-hidden shrink-0 border-b border-slate-100 dark:border-slate-800">
                  <img
                    src={item.image || FALLBACK_FOOD_IMG}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      e.target.src = FALLBACK_FOOD_IMG;
                    }}
                  />
                  <span className="absolute top-3 left-3 text-[9px] uppercase font-black tracking-widest bg-white/90 dark:bg-slate-900/95 text-brand px-2 py-0.5 rounded shadow-sm">
                    {item.category}
                  </span>
                  
                  {item.prep_time_min && (
                    <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-xs text-white text-[9px] px-2 py-0.5 rounded font-bold">
                      <Clock className="w-3 h-3 text-brand" /> {item.prep_time_min} min prep
                    </div>
                  )}
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div className="text-left space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="text-md font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">{item.name}</h3>
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border shrink-0 ${
                        isOutOfStock
                          ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-brand'
                          : item.quantity_available <= 5
                          ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-250 dark:border-amber-905 text-amber-800 dark:text-amber-400'
                          : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                      }`}>
                        {isOutOfStock ? 'Out of stock' : `${item.quantity_available} Left`}
                      </span>
                    </div>

                    {item.name === 'Ice Cream' ? (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-550">Select Variant</span>
                        <div className="flex gap-1.5">
                          {[basePrice, basePrice + 5, basePrice + 10].map((vPrice) => (
                            <button
                              key={vPrice}
                              disabled={isOutOfStock}
                              onClick={() => {
                                setIceCreamPrices(prev => ({ ...prev, [item.id]: vPrice }));
                                if (cart[item.id]) {
                                  setCart(prevCart => ({
                                    ...prevCart,
                                    [item.id]: { ...prevCart[item.id], selectedPrice: vPrice }
                                  }));
                                }
                              }}
                              className={`px-2 py-1 text-[10px] font-black rounded border transition-all cursor-pointer ${
                                selectedPrice === vPrice
                                  ? 'bg-brand text-white border-brand'
                                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                              }`}
                            >
                              ₹{vPrice.toFixed(0)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500">Fresh and crispy, served hot from refectory stove.</p>
                    )}
                  </div>

                  <div className="flex justify-between items-center mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
                    <div>
                      <span className="text-slate-400 dark:text-slate-550 text-[10px] uppercase font-black">Price</span>
                      <p className="text-lg font-black text-brand">₹{selectedPrice.toFixed(2)}</p>
                    </div>

                    {cartItem ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-black text-slate-800 dark:text-slate-100">{cartItem.qty}</span>
                        <button
                          onClick={() => addToCart(item)}
                          disabled={cartItem.qty >= item.quantity_available}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(item)}
                        disabled={isOutOfStock}
                        className="px-4 py-2 bg-brand hover:bg-brand-hover disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky Bottom Cart Bar */}
      {cartTotalQty > 0 && (
        <div className="fixed bottom-14 md:bottom-4 left-4 right-4 md:left-auto md:right-8 md:w-96 bg-[#202124] text-white py-3 px-5 rounded-xl shadow-xl flex items-center justify-between z-40 animate-fadeIn border border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-brand flex items-center justify-center text-white shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-xs font-black uppercase tracking-wider">{cartTotalQty} Item{cartTotalQty > 1 ? 's' : ''}</p>
              <p className="text-sm font-black text-brand">₹{cartTotalPrice.toFixed(2)}</p>
            </div>
          </div>
          <button
            onClick={handleCheckoutCart}
            className="py-2 px-4 bg-brand hover:bg-brand-hover text-white rounded-lg text-xs font-black uppercase tracking-wider cursor-pointer transition-colors"
          >
            Checkout
          </button>
        </div>
      )}

    </div>
  );
}
