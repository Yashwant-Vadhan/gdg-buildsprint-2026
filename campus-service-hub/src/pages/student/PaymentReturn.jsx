import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { waitForPaymentResult } from '../../services/cashfree/cashfreeClient';
import { XCircle, Loader2 } from 'lucide-react';

/**
 * Cashfree redirects the browser here after the hosted checkout completes (see the
 * return_url set server-side in create-cashfree-order). Actual order creation happens
 * async via cashfree-webhook (server-to-server), so this page polls until that's done
 * rather than assuming success just because the browser made it back.
 */
export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState('checking'); // checking | success | failed | timeout
  const orderId = searchParams.get('order_id');

  useEffect(() => {
    if (!orderId) {
      setState('failed');
      return;
    }
    waitForPaymentResult(orderId).then((result) => {
      if (result.status === 'success' && result.order_ref) {
        const firstOrderId = result.order_ref.split(',')[0];
        navigate(`/student/canteen/status/${firstOrderId}`, { replace: true });
      } else if (result.status === 'failed') {
        setState('failed');
      } else {
        setState('timeout');
      }
    });
  }, [orderId, navigate]);

  if (state === 'checking') {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-4">
        <Loader2 className="w-10 h-10 text-brand animate-spin mx-auto" />
        <p className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
          Confirming your payment…
        </p>
      </div>
    );
  }

  if (state === 'timeout') {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-4">
        <Loader2 className="w-10 h-10 text-amber-500 mx-auto" />
        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
          Still confirming — this is taking longer than expected. Check your order history
          in a moment, or contact the canteen desk if the amount was debited.
        </p>
        <Link to="/student/canteen" className="inline-block px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold uppercase tracking-wider">
          Back to Canteen Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16 text-center space-y-4">
      <XCircle className="w-10 h-10 text-red-600 mx-auto" />
      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">Payment failed or was cancelled.</p>
      <p className="text-xs text-slate-500">No order was created — you haven't been charged.</p>
      <Link to="/student/canteen" className="inline-block px-4 py-2 bg-brand text-white rounded-xl text-xs font-bold uppercase tracking-wider">
        Back to Canteen Menu
      </Link>
    </div>
  );
}
