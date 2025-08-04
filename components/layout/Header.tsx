import Link from 'next/link'

export function Header() {
  return (
    <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur">
      <div className="container mx-auto px-4 py-4">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-zinc-100">
            DisWeekly Atlas
          </Link>
          <div className="flex items-center space-x-4">
            <Link 
              href="/search" 
              className="text-zinc-300 hover:text-zinc-100 transition-colors"
            >
              Search
            </Link>
            <Link 
              href="/dashboard" 
              className="text-zinc-300 hover:text-zinc-100 transition-colors"
            >
              Dashboard
            </Link>
            <Link 
              href="/admin" 
              className="text-zinc-300 hover:text-zinc-100 transition-colors"
            >
              Admin
            </Link>
          </div>
        </nav>
      </div>
    </header>
  )
}