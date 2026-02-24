'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Zap, Crown, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const PLANS = [
  {
    id: 'pro',
    name: 'Pro',
    icon: '⚡',
    monthlyPrice: 399,
    annualPrice: 2999,
    color: '#4F8EF7',
    features: [
      'Unlimited AI flashcards',
      'Unlimited quiz questions',
      'Unlimited AI tutor messages',
      'Full analytics & readiness score',
      'PDF roadmap export',
      '3 streak freezes / week',
      'Mock tests access',
    ],
  },
  {
    id: 'exam_pack',
    name: 'Exam Pack',
    icon: '👑',
    monthlyPrice: 999,
    annualPrice: null,
    color: '#F59E0B',
    badge: 'Best Value',
    features: [
      'Everything in Pro',
      'Priority AI responses',
      'Personalised weak-topic drills',
      'Past year question bank',
      'Score prediction report',
      'Direct doubt resolution queue',
    ],
  },
]

const FREE_LIMITS = [
  '20 flashcards / day',
  '5 quiz questions / day',
  '10 AI tutor messages / day',
  'Basic dashboard',
  'No mock tests',
]

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void }
  }
}

interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description: string
  theme: { color: string }
  handler: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void
  modal: { ondismiss: () => void }
}

export default function UpgradePage() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState<string | null>(null)

  async function handleUpgrade(planId: string) {
    setLoading(planId)
    try {
      // Create Razorpay order
      const res = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, billing }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      // Load Razorpay script dynamically
      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://checkout.razorpay.com/v1/checkout.js'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('Failed to load Razorpay'))
          document.body.appendChild(script)
        })
      }

      const plan = PLANS.find(p => p.id === planId)!
      const options: RazorpayOptions = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        order_id: data.order_id,
        name: 'Mindly',
        description: `${plan.name} Plan — ${billing === 'annual' ? 'Annual' : 'Monthly'}`,
        theme: { color: plan.color },
        handler: async (response) => {
          try {
            const res = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                plan: planId,
                billing,
              }),
            })
            if (!res.ok) throw new Error('Verification failed')
            toast.success(`🎉 Welcome to Mindly ${plan.name}!`)
            setTimeout(() => window.location.href = '/dashboard', 1500)
          } catch {
            toast.error('Payment recorded — please contact support if plan not updated.')
          }
        },
        modal: {
          ondismiss: () => setLoading(null),
        },
      }

      new window.Razorpay(options).open()
    } catch {
      toast.error('Failed to initiate payment. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-24 space-y-5">
      {/* Header */}
      <div className="text-center">
        <div className="text-4xl mb-2">🚀</div>
        <h1 className="text-2xl font-bold text-white">Upgrade Mindly</h1>
        <p className="text-gray-400 text-sm mt-1">Unlock unlimited AI-powered exam prep</p>
      </div>

      {/* Billing toggle */}
      <div className="flex bg-[#111827] border border-[#1F2937] rounded-xl p-1 gap-1">
        <button
          onClick={() => setBilling('monthly')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
            billing === 'monthly' ? 'bg-[#4F8EF7] text-white' : 'text-gray-400'
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setBilling('annual')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors relative ${
            billing === 'annual' ? 'bg-[#4F8EF7] text-white' : 'text-gray-400'
          }`}
        >
          Annual
          <span className="ml-1.5 bg-[#10B981] text-black text-[10px] font-bold px-1.5 rounded-full">37% off</span>
        </button>
      </div>

      {/* Plan cards */}
      {PLANS.map((plan, i) => {
        const perMonth = billing === 'annual' && plan.annualPrice
          ? Math.round(plan.annualPrice / 12)
          : plan.monthlyPrice

        return (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-[#111827] rounded-2xl overflow-hidden"
            style={{ border: `1px solid ${plan.color}30` }}
          >
            {plan.badge && (
              <div className="text-center py-1.5 text-xs font-bold" style={{ background: `${plan.color}20`, color: plan.color }}>
                {plan.badge}
              </div>
            )}
            <div className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xl">{plan.icon}</span>
                    <span className="text-white font-bold text-lg">{plan.name}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black" style={{ color: plan.color }}>₹{perMonth}</span>
                    <span className="text-gray-500 text-sm">/mo</span>
                  </div>
                  {billing === 'annual' && plan.annualPrice && (
                    <p className="text-gray-500 text-xs">Billed ₹{plan.annualPrice}/year</p>
                  )}
                </div>
              </div>

              <ul className="space-y-2 mb-5">
                {plan.features.map((f, fi) => (
                  <li key={fi} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: plan.color }} />
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleUpgrade(plan.id)}
                disabled={loading === plan.id}
                className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                style={{ background: plan.color, color: plan.id === 'pro' ? 'white' : 'black' }}
              >
                {loading === plan.id
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : plan.id === 'exam_pack' ? <Crown className="w-4 h-4" /> : <Zap className="w-4 h-4" />
                }
                {loading === plan.id ? 'Processing...' : `Get ${plan.name}`}
              </button>
            </div>
          </motion.div>
        )
      })}

      {/* Free plan comparison */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4">
        <h3 className="text-gray-400 text-sm font-medium mb-3">Free plan limits</h3>
        <ul className="space-y-1.5">
          {FREE_LIMITS.map((l, i) => (
            <li key={i} className="text-gray-600 text-sm flex items-center gap-2">
              <span className="text-red-500/60">✗</span> {l}
            </li>
          ))}
        </ul>
      </div>

      <div className="text-center space-y-1">
        <p className="text-gray-600 text-xs">Secure payment via Razorpay • Cancel anytime</p>
        <Link href="/dashboard" className="text-gray-600 text-xs underline">
          Continue with Free plan
        </Link>
      </div>
    </div>
  )
}
