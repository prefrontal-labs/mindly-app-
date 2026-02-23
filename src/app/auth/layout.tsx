export const dynamic = 'force-dynamic'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0A0F1E] flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold gradient-text">Mindly</h1>
          <p className="text-gray-500 text-sm mt-1">AI-powered exam preparation</p>
        </div>
        {children}
      </div>
    </div>
  )
}
