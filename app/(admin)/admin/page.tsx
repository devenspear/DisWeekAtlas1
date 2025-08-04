'use client'
import { useState } from 'react'

export default function AdminPage() {
  const [mode, setMode] = useState<'weekly'|'backfill'>('backfill')
  const [log, setLog] = useState('')

  const run = async () => {
    setLog('Running...')
    const res = await fetch(`/api/jobs/ingest?mode=${mode}`, { method: 'POST' })
    const data = await res.json()
    setLog(JSON.stringify(data, null, 2))
  }

  return (
    <main className="space-y-6">
      <section className="rounded-2xl p-6 bg-zinc-900/60 border border-zinc-800">
        <h2 className="text-xl font-semibold">Admin</h2>
        <div className="mt-4 flex gap-2">
          <select value={mode} onChange={e=>setMode(e.target.value as any)} className="rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2">
            <option value="weekly">Weekly</option>
            <option value="backfill">Backfill</option>
          </select>
          <button onClick={run} className="rounded-lg px-4 py-2 bg-white text-black">Run Ingestion</button>
        </div>
        <pre className="mt-4 text-xs whitespace-pre-wrap">{log}</pre>
      </section>
    </main>
  )
}
