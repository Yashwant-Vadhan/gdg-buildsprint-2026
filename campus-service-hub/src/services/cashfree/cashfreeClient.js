import { load } from '@cashfreepayments/cashfree-js';
import { supabase } from '../../lib/supabaseClient';

let cashfreePromise = null;

// Cashfree's SDK instance is loaded once and reused — re-loading it per-checkout
// is unnecessary and slower. Always sandbox mode here; never point this at "production".
function getCashfree() {
  if (!cashfreePromise) {
    cashfreePromise = load({ mode: 'sandbox' });
  }
  return cashfreePromise;
}

/**
 * Creates a Cashfree order for a canteen purchase (single item or a full cart) via the
 * create-cashfree-order Edge Function, then opens Cashfree's hosted checkout for it.
 *
 * @param {{ items: {item_id: string, qty: number}[], userId: string }} params
 * @returns {Promise<{ paymentsId: string }>} resolves once checkout() has been *launched*
 *   — the browser navigates to Cashfree next, so the caller won't see a normal return;
 *   payment completion is handled server-side by the webhook, and the browser comes back
 *   via the return_url configured server-side (see PaymentReturn.jsx).
 */
export async function payCanteenCart({ items, userId }) {
  const { data, error } = await supabase.functions.invoke('create-cashfree-order', {
    body: { items, user_id: userId },
  });

  if (error) throw new Error(error.message || 'Failed to start payment');
  if (!data?.success) throw new Error(data?.error || 'Failed to start payment');

  const { payment_session_id: paymentSessionId, payments_id: paymentsId } = data.data;

  const cashfree = await getCashfree();
  await cashfree.checkout({
    paymentSessionId,
    redirectTarget: '_self',
  });

  return { paymentsId };
}

/**
 * Polls the payments table until the webhook has processed it (status leaves 'pending'),
 * or until `timeoutMs` elapses. Used by PaymentReturn.jsx after Cashfree redirects back —
 * the webhook runs server-to-server and may land slightly after the browser redirect does.
 */
export async function waitForPaymentResult(paymentId, { intervalMs = 1500, timeoutMs = 30000 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const { data, error } = await supabase
      .from('payments')
      .select('status, order_ref')
      .eq('id', paymentId)
      .single();

    if (!error && data && data.status !== 'pending') {
      return data;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { status: 'pending', order_ref: null };
}
