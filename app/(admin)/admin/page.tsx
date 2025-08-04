'use client'
import { useState, useEffect } from 'react'

type JobRun = {
  id: string
  jobType: string
  startedAt: string
  endedAt: string | null
  status: string
  error: string | null
}

export default function AdminPage() {
  const [mode, setMode] = useState<'weekly'|'backfill'>('backfill')
  const [log, setLog] = useState('')
  const [loading, setLoading] = useState(false)
  const [dbStatus, setDbStatus] = useState<any>(null)
  const [jobHistory, setJobHistory] = useState<JobRun[]>([])
  
  // SQL Console state
  const [sql, setSql] = useState('SELECT COUNT(*) FROM "Issue"')
  const [sqlResult, setSqlResult] = useState<any>(null)
  const [sqlLoading, setSqlLoading] = useState(false)
  const [sqlError, setSqlError] = useState<string | null>(null)

  const runIngestion = async () => {
    setLoading(true)
    setLog('Running ingestion...')
    try {
      const res = await fetch(`/api/jobs/ingest?mode=${mode}`, { method: 'POST' })
      const data = await res.json()
      setLog(JSON.stringify(data, null, 2))
      if (data.success) {
        loadJobHistory()
      }
    } catch (error) {
      setLog('Error: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
    setLoading(false)
  }

  const checkDbStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/init-db', { method: 'GET' })
      const data = await res.json()
      setDbStatus(data)
    } catch (error) {
      setDbStatus({ error: error instanceof Error ? error.message : 'Unknown error' })
    }
    setLoading(false)
  }

  const setupSchema = async () => {
    setLoading(true)
    setLog('Setting up database schema...')
    try {
      const res = await fetch('/api/setup-schema', { method: 'POST' })
      const data = await res.json()
      setLog(JSON.stringify(data, null, 2))
    } catch (error) {
      setLog('Error: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
    setLoading(false)
  }

  const loadJobHistory = async () => {
    try {
      const res = await fetch('/api/admin/jobs')
      if (res.ok) {
        const data = await res.json()
        setJobHistory(data.jobs || [])
      }
    } catch (error) {
      console.error('Failed to load job history:', error)
    }
  }

  const executeQuery = async () => {
    if (!sql.trim()) return
    
    setSqlLoading(true)
    setSqlError(null)
    setSqlResult(null)
    
    try {
      const res = await fetch('/api/debug/sql-console', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: sql.trim() })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setSqlResult(data)
      } else {
        setSqlError(data.error || 'Query failed')
      }
    } catch (err) {
      setSqlError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setSqlLoading(false)
    }
  }

  const setPresetQuery = (query: string) => {
    setSql(query)
    setSqlResult(null)
    setSqlError(null)
  }

  useEffect(() => {
    loadJobHistory()
    checkDbStatus()
  }, [])

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 bg-zinc-900/60 border border-zinc-800">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
        
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">📥 Content Ingestion</h2>
          <div className="flex gap-2 mb-4">
            <select 
              value={mode} 
              onChange={e => setMode(e.target.value as any)} 
              className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2 text-white"
            >
              <option value="weekly">Weekly (latest issue only)</option>
              <option value="backfill">Backfill (all historical content)</option>
            </select>
            <button 
              onClick={runIngestion} 
              disabled={loading}
              className="rounded-lg px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white"
            >
              {loading ? 'Running...' : 'Run Ingestion'}
            </button>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            <strong>Weekly:</strong> Import only the latest Friday content from Google Doc<br/>
            <strong>Backfill:</strong> Import all historical Friday issues (use for initial setup or recovery)
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">💾 Database Management</h2>
          <div className="flex gap-2 mb-4">
            <button 
              onClick={checkDbStatus} 
              disabled={loading}
              className="rounded-lg px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white"
            >
              Check Status
            </button>
            <button 
              onClick={setupSchema} 
              disabled={loading}
              className="rounded-lg px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white"
            >
              Reset Schema
            </button>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            <strong>Check Status:</strong> Verify database connection and tables<br/>
            <strong>Reset Schema:</strong> ⚠️ Recreate all database tables (will delete existing data!)
          </p>
          
          {dbStatus && (
            <div className="bg-zinc-800 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Database Status:</h3>
              <pre className="text-xs text-zinc-300">{JSON.stringify(dbStatus, null, 2)}</pre>
            </div>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">🔧 SQL Debug Console</h2>
          
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-2">Quick Queries:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={() => setPresetQuery('SELECT COUNT(*) as issue_count FROM "Issue"')}
                className="text-left p-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors"
              >
                <div className="font-medium">Issue Count</div>
                <div className="text-zinc-400">Count newsletters</div>
              </button>
              
              <button
                onClick={() => setPresetQuery('SELECT "issueDate", "subjectLine" FROM "Issue" ORDER BY "issueDate" DESC LIMIT 10')}
                className="text-left p-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors"
              >
                <div className="font-medium">Recent Issues</div>
                <div className="text-zinc-400">Latest 10</div>
              </button>
              
              <button
                onClick={() => setPresetQuery("SELECT a.title, i.\"issueDate\", a.\"sourceUrl\" FROM \"Article\" a JOIN \"Issue\" i ON a.\"issueId\" = i.id WHERE LOWER(a.title) LIKE '%unitree%' ORDER BY i.\"issueDate\" DESC")}
                className="text-left p-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors"
              >
                <div className="font-medium">Search Unitree</div>
                <div className="text-zinc-400">Debug search</div>
              </button>

              <button
                onClick={() => setPresetQuery('SELECT COUNT(*) as total_articles, COUNT(DISTINCT a."sourceUrl") as unique_urls FROM "Article" a')}
                className="text-left p-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs transition-colors"
              >
                <div className="font-medium">Article Stats</div>
                <div className="text-zinc-400">Total &amp; unique</div>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">SQL Query:</label>
              <textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                className="w-full h-24 p-3 bg-zinc-800 border border-zinc-700 rounded-lg font-mono text-sm resize-none focus:border-zinc-600 focus:outline-none"
                placeholder='SELECT * FROM "Issue" LIMIT 10'
              />
            </div>
            
            <button
              onClick={executeQuery}
              disabled={sqlLoading || !sql.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              {sqlLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Executing...
                </>
              ) : (
                'Execute Query'
              )}
            </button>
          </div>

          {sqlError && (
            <div className="mt-4 bg-red-900/20 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
              <strong>Query Error:</strong> {sqlError}
            </div>
          )}

          {sqlResult && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-4 text-sm text-zinc-400">
                <span>⚡ {sqlResult.executionTime}</span>
                <span>📊 {sqlResult.rowCount} rows</span>
              </div>
              
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
                <div className="p-3 bg-zinc-750 border-b border-zinc-700 font-medium text-sm">
                  Query Results
                </div>
                <div className="p-4 overflow-auto max-h-64">
                  <pre className="text-xs text-zinc-300">
                    {JSON.stringify(sqlResult.data, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">📋 Recent Job History</h2>
          {jobHistory.length > 0 ? (
            <div className="bg-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-zinc-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Job Type</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left">Started</th>
                    <th className="px-4 py-2 text-left">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {jobHistory.slice(0, 10).map((job) => (
                    <tr key={job.id} className="border-t border-zinc-700">
                      <td className="px-4 py-2">{job.jobType}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          job.status === 'success' ? 'bg-green-900 text-green-200' :
                          job.status === 'failure' ? 'bg-red-900 text-red-200' :
                          'bg-yellow-900 text-yellow-200'
                        }`}>
                          {job.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">{new Date(job.startedAt).toLocaleString()}</td>
                      <td className="px-4 py-2">
                        {job.endedAt ? 
                          Math.round((new Date(job.endedAt).getTime() - new Date(job.startedAt).getTime()) / 1000) + 's' :
                          'Running...'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-zinc-400">No job history available. Run an ingestion to see jobs here.</p>
          )}
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">🔗 Quick Links</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a href="/" className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg text-center transition-colors">
              🏠 Homepage
            </a>
            <a href="/search" className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg text-center transition-colors">
              🔍 Search
            </a>
            <a href="/dashboard" className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg text-center transition-colors">
              📊 Dashboard
            </a>
            <a href="/setup" className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg text-center transition-colors">
              ⚙️ Initial Setup
            </a>
            <a href="/debug" className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg text-center transition-colors">
              🔧 Debug Console
            </a>
            <a href="/api/debug/newsletter-coverage" target="_blank" className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg text-center transition-colors">
              📊 Coverage Report
            </a>
            <a href="/api/debug/unitree-investigation" target="_blank" className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg text-center transition-colors">
              🔍 Unitree Debug
            </a>
            <a href="/api/optimize-db" target="_blank" className="bg-zinc-800 hover:bg-zinc-700 p-3 rounded-lg text-center transition-colors">
              ⚡ Optimize DB
            </a>
          </div>
        </section>

        {log && (
          <section>
            <h2 className="text-xl font-semibold mb-4">📝 Output Log</h2>
            <pre className="bg-zinc-800 p-4 rounded-lg text-xs whitespace-pre-wrap overflow-x-auto text-zinc-300">
              {log}
            </pre>
          </section>
        )}
      </div>
    </div>
  )
}