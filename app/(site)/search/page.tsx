'use client'
import { useState, useEffect } from 'react'

type SearchResult = {
  id: string
  title: string
  summary: string
  sourceUrl: string
  sourceDomain: string
  quotedStat?: string
  issue: { 
    date: string
    subjectLine?: string 
  }
  category: string
}

type SearchResponse = {
  success: boolean
  query: string
  results: SearchResult[]
  total: number
  searchTime: string
  hasMore: boolean
  error?: string
}

export default function SearchPage() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTime, setSearchTime] = useState<string>('')
  const [totalResults, setTotalResults] = useState(0)

  const run = async () => {
    if (!q.trim() || q.trim().length < 2) {
      setError('Search query must be at least 2 characters')
      return
    }

    setLoading(true)
    setError(null)
    setResults([])
    
    try {
      const searchStart = Date.now()
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`)
      const clientTime = Date.now() - searchStart
      
      if (!res.ok) {
        throw new Error(`Search failed: ${res.status}`)
      }
      
      const data: SearchResponse = await res.json()
      
      if (data.success) {
        setResults(data.results || [])
        setTotalResults(data.total || 0)
        setSearchTime(`${data.searchTime} (+ ${clientTime}ms network)`)
      } else {
        setError(data.error || 'Search failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }

  // Search on Enter key
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      run()
    }
  }

  return (
    <main className="space-y-6">
      {/* Search Header */}
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Search DisWeekly Atlas</h1>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={e=>setQ(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Search topics, companies, sources..."
            className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3 text-sm focus:border-zinc-600 focus:outline-none"
            disabled={loading}
          />
          <button 
            onClick={run} 
            disabled={loading || q.trim().length < 2}
            className="rounded-lg px-6 py-3 bg-white text-black font-medium hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin"></div>
                Searching...
              </>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </div>

      {/* Search Stats */}
      {(totalResults > 0 || searchTime) && !loading && (
        <div className="text-sm text-zinc-400 border-b border-zinc-800 pb-4">
          {totalResults > 0 && (
            <span>Found {totalResults} results for "{q}"</span>
          )}
          {searchTime && (
            <span className="ml-4">• Search time: {searchTime}</span>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-300">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-400">Searching through {totalResults > 0 ? 'thousands of' : ''} articles...</p>
        </div>
      )}

      {/* No Results */}
      {!loading && results.length === 0 && q.trim() && !error && (
        <div className="text-center py-12">
          <p className="text-zinc-400 mb-4">No results found for "{q}"</p>
          <div className="text-sm text-zinc-500 space-y-1">
            <p>Try different search terms or check:</p>
            <p>• Spelling and capitalization</p>
            <p>• Using broader terms (e.g., "AI" instead of "artificial intelligence")</p>
            <p>• Searching for company names or topics</p>
          </div>
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="grid gap-4">
            {results.map(result => (
              <article 
                key={result.id} 
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    {/* Article Header */}
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      <time>{new Date(result.issue.date).toLocaleDateString()}</time>
                      <span>•</span>
                      <span className="bg-zinc-800 px-2 py-1 rounded">{result.category}</span>
                      {result.issue.subjectLine && (
                        <>
                          <span>•</span>
                          <span className="text-zinc-500">{result.issue.subjectLine}</span>
                        </>
                      )}
                    </div>

                    {/* Article Title */}
                    <h2 className="font-semibold text-lg leading-snug hover:text-white transition-colors">
                      <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer">
                        {result.title}
                      </a>
                    </h2>

                    {/* Article Summary */}
                    {result.summary && (
                      <p className="text-zinc-300 text-sm leading-relaxed">
                        {result.summary}
                      </p>
                    )}

                    {/* Quoted Stat */}
                    {result.quotedStat && (
                      <blockquote className="border-l-2 border-zinc-600 pl-3 text-zinc-400 italic text-sm">
                        "{result.quotedStat}"
                      </blockquote>
                    )}

                    {/* Source Link */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-500">Source:</span>
                      <a 
                        href={result.sourceUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        {result.sourceDomain}
                      </a>
                    </div>
                  </div>

                  {/* External Link Icon */}
                  <a 
                    href={result.sourceUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-white p-2 hover:bg-zinc-800 rounded transition-colors"
                    title="Open article"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
