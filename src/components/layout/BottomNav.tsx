'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Map, BookOpen, Zap, MessageCircle, BarChart2 } from 'lucide-react'

const navItems = [
  { href: '/dashboard', icon: Home, label: 'Home' },
  { href: '/roadmap', icon: Map, label: 'Roadmap' },
  { href: '/flashcards', icon: BookOpen, label: 'Cards' },
  { href: '/quiz', icon: Zap, label: 'Quiz' },
  { href: '/chat', icon: MessageCircle, label: 'Tutor' },
  { href: '/analytics', icon: BarChart2, label: 'Stats' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-[#111827]/95 backdrop-blur-md border-t border-[#1F2937] safe-bottom z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around px-2 py-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[44px] min-h-[44px] justify-center ${
                active ? 'text-[#4F8EF7]' : 'text-gray-500'
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : 'stroke-[1.5]'}`} />
              <span className={`text-[10px] font-medium ${active ? 'text-[#4F8EF7]' : ''}`}>{label}</span>
              {active && <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#4F8EF7] rounded-full" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
