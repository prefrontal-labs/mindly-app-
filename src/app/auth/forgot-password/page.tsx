'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Loader2, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      })
      if (error) throw error
      setSent(true)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 text-center">
        <CheckCircle className="w-12 h-12 text-[#4F8EF7] mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
        <p className="text-gray-400 text-sm mb-6">
          We sent a reset link to <strong className="text-white">{email}</strong>. Check your inbox and click the link.
        </p>
        <Link href="/auth/login" className="text-[#4F8EF7] text-sm hover:underline">
          Back to login
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6">
      <Link href="/auth/login" className="flex items-center gap-1 text-gray-500 text-sm mb-5 hover:text-gray-300 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to login
      </Link>
      <h2 className="text-xl font-bold text-white mb-1">Reset password</h2>
      <p className="text-gray-400 text-sm mb-6">Enter your email and we&apos;ll send a reset link</p>
      <form onSubmit={handleReset} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Email address</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="arjun@example.com"
            className="w-full bg-[#0A0F1E] border border-[#374151] text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#4F8EF7] transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#4F8EF7] hover:bg-[#3B7AE8] text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Send Reset Link
        </button>
      </form>
    </div>
  )
}
