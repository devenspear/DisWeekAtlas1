import './globals.css'
import { ReactNode } from 'react'
import { Header } from '@/components/layout/Header'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-black text-zinc-100">
        <Header />
        <div className="max-w-6xl mx-auto p-6">
          {children}
        </div>
      </body>
    </html>
  )
}
