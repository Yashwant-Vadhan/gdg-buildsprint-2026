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
    const { item_id, qty, user_id } = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: item, error: itemError } = await supabase
      .from('canteen_items')
      .select('name, price, quantity_available')
      .eq('id', item_id)
      .single()

    if (itemError || !item) {
      return new Response(JSON.stringify({ success: false, error: 'Item not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    if (item.quantity_available < qty) {
      return new Response(JSON.stringify({ success: false, error: 'out_of_stock' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const amount = Number(item.price) * qty
    const cashfreeAppId = Deno.env.get('CASHFREE_APP_ID') ?? ''
    const cashfreeSecretKey = Deno.env.get('CASHFREE_SECRET_KEY') ?? ''

    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        user_id,
        service: 'canteen',
        amount,
        method: 'cashfree_upi',
        status: 'pending'
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
          notify_url: `${Deno.env.get('SUPABASE_FUNCTION_URL')}/cashfree-webhook`
        }
      })
    })

    const cfData = await cashfreeResponse.json()

    if (!cashfreeResponse.ok) {
      return new Response(JSON.stringify({ success: false, error: cfData.message || 'Cashfree Order creation failed' }), {
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
