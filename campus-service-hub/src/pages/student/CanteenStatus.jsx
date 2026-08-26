import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase, isMockMode } from '../../lib/supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import { Clock, CheckCircle2, RefreshCw, ArrowLeft, Info } from 'lucide-react';

const STATUS_STEPS = ['Received', 'Preparing', 'Ready', 'Collected'];

export default function CanteenStatus() {
  const { id } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  
  const [order, setOrder] = useState(location.state?.order || null);
  const [loading, setLoading] = useState(!order);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!order) {
      fetchOrder();
    }

    if (!isMockMode && id) {
      const channel = supabase
        .channel(`order_status_${id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'canteen_orders',
          filter: `id=eq.${id}`
        }, (payload) => {
          setOrder(payload.new);
        })
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [id]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      if (isMockMode) {
        const stored = JSON.parse(localStorage.getItem('student_orders') || '[]');
        const found = stored.find(o => o.id === id);
        if (found) {
          setOrder(found);
        } else {
          setError('Order not found');
        }
        return;
      }

      const { data, error: fetchErr } = await supabase
        .from('canteen_orders')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr) throw fetchErr;
      setOrder(data);
    } catch (err) {
      console.error('Error fetching order status:', err);
      setError('Could not retrieve order details.');
    } finally {
      setLoading(false);
    }
  };

  const advanceMockStatus = () => {
    if (!order) return;
    const currentIndex = STATUS_STEPS.indexOf(order.status);
    if (currentIndex < STATUS_STEPS.length - 1) {
      const nextStatus = STATUS_STEPS[currentIndex + 1];
      const updatedOrder = { 
        ...order, 
        status: nextStatus,
        collected_at: nextStatus === 'Collected' ? new Date().toISOString() : null
      };
      
      const stored = JSON.parse(localStorage.getItem('student_orders') || '[]');
      const updatedList = stored.map(o => o.id === order.id ? updatedOrder : o);
      localStorage.setItem('student_orders', JSON.stringify(updatedList));
      
      setOrder(updatedOrder);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-neutral-800 bg-neutral-100">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-4 border-neutral-200 border-t-[#e4002b] rounded-full animate-spin"></span>
          <p className="text-neutral-500 text-xs font-black uppercase">Loading Refectory Token status...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="bg-white border border-neutral-200 p-8 text-center max-w-md mx-auto mt-12 space-y-4 rounded-2xl shadow-md">
        <p className="text-[#e4002b] font-black uppercase">{error || 'Order not found'}</p>
        <Link to="/student/canteen" className="inline-block px-5 py-2.5 bg-[#e4002b] text-white rounded-xl text-xs font-black uppercase tracking-wider">
          Return to Canteen Menu
        </Link>
      </div>
    );
  }

  const currentStatusIndex = STATUS_STEPS.indexOf(order.status);
  const formattedReadyTime = new Date(order.estimated_ready_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const qrString = JSON.stringify({
    order_id: order.id,
    service: 'canteen',
    user_roll_no: user?.roll_no,
    amount: order.amount,
    signature: order.qr_signature
  });

  return (
    <div className="max-w-md mx-auto space-y-6 text-left pb-10">
      <Link to="/student/canteen" className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-800 transition-colors font-bold uppercase">
        <ArrowLeft className="w-4 h-4" /> Return to Menu
      </Link>

      <div className="flex justify-between items-center">
        <h1 className="text-xl font-black text-neutral-850 tracking-tight uppercase m-0">Token Tracker</h1>
        <button 
          onClick={fetchOrder} 
          className="p-2 bg-white border border-neutral-200 rounded-xl hover:border-neutral-350 text-neutral-500 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Status Panel */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-6 shadow-md text-center">
        
        {/* Token Card */}
        <div>
          <span className="text-[10px] text-neutral-450 uppercase font-black tracking-wider">Your Order Token</span>
          <p className="text-5xl font-black text-neutral-850 mt-1 tracking-widest">#{order.token_no}</p>
        </div>

        {/* Dynamic Status Display */}
        <div className={`p-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wide ${
          order.status === 'Collected'
            ? 'bg-neutral-50 border-neutral-200 text-neutral-500'
            : order.status === 'Ready'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-[#e4002b]'
        }`}>
          {order.status === 'Collected' ? (
            <CheckCircle2 className="w-4 h-4 text-neutral-500 shrink-0" />
          ) : (
            <Clock className="w-4 h-4 animate-pulse shrink-0" />
          )}
          <span>
            {order.status === 'Collected'
              ? 'Token Collected'
              : order.status === 'Ready'
              ? 'Meal is ready!'
              : `Status: ${order.status}`}
          </span>
        </div>

        {/* Estimated Ready Callout */}
        {order.status !== 'Collected' && (
          <div className="bg-neutral-50 border border-neutral-250 rounded-xl p-3 text-xs text-neutral-500 flex items-center gap-2 font-semibold">
            <Info className="w-4 h-4 text-neutral-400 shrink-0" />
            <p>Estimated preparation completion: <span className="text-[#e4002b] font-black">{formattedReadyTime}</span></p>
          </div>
        )}

        {/* Stepper Progress */}
        <div className="grid grid-cols-4 gap-2 pt-2">
          {STATUS_STEPS.map((step, idx) => {
            const isCompleted = idx <= currentStatusIndex;
            const isActive = idx === currentStatusIndex;
            return (
              <div key={step} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                  isActive 
                    ? 'border-[#e4002b] bg-red-50 text-[#e4002b] font-black scale-105 shadow'
                    : isCompleted 
                    ? 'border-green-600 bg-green-55 text-green-750'
                    : 'border-neutral-200 bg-white text-neutral-400 font-bold'
                }`}>
                  {isCompleted && !isActive ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <span className="text-xs font-black">{idx + 1}</span>
                  )}
                </div>
                <span className={`text-[8px] font-black mt-2 uppercase tracking-widest ${
                  isActive ? 'text-[#e4002b]' : isCompleted ? 'text-neutral-500' : 'text-neutral-400'
                }`}>
                  {step}
                </span>
              </div>
            );
          })}
        </div>

        {/* QR Code Presentation */}
        {order.status !== 'Collected' ? (
          <div className="flex flex-col items-center space-y-4 border-t border-neutral-100 pt-6">
            <div>
              <p className="text-xs font-black text-neutral-800 uppercase tracking-tight">Present Ticket QR Code</p>
              <p className="text-[10px] text-neutral-400 mt-1 font-semibold">Scan at the counter desk to complete collection</p>
            </div>
            
            <div className="p-3 bg-white rounded-xl border border-neutral-200 shadow-sm">
              <QRCodeSVG
                value={qrString}
                size={160}
                level="M"
                includeMargin={false}
              />
            </div>
          </div>
        ) : (
          <div className="border-t border-neutral-100 pt-6 text-neutral-405 text-xs font-bold uppercase tracking-wider">
            Closed at {new Date(order.collected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}

        {/* Mock Controls for Demo */}
        {isMockMode && order.status !== 'Collected' && (
          <div className="border-t border-neutral-150 pt-4 mt-2">
            <p className="text-[9px] text-[#e4002b] font-black uppercase tracking-widest mb-2.5">Simulate Store Clerk Scans</p>
            <button
              onClick={advanceMockStatus}
              className="py-1.5 px-3 bg-neutral-800 hover:bg-neutral-900 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              Advance State →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
