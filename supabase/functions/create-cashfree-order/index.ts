import { ServeHandler } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const handler: ServeHandler = async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    // Accepts either a single item ({ item_id, qty }) or a cart ({ items: [{item_id, qty}, ...] }).
    // Both are normalized to the same cart shape so one code path (and the webhook that
    // reads it back) handles single-item and multi-item checkout identically.
    const cartInput = Array.isArray(body.items) && body.items.length > 0
      ? body.items
      : [{ item_id: body.item_id, qty: body.qty }]
    const user_id = body.user_id

    if (!user_id || cartInput.some((c: any) => !c.item_id || !c.qty)) {
      return new Response(JSON.stringify({ success: false, error: 'Missing item_id/qty/user_id' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Validate every item and lock in its price server-side (never trust a client-supplied price).
    const cartItems = []
    for (const line of cartInput) {
      const { data: item, error: itemError } = await supabase
        .from('canteen_items')
        .select('id, name, price, quantity_available, is_available')
        .eq('id', line.item_id)
        .single()

      if (itemError || !item) {
        return new Response(JSON.stringify({ success: false, error: `Item not found: ${line.item_id}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        })
      }
      if (!item.is_available || item.quantity_available < line.qty) {
        return new Response(JSON.stringify({ success: false, error: `out_of_stock: ${item.name}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        })
      }
      cartItems.push({ item_id: item.id, qty: line.qty, price: Number(item.price) })
    }

    const amount = cartItems.reduce((sum, c) => sum + c.price * c.qty, 0)
    const cashfreeAppId = Deno.env.get('CASHFREE_APP_ID') ?? ''
    const cashfreeSecretKey = Deno.env.get('CASHFREE_SECRET_KEY') ?? ''
    // Hardcoded as an ultimate fallback (not just derived from SUPABASE_URL) — a prior
    // deploy showed notify_url resolving to the literal string "undefined/...", so this
    // removes any ambiguity about env var availability at runtime.
    const functionsUrl = Deno.env.get('SUPABASE_FUNCTION_URL')
      || (supabaseUrl ? `${supabaseUrl}/functions/v1` : '')
      || 'https://ozfpxfhnzewhfzanhfvd.supabase.co/functions/v1'
    // Where Cashfree sends the browser back after payment. Falls back to a same-origin
    // relative path if FRONTEND_URL isn't set, which only works if Cashfree is given an
    // absolute URL — FRONTEND_URL must be set for this to actually work (see README note).
    const frontendUrl = Deno.env.get('FRONTEND_URL') ?? ''

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id,
        service: 'canteen',
        amount,
        method: 'cashfree_upi',
        status: 'pending',
        cart_items: cartItems
      })
      .select('id')
      .single()

    if (paymentError || !payment) {
      return new Response(JSON.stringify({ success: false, error: 'Failed to initialize payment ledger' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      })
    }

    const cashfreeResponse = await fetch('https://sandbox.cashfree.com/pg/orders', {
      method: 'POST',
      headers: {
        'x-client-id': cashfreeAppId,
        'x-client-secret': cashfreeSecretKey,
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        order_id: payment.id,
        order_amount: amount,
        order_currency: 'INR',
        customer_details: {
          customer_id: user_id,
          customer_phone: '9999999999'
        },
        order_meta: {
          notify_url: `${functionsUrl}/cashfree-webhook`,
          return_url: frontendUrl
            ? `${frontendUrl}/student/canteen/payment-return?order_id={order_id}`
            : undefined
        }
      })
    })

    const cfData = await cashfreeResponse.json()

    if (!cashfreeResponse.ok) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id)
      return new Response(JSON.stringify({ success: false, error: cfData.message || 'Cashfree order creation failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      })
    }

    await supabase
      .from('payments')
      .update({ gateway_txn_id: cfData.payment_session_id })
      .eq('id', payment.id)

    return new Response(JSON.stringify({
      success: true,
      data: {
        payment_session_id: cfData.payment_session_id,
        payments_id: payment.id
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
}

Deno.serve(handler)
