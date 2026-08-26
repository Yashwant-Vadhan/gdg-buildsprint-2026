import { ServeHandler } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// HMAC-SHA256 Sign Helper using native Web Crypto API
async function signHmacSha256(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(data)
  
  const key = await crypto.subtle.importKey(
    "raw", 
    keyData, 
    { name: "HMAC", hash: "SHA-256" }, 
    false, 
    ["sign"]
  )
  
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData)
  
  // Convert buffer to hex string
  return Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("")
}

const handler: ServeHandler = async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { order_id, service, user_roll_no } = await req.json()

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const table =
      service === 'canteen' ? 'canteen_orders' :
      service === 'store' ? 'store_orders' : 'laundry_orders'

    const { data: order, error } = await supabase
      .from(table)
      .select('amount')
      .eq('id', order_id)
      .single()

    if (error || !order) {
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const payload = JSON.stringify({
      order_id,
      service,
      user_roll_no,
      amount: order.amount,
      issued_at: new Date().toISOString()
    })

    const qrSecret = Deno.env.get('QR_SECRET') ?? 'fallback-secret-key-12345'
    const signature = await signHmacSha256(qrSecret, payload)

    await supabase
      .from(table)
      .update({
        qr_payload: payload,
        qr_signature: signature
      })
      .eq('id', order_id)

    return new Response(JSON.stringify({ success: true, data: { payload, signature } }), {
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
