'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'

const exams = ['UPSC CSE', 'GATE CS', 'GATE ECE', 'JEE Mains', 'JEE Advanced', 'NEET', 'CAT', 'IBPS PO', 'SBI PO', 'SSC CGL']

const features = [
  { icon: '🗺️', title: 'AI Roadmap', desc: 'Personalized study plan built around your exam date and current level.' },
  { icon: '🃏', title: 'Smart Flashcards', desc: 'Spaced repetition ensures you remember what you learn — forever.' },
  { icon: '⚡', title: 'Adaptive Quizzes', desc: 'Fresh AI-generated questions every session, exam-pattern aligned.' },
  { icon: '🤖', title: 'AI Tutor', desc: 'Ask anything. Get concise, exam-focused explanations instantly.' },
  { icon: '📊', title: 'Progress Analytics', desc: 'Know exactly where you stand and what to fix next.' },
  { icon: '🔥', title: 'Streak & XP', desc: 'Gamified learning keeps you consistent over months.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0F1E]/80 backdrop-blur-md border-b border-[#1F2937]">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="text-xl font-bold gradient-text">Mindly</span>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-gray-400 hover:text-white text-sm transition-colors">
              Log in
            </Link>
            <Link href="/auth/signup" className="bg-[#4F8EF7] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#3B7AE8] transition-colors">
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-20 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 bg-[#4F8EF7]/10 border border-[#4F8EF7]/20 rounded-full px-4 py-1.5 mb-6 text-sm text-[#4F8EF7]">
            <span>✨</span> AI-powered exam prep for Indian aspirants
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4">
            Crack your exam with<br />
            <span className="gradient-text">personalised AI prep</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto mb-8">
            AI roadmaps, smart flashcards, adaptive quizzes and an always-on tutor — all built specifically for UPSC, GATE, JEE, NEET, CAT, IBPS and more.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/signup" className="bg-[#4F8EF7] text-white px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-[#3B7AE8] transition-colors glow-blue">
              Start Preparing Free →
            </Link>
            <Link href="/auth/login" className="bg-[#1F2937] text-white px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-[#374151] transition-colors">
              Already a member
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Exam badges */}
      <section className="pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-gray-500 text-sm mb-6">Covering all major competitive exams</p>
          <div className="flex flex-wrap justify-center gap-2">
            {exams.map(exam => (
              <span key={exam} className="bg-[#1F2937] border border-[#374151] text-gray-300 px-3 py-1.5 rounded-full text-sm">
                {exam}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-[#0D1220]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">Everything you need to clear it</h2>
          <p className="text-gray-400 text-center mb-12">Built by toppers, powered by AI, designed for Indian exam patterns.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 hover:border-[#4F8EF7]/40 transition-colors"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-white mb-1">{f.title}</h3>
                <p className="text-gray-400 text-sm">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-3">Simple, transparent pricing</h2>
          <p className="text-gray-400 mb-10">Start free. Upgrade when you need more.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: 'Free', price: '₹0', period: 'forever', features: ['1 AI roadmap', '20 flashcards/day', '5 quiz questions/day', '10 AI tutor messages/day'], cta: 'Start Free', highlight: false },
              { name: 'Pro', price: '₹399', period: '/month', features: ['Everything unlimited', 'Full mock tests', 'Roadmap PDF export', '3 streak freezes/week'], cta: 'Go Pro', highlight: true, badge: 'Most Popular' },
              { name: 'Exam Pack', price: '₹999', period: '/month', features: ['Everything in Pro', 'AI gap analysis', 'Daily intervention alerts', 'Priority support'], cta: 'Get Pack', highlight: false },
            ].map(plan => (
              <div key={plan.name} className={`rounded-2xl p-6 border ${plan.highlight ? 'bg-[#4F8EF7]/10 border-[#4F8EF7] glow-blue' : 'bg-[#111827] border-[#1F2937]'}`}>
                {plan.badge && (
                  <span className="bg-[#4F8EF7] text-white text-xs px-2 py-0.5 rounded-full mb-3 inline-block">{plan.badge}</span>
                )}
                <div className="text-lg font-semibold mb-1">{plan.name}</div>
                <div className="text-3xl font-bold text-white mb-0.5">{plan.price}</div>
                <div className="text-gray-500 text-sm mb-4">{plan.period}</div>
                <ul className="text-sm text-gray-400 space-y-2 mb-6 text-left">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="text-[#4F8EF7] mt-0.5">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className={`block w-full py-2.5 rounded-xl font-medium text-sm transition-colors text-center ${plan.highlight ? 'bg-[#4F8EF7] text-white hover:bg-[#3B7AE8]' : 'bg-[#1F2937] text-white hover:bg-[#374151]'}`}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 text-center bg-[#0D1220]">
        <h2 className="text-3xl font-bold mb-3">Your exam won&apos;t wait. Start today.</h2>
        <p className="text-gray-400 mb-6">Join thousands of aspirants preparing smarter with Mindly.</p>
        <Link href="/auth/signup" className="bg-[#4F8EF7] text-white px-8 py-3.5 rounded-xl font-semibold inline-block hover:bg-[#3B7AE8] transition-colors">
          Create Free Account →
        </Link>
      </section>

      <footer className="py-6 px-4 border-t border-[#1F2937] text-center text-gray-600 text-sm">
        © 2025 Mindly. Built for Indian aspirants.
      </footer>
    </div>
  )
}
