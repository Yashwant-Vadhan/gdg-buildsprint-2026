import { ServeHandler } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// HMAC-SHA256 Verify Helper using native Web Crypto API
async function verifyHmacSha256(secret: string, data: string, signatureHex: string): Promise<boolean> {
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

  // Convert hex signature back to Uint8Array
  const signatureBytes = new Uint8Array(signatureHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
  
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
    const { qr_string, order_table } = await req.json()

    if (!qr_string || !order_table) {
      return new Response(JSON.stringify({ success: false, error: 'Missing parameters' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const dotIndex = qr_string.lastIndexOf('.')
    if (dotIndex === -1) {
      return new Response(JSON.stringify({ success: false, error: 'Malformed QR structure' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const payloadStr = qr_string.substring(0, dotIndex)
    const signature = qr_string.substring(dotIndex + 1)

    const qrSecret = Deno.env.get('QR_SECRET') ?? 'fallback-secret-key-12345'
    const isSignatureValid = await verifyHmacSha256(qrSecret, payloadStr, signature)

    if (!isSignatureValid) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid signature (tampered QR)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const payload = JSON.parse(payloadStr)
    const orderId = payload.order_id

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: order, error } = await supabase
      .from(order_table)
      .select('*')
      .eq('id', orderId)
      .single()

    if (error || !order) {
      return new Response(JSON.stringify({ success: false, error: 'Order not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const endStatus = order_table === 'laundry_orders' ? 'Delivered' : 'Collected'

    if (order.status === endStatus) {
      const timeField = order_table === 'laundry_orders' ? order.delivered_at : order.collected_at
      const timeStr = timeField ? new Date(timeField).toLocaleTimeString('en-IN') : 'unknown'
      return new Response(JSON.stringify({
        success: false,
        error: `already_collected`,
        collected_at: timeStr
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    const updatePayload: Record<string, any> = { status: endStatus }
    if (order_table === 'laundry_orders') {
      updatePayload.delivered_at = new Date().toISOString()
    } else {
      updatePayload.collected_at = new Date().toISOString()
    }

    await supabase
      .from(order_table)
      .update(updatePayload)
      .eq('id', orderId)

    return new Response(JSON.stringify({
      success: true,
      message: `Order successfully marked as ${endStatus}!`
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
