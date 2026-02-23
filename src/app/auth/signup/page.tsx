'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function SignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('users').upsert({ id: user.id, name: form.name, email: form.email })
      }

      toast.success('Account created! Let\'s set up your profile.')
      router.push('/onboarding')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6">
      <h2 className="text-xl font-bold text-white mb-1">Create your account</h2>
      <p className="text-gray-400 text-sm mb-6">Start preparing smarter, for free</p>

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1.5">Full name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Arjun Sharma"
            required
            className="w-full bg-[#0A0F1E] border border-[#374151] text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#4F8EF7] transition-colors"
          />
        </div>
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
          <label className="block text-sm text-gray-400 mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="At least 8 characters"
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
          Create Account
        </button>
      </form>

      <p className="mt-5 text-center text-gray-500 text-sm">
        Already have an account?{' '}
        <Link href="/auth/login" className="text-[#4F8EF7] hover:underline">Log in</Link>
      </p>
    </div>
  )
}
