import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { isMockMode } from '../../lib/supabaseClient';
import { payCanteenCart } from '../../services/cashfree/cashfreeClient';
import { ShoppingBag, ArrowLeft, CreditCard, ShieldCheck, HelpCircle } from 'lucide-react';

export default function CanteenCheckout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const item = location.state?.item;
  const qty = location.state?.qty || 1;
  const cart = location.state?.cart || [];
  const hasCart = cart.length > 0;

  if (!item && cart.length === 0) {
    return (
      <div className="bg-white border border-slate-205 p-8 text-center max-w-md mx-auto mt-12 rounded-2xl shadow-sm">
        <p className="text-slate-800 font-bold mb-4">Your basket is empty</p>
        <Link to="/student/canteen" className="px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold uppercase tracking-wider">
          Return to Canteen Menu
        </Link>
      </div>
    );
  }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Calculate total price
  const totalAmount = hasCart
    ? cart.reduce((sum, cItem) => sum + (parseFloat(cItem.selectedPrice) * cItem.qty), 0)
    : parseFloat(item?.price || 0) * qty;

  const handleCheckout = async () => {
    setLoading(true);
    setError('');

    try {
      if (isMockMode) {
        await new Promise(resolve => setTimeout(resolve, 1500));

        const orderId = 'order-' + Math.floor(100000 + Math.random() * 900000);
        const orderTime = new Date().toISOString();
        const token = Math.floor(100 + Math.random() * 899);

        // Retrieve existing student orders
        const existingOrders = JSON.parse(localStorage.getItem('student_orders') || '[]');

        if (hasCart) {
          // Process multiple items in cart
          cart.forEach((cItem, index) => {
            const indId = `order-${Math.floor(100000 + Math.random() * 900000)}-${index}`;
            const indOrder = {
              id: indId,
              user_id: user.id,
              item_id: cItem.item.id,
              qty: cItem.qty,
              amount: cItem.selectedPrice * cItem.qty,
              status: 'Received',
              token_no: token + index,
              ordered_at: orderTime,
              estimated_ready_at: new Date(Date.now() + (cItem.item.prep_time_min * cItem.qty * 60000)).toISOString(),
              qr_payload: JSON.stringify({ order_id: indId, service: 'canteen', user_roll_no: user.roll_no, amount: cItem.selectedPrice * cItem.qty }),
              qr_signature: 'mock-hmac-signature-value'
            };
            existingOrders.push(indOrder);

            // Decrement mock stock
            const storedItems = JSON.parse(localStorage.getItem('canteen_items') || '[]');
            const updatedItems = storedItems.map(i => {
              if (i.id === cItem.item.id) {
                return { ...i, quantity_available: Math.max(0, i.quantity_available - cItem.qty) };
              }
              return i;
            });
            localStorage.setItem('canteen_items', JSON.stringify(updatedItems));
          });
        } else {
          // Single item checkout
          const singleOrder = {
            id: orderId,
            user_id: user.id,
            item_id: item.id,
            qty,
            amount: totalAmount,
            status: 'Received',
            token_no: token,
            ordered_at: orderTime,
            estimated_ready_at: new Date(Date.now() + (item.prep_time_min * qty * 60000)).toISOString(),
            qr_payload: JSON.stringify({ order_id: orderId, service: 'canteen', user_roll_no: user.roll_no, amount: totalAmount }),
            qr_signature: 'mock-hmac-signature-value'
          };
          existingOrders.push(singleOrder);

          // Decrement mock stock
          const storedItems = JSON.parse(localStorage.getItem('canteen_items') || '[]');
          const updatedItems = storedItems.map(i => {
            if (i.id === item.id) {
              return { ...i, quantity_available: Math.max(0, i.quantity_available - qty) };
            }
            return i;
          });
          localStorage.setItem('canteen_items', JSON.stringify(updatedItems));
        }

        localStorage.setItem('student_orders', JSON.stringify(existingOrders));

        // Navigate to status tracker of first order
        const targetId = hasCart ? existingOrders[existingOrders.length - cart.length].id : orderId;
        navigate(`/student/canteen/status/${targetId}`);
        return;
      }

      // Live mode checkout — single item and cart both go through the same path;
      // create-cashfree-order accepts either shape and normalizes it server-side.
      const items = hasCart
        ? cart.map((cItem) => ({ item_id: cItem.item.id, qty: cItem.qty }))
        : [{ item_id: item.id, qty }];

      // payCanteenCart hands the browser off to Cashfree's hosted checkout — it does not
      // return normally on success. The user comes back via PaymentReturn.jsx, which is
      // where the actual order-status navigation happens once the webhook confirms payment.
      await payCanteenCart({ items, userId: user.id });

    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.message || 'Checkout failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6 text-left pb-10">
      <Link to="/student/canteen" className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors font-bold uppercase">
        <ArrowLeft className="w-4 h-4" /> Back to Canteen Menu
      </Link>

      <h1 className="text-xl font-black text-slate-800 tracking-tight uppercase m-0">Confirm Checkout</h1>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-md relative overflow-hidden">
        
        {/* Checkout List */}
        <div className="space-y-4">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 pb-2">Order summary</p>
          
          {hasCart ? (
            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {cart.map((cItem) => (
                <div key={cItem.item.id} className="flex justify-between items-center text-xs font-semibold">
                  <div className="flex gap-2.5 items-center">
                    <span className="px-2 py-0.5 bg-brand-light text-brand text-[10px] font-bold rounded">x{cItem.qty}</span>
                    <span className="text-slate-850 font-bold">{cItem.item.name}</span>
                  </div>
                  <span className="text-slate-800 font-bold">₹{(cItem.selectedPrice * cItem.qty).toFixed(2)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex justify-between items-center text-xs font-semibold">
              <div className="flex gap-2.5 items-center">
                <span className="px-2 py-0.5 bg-brand-light text-brand text-[10px] font-bold rounded">x{qty}</span>
                <span className="text-slate-850 font-bold">{item.name}</span>
              </div>
              <span className="text-slate-800 font-bold">₹{totalAmount.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Payment Summary */}
        <div className="space-y-2 border-t border-slate-100 pt-4">
          <div className="flex justify-between text-xs text-slate-500 font-bold uppercase tracking-wider">
            <span>Taxes & Canteen Surcharges</span>
            <span className="text-green-700 font-black">₹0.00</span>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-805 pt-3 border-t border-slate-100 font-black uppercase tracking-wider">
            <span>Total Payable</span>
            <span className="text-lg font-black text-brand">₹{totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-705 rounded-lg text-xs font-bold">
            {error}
          </div>
        )}

        {/* Checkout Button */}
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full py-3.5 bg-brand hover:bg-brand-hover disabled:opacity-50 text-white rounded-xl font-black uppercase tracking-widest transition-all duration-300 cursor-pointer shadow flex items-center justify-center gap-2 text-xs"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          ) : (
            <>
              <CreditCard className="w-4 h-4 shrink-0" />
              Pay ₹{totalAmount.toFixed(2)} via UPI
            </>
          )}
        </button>

        {/* Security badges */}
        <div className="flex justify-center items-center gap-4 text-[9px] text-neutral-400 pt-3 border-t border-neutral-100 font-black uppercase tracking-widest">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-green-750 animate-pulse" /> Sandbox UPI Gateway
          </span>
        </div>
      </div>
    </div>
  );
}
