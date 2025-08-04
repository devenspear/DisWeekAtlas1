'use client'

import { useState } from 'react'

export default function DebugPage() {
  const [sql, setSql] = useState('SELECT COUNT(*) FROM "Issue"')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const executeQuery = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/debug/sql-console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      })
      const data = await res.json()
      setResult(data)
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Database Debug Console</h1>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">SQL Query</label>
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            className="w-full h-32 p-3 bg-gray-900 border border-gray-700 rounded text-white font-mono"
          />
        </div>
        
        <button
          onClick={executeQuery}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Executing...' : 'Execute Query'}
        </button>
      </div>

      {result && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Results</h2>
          <pre className="bg-gray-900 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}