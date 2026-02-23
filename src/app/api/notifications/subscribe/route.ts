import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Store web push subscription for a user
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { subscription } = await req.json()
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    // Store in push_subscriptions table (upsert by endpoint)
    await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh,
      auth: subscription.keys?.auth,
    }, { onConflict: 'endpoint' })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Push Subscribe]', err)
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { endpoint } = await req.json()
    await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Push Unsubscribe]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
