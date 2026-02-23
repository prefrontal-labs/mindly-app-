import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Razorpay from 'razorpay'

const PLAN_PRICES: Record<string, { monthly: number; annual?: number }> = {
  pro: { monthly: 39900, annual: 299900 },      // in paise
  exam_pack: { monthly: 99900 },
}

export async function POST(req: NextRequest) {
  try {
    const razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { plan, billing = 'monthly' } = await req.json()

    if (!PLAN_PRICES[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const amount = billing === 'annual' && PLAN_PRICES[plan].annual
      ? PLAN_PRICES[plan].annual
      : PLAN_PRICES[plan].monthly

    const order = await razorpay.orders.create({
      amount: amount!,
      currency: 'INR',
      receipt: `mindly_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: { user_id: user.id, plan, billing },
    })

    // Save pending payment
    await supabase.from('payments').insert({
      user_id: user.id,
      plan,
      amount: amount! / 100,
      razorpay_order_id: order.id,
      status: 'pending',
    })

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    })
  } catch (err) {
    console.error('[Razorpay Create Order]', err)
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }
}
