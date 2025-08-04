import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()
    
    if (!query) {
      return NextResponse.json({ error: 'Query required' }, { status: 400 })
    }

    console.log('🔍 Executing SQL:', query)
    
    // Execute raw SQL query
    const result = await db.$queryRawUnsafe(query)
    
    console.log('✅ Query result:', result)
    
    return NextResponse.json({
      success: true,
      query,
      result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ SQL query failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  // Quick checks with predefined queries
  try {
    const checks = [
      'SELECT COUNT(*) as issue_count FROM "Issue"',
      'SELECT COUNT(*) as article_count FROM "Article"', 
      'SELECT COUNT(*) as category_count FROM "Category"',
      'SELECT COUNT(*) as job_count FROM "JobRun"',
      'SELECT * FROM "JobRun" ORDER BY "startedAt" DESC LIMIT 3',
      'SELECT "issueDate", "subjectLine", "hash" FROM "Issue" ORDER BY "issueDate" DESC LIMIT 3'
    ]
    
    const results: Record<string, any> = {}
    
    for (const query of checks) {
      try {
        const result = await db.$queryRawUnsafe(query)
        results[query] = result
      } catch (error) {
        results[query] = { error: error instanceof Error ? error.message : String(error) }
      }
    }
    
    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}