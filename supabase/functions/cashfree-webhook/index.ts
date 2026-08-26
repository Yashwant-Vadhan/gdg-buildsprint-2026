import { ServeHandler } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// HMAC-SHA256 Helper using native Web Crypto API
async function verifyHmacSha256(secret: string, data: string, signatureBase64: string): Promise<boolean> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(data)
  
  const key = await crypto.subtle.importKey(
    "raw", 
    keyData, 
    { name: "HMAC", hash: "SHA-256" }, 
    false, 
    ["verify"]
  )

  // Convert base64 signature to Uint8Array
  const binaryString = atob(signatureBase64)
  const signatureBytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    signatureBytes[i] = binaryString.charCodeAt(i)
  }

  return await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    messageData
  )
}

const handler: ServeHandler = async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const signature = req.headers.get('x-webhook-signature') || ''
    const rawBody = await req.text()

    const secretKey = Deno.env.get('CASHFREE_SECRET_KEY') ?? ''
    const isSignatureValid = await verifyHmacSha256(secretKey, rawBody, signature)

    if (!isSignatureValid) {
      return new Response(JSON.stringify({ success: false, error: 'Signature mismatch' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const payload = JSON.parse(rawBody)
    const orderId = payload.data.order.order_id
    const txStatus = payload.data.payment.payment_status

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    if (txStatus === 'SUCCESS') {
      const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('id', orderId)
        .single()

      if (payment && payment.status === 'pending') {
        const { data: user } = await supabase
          .from('users')
          .select('roll_no')
          .eq('id', payment.user_id)
          .single()

        const { data: items } = await supabase
          .from('canteen_items')
          .select('id, prep_time_min, price')
          .limit(1)

        const item = items?.[0]
        if (item) {
          await supabase.rpc('decrement_stock', {
            p_table: 'canteen_items',
            p_item_id: item.id,
            p_qty: 1
          })

          const { count } = await supabase
            .from('canteen_orders')
            .select('*', { count: 'exact', head: true })
            .in('status', ['Received', 'Preparing'])

          const queuePos = count || 0
          const estReady = new Date(Date.now() + (item.prep_time_min * (queuePos + 1)) * 60000)

          const { data: order } = await supabase
            .from('canteen_orders')
            .insert({
              user_id: payment.user_id,
              item_id: item.id,
              qty: 1,
              amount: payment.amount,
              status: 'Received',
              estimated_ready_at: estReady.toISOString(),
              payment_id: payment.id
            })
            .select('id')
            .single()

          await supabase
            .from('payments')
            .update({ status: 'success', order_ref: order?.id })
            .eq('id', orderId)

          if (order) {
            await fetch(`${Deno.env.get('SUPABASE_FUNCTION_URL')}/generate-order-qr`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_id: order.id,
                service: 'canteen',
                user_roll_no: user?.roll_no || 'UNKNOWN'
              })
            })
          }
        }
      }
    } else {
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', orderId)
    }

    return new Response(JSON.stringify({ success: true }), {
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
