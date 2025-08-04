'use client'
import { useState } from 'react'

type Article = {
  id: string
  title: string
  sourceUrl: string
  sourceDomain: string
  issue: { issueDate: string }
  category?: { name: string } | null
}

export default function SearchPage() {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Article[]>([])

  const run = async () => {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setItems(data.items || [])
  }

  return (
    <main className="space-y-4">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder="Search topics, companies, sources..."
          className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2"
        />
        <button onClick={run} className="rounded-lg px-4 py-2 bg-white text-black">Search</button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {items.map(it => (
          <a key={it.id} href={it.sourceUrl} target="_blank" className="block rounded-xl p-4 bg-zinc-900 border border-zinc-800 hover:border-zinc-700">
            <div className="text-zinc-400 text-xs">{new Date(it.issue.issueDate).toDateString()} • {it.category?.name || '—'}</div>
            <div className="font-semibold mt-1">{it.title}</div>
            <div className="text-zinc-400 text-sm mt-1">{it.sourceDomain}</div>
          </a>
        ))}
      </div>
    </main>
  )
}
