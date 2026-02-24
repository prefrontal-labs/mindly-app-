import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, plan, billing } = await req.json()

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !plan) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Verify client-side signature: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
    }

    // Compute expiry
    const expiryDate = new Date()
    if (billing === 'annual') {
      expiryDate.setFullYear(expiryDate.getFullYear() + 1)
    } else {
      expiryDate.setMonth(expiryDate.getMonth() + 1)
    }
    const planExpiry = expiryDate.toISOString()

    // Try admin client first (bypasses RLS), fall back to user client
    let updateError: unknown = null
    try {
      const admin = createAdminClient()
      const { error } = await admin
        .from('users')
        .update({ plan, plan_expiry: planExpiry })
        .eq('id', user.id)
      updateError = error
    } catch (e) {
      updateError = e
    }

    // Fallback: user-session client (works if RLS allows self-update or service key missing)
    if (updateError) {
      console.warn('[Payment Verify] Admin update failed, trying user client:', updateError)
      const { error: fallbackError } = await supabase
        .from('users')
        .update({ plan, plan_expiry: planExpiry })
        .eq('id', user.id)
      if (fallbackError) {
        console.error('[Payment Verify] Both update attempts failed:', fallbackError)
        return NextResponse.json({ error: 'Failed to activate plan — please contact support' }, { status: 500 })
      }
    }

    // Record payment
    try {
      const admin = createAdminClient()
      await admin
        .from('payments')
        .insert({
          user_id: user.id,
          razorpay_order_id,
          razorpay_payment_id,
          amount: plan === 'pro' ? (billing === 'annual' ? 299900 : 39900) : 99900,
          plan,
          status: 'success',
        })
    } catch {
      // Non-critical — plan is already activated
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Payment Verify]', err)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
