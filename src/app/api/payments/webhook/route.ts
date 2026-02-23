import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-razorpay-signature')

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex')

    if (signature !== expectedSignature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(body)
    const admin = createAdminClient()

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity
      const orderId = payment.order_id
      const paymentId = payment.id
      const notes = payment.notes

      const { data: paymentRecord } = await admin
        .from('payments')
        .update({ razorpay_payment_id: paymentId, status: 'success' })
        .eq('razorpay_order_id', orderId)
        .select()
        .single()

      if (paymentRecord && notes?.user_id) {
        const plan = notes.plan || paymentRecord.plan
        const billing = notes.billing || 'monthly'

        const expiryDate = new Date()
        if (billing === 'annual') {
          expiryDate.setFullYear(expiryDate.getFullYear() + 1)
        } else {
          expiryDate.setMonth(expiryDate.getMonth() + 1)
        }

        await admin
          .from('users')
          .update({ plan, plan_expiry: expiryDate.toISOString() })
          .eq('id', notes.user_id)
      }
    }

    if (event.event === 'payment.failed') {
      const payment = event.payload.payment.entity
      await admin
        .from('payments')
        .update({ status: 'failed' })
        .eq('razorpay_order_id', payment.order_id)
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    console.error('[Razorpay Webhook]', err)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}
