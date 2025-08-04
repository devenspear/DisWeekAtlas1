'use client'

import { useState } from 'react'

export default function SetupPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [details, setDetails] = useState('')

  const setupDatabase = async () => {
    setStatus('loading')
    setMessage('Setting up database schema...')
    
    try {
      const response = await fetch('/api/setup-schema', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const data = await response.json()
      
      if (data.success) {
        setStatus('success')
        setMessage('✅ Database schema created successfully!')
        setDetails(data.output || data.message)
      } else {
        setStatus('error')
        setMessage('❌ Database setup failed')
        setDetails(data.error || 'Unknown error')
      }
    } catch (error) {
      setStatus('error')
      setMessage('❌ Request failed')
      setDetails(error instanceof Error ? error.message : 'Network error')
    }
  }

  const runIngestion = async () => {
    setStatus('loading')
    setMessage('Running content ingestion...')
    
    try {
      const response = await fetch('/api/jobs/ingest?mode=backfill', {
        method: 'POST'
      })
      
      const data = await response.json()
      
      if (data.success) {
        setStatus('success')
        setMessage('✅ Content ingestion completed!')
        setDetails(`Processed ${data.processed} issues`)
      } else {
        setStatus('error')
        setMessage('❌ Content ingestion failed')
        setDetails(data.error || 'Unknown error')
      }
    } catch (error) {
      setStatus('error')
      setMessage('❌ Ingestion failed')
      setDetails(error instanceof Error ? error.message : 'Network error')
    }
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">DisWeekly Atlas Setup</h1>
        
        <div className="space-y-6">
          <div className="bg-zinc-900 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Step 1: Database Schema Setup</h2>
            <p className="text-zinc-300 mb-4">
              This will create all the necessary database tables (Issue, Article, Category, Tag, etc.)
            </p>
            <button
              onClick={setupDatabase}
              disabled={status === 'loading'}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 px-4 py-2 rounded text-white"
            >
              {status === 'loading' ? 'Setting up...' : 'Setup Database Schema'}
            </button>
          </div>

          <div className="bg-zinc-900 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Step 2: Content Ingestion</h2>
            <p className="text-zinc-300 mb-4">
              This will import all content from your Google Doc into the database.
              <strong> Only run this AFTER database setup succeeds!</strong>
            </p>
            <button
              onClick={runIngestion}
              disabled={status === 'loading'}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 px-4 py-2 rounded text-white"
            >
              {status === 'loading' ? 'Running...' : 'Run Content Ingestion'}
            </button>
          </div>

          {message && (
            <div className={`p-4 rounded-lg ${
              status === 'success' ? 'bg-green-900/50 border border-green-700' :
              status === 'error' ? 'bg-red-900/50 border border-red-700' :
              'bg-blue-900/50 border border-blue-700'
            }`}>
              <div className="font-semibold">{message}</div>
              {details && (
                <pre className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap overflow-x-auto">
                  {details}
                </pre>
              )}
            </div>
          )}

          <div className="bg-zinc-900 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">After Setup</h2>
            <p className="text-zinc-300 mb-4">Once both steps complete successfully, you can access:</p>
            <ul className="list-disc list-inside text-zinc-300 space-y-1">
              <li><a href="/" className="text-blue-400 hover:underline">Homepage</a></li>
              <li><a href="/search" className="text-blue-400 hover:underline">Search</a></li>
              <li><a href="/dashboard" className="text-blue-400 hover:underline">Dashboard</a></li>
              <li><a href="/admin" className="text-blue-400 hover:underline">Admin</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}