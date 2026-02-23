'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })
      if (error) throw error

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('onboarding_complete')
          .eq('id', user.id)
          .single()

        router.push(userData?.onboarding_complete ? '/dashboard' : '/onboarding')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6">
      <h2 className="text-xl font-bold text-white mb-1">Welcome back</h2>
      <p className="text-gray-400 text-sm mb-6">Continue your preparation</p>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Email address</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            placeholder="arjun@example.com"
            required
            className="w-full bg-[#0A0F1E] border border-[#374151] text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#4F8EF7] transition-colors"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm text-gray-400">Password</label>
            <Link href="/auth/forgot-password" className="text-xs text-[#4F8EF7] hover:underline">Forgot?</Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Your password"
              required
              className="w-full bg-[#0A0F1E] border border-[#374151] text-white placeholder-gray-600 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:border-[#4F8EF7] transition-colors"
            />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-3 text-gray-500 hover:text-gray-300">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#4F8EF7] hover:bg-[#3B7AE8] text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Log In
        </button>
      </form>

      <p className="mt-5 text-center text-gray-500 text-sm">
        New to Mindly?{' '}
        <Link href="/auth/signup" className="text-[#4F8EF7] hover:underline">Create account</Link>
      </p>
    </div>
  )
}
