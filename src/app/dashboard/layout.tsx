import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BottomNav from '@/components/layout/BottomNav'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: userData } = await supabase
    .from('users')
    .select('onboarding_complete')
    .eq('id', user.id)
    .single()

  if (!userData?.onboarding_complete) redirect('/onboarding')

  return (
    <div className="min-h-screen bg-[#0A0F1E] pb-20">
      {children}
      <BottomNav />
    </div>
  )
}
