import type { Metadata, Viewport } from "next"
import "./globals.css"
import { Toaster } from "react-hot-toast"

export const metadata: Metadata = {
  title: "Mindly — AI-Powered Competitive Exam Prep",
  description: "Prepare smarter for UPSC, GATE, JEE, NEET, CAT, IBPS, SSC and more with AI-powered roadmaps, flashcards, and quizzes.",
  keywords: ["UPSC", "GATE", "JEE", "NEET", "CAT", "competitive exam", "exam preparation", "AI tutor"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mindly",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0A0F1E",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-text-primary antialiased min-h-screen">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1F2937',
              color: '#F9FAFB',
              border: '1px solid #374151',
            },
            success: {
              iconTheme: { primary: '#4F8EF7', secondary: '#0A0F1E' },
            },
            error: {
              iconTheme: { primary: '#EF4444', secondary: '#0A0F1E' },
            },
          }}
        />
      </body>
    </html>
  )
}
