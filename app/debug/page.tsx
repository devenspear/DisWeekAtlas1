'use client'

import { useState } from 'react'

export default function DebugPage() {
  const [sql, setSql] = useState('SELECT COUNT(*) as total_articles FROM "Article"')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const executeQuery = async () => {
    if (!sql.trim()) return
    
    setLoading(true)
    setError(null)
    setResult(null)
    
    try {
      const res = await fetch('/api/debug/sql-console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sql.trim() })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setResult(data)
      } else {
        setError(data.error || 'Query failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const presetQueries = [
    { 
      label: 'Issue Count', 
      sql: 'SELECT COUNT(*) as issue_count FROM "Issue"' 
    },
    { 
      label: 'Recent Issues', 
      sql: 'SELECT "issueDate", "subjectLine" FROM "Issue" ORDER BY "issueDate" DESC LIMIT 10' 
    },
    { 
      label: 'Article Distribution', 
      sql: 'SELECT COUNT(*) as articles, i."issueDate" FROM "Article" a JOIN "Issue" i ON a."issueId" = i.id GROUP BY i."issueDate" ORDER BY i."issueDate" DESC LIMIT 20' 
    },
    { 
      label: 'Search Unitree', 
      sql: "SELECT a.title, i.\"issueDate\", a.\"sourceUrl\" FROM \"Article\" a JOIN \"Issue\" i ON a.\"issueId\" = i.id WHERE LOWER(a.title) LIKE '%unitree%' ORDER BY i.\"issueDate\" DESC" 
    },
    { 
      label: 'Missing Recent Weeks', 
      sql: "SELECT \"issueDate\" FROM \"Issue\" WHERE \"issueDate\" >= '2025-06-01' ORDER BY \"issueDate\" DESC" 
    }
  ]

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Database Debug Console</h1>
        <p className="text-zinc-400">
          Direct SQL access to troubleshoot database issues. Only SELECT queries allowed in production.
        </p>
      </div>

      {/* Preset Queries */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Quick Queries</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {presetQueries.map((preset, i) => (
            <button
              key={i}
              onClick={() => setSql(preset.sql)}
              className="text-left p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
            >
              <div className="font-medium">{preset.label}</div>
              <div className="text-zinc-400 text-xs mt-1 truncate">{preset.sql.substring(0, 40)}...</div>
            </button>
          ))}
        </div>
      </div>

      {/* SQL Input */}
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">SQL Query</label>
          <textarea
            value={sql}
            onChange={e => setSql(e.target.value)}
            className="w-full h-32 p-3 bg-zinc-900 border border-zinc-700 rounded-lg font-mono text-sm resize-none focus:border-zinc-500 focus:outline-none"
            placeholder="SELECT * FROM "Issue" LIMIT 10"
          />
        </div>
        
        <button
          onClick={executeQuery}
          disabled={loading || !sql.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Executing...
            </>
          ) : (
            'Execute Query'
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-300">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <span>⚡ {result.executionTime}</span>
            <span>📊 {result.rowCount} rows</span>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden">
            <div className="p-3 bg-zinc-800 border-b border-zinc-700 font-medium text-sm">
              Query Results
            </div>
            <div className="p-4 overflow-auto max-h-96">
              <pre className="text-sm">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}