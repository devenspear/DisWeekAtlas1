import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { sql, params } = await req.json()
    
    if (!sql || typeof sql !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'SQL query is required'
      }, { status: 400 })
    }
    
    // Security: Only allow SELECT queries in production
    const isReadOnly = sql.trim().toLowerCase().startsWith('select')
    if (process.env.NODE_ENV === 'production' && !isReadOnly) {
      return NextResponse.json({
        success: false,
        error: 'Only SELECT queries allowed in production'
      }, { status: 403 })
    }
    
    console.log(`🔍 Executing SQL: ${sql.substring(0, 100)}...`)
    
    const startTime = Date.now()
    let result
    
    if (params && Array.isArray(params)) {
      // Parameterized query
      result = await db.$queryRawUnsafe(sql, ...params)
    } else {
      // Direct query
      result = await db.$queryRawUnsafe(sql)
    }
    
    const executionTime = Date.now() - startTime
    
    console.log(`✅ Query executed in ${executionTime}ms`)
    
    // Convert BigInt to string for JSON serialization
    const serializedResult = JSON.parse(JSON.stringify(result, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ))

    return NextResponse.json({
      success: true,
      query: sql,
      executionTime: `${executionTime}ms`,
      rowCount: Array.isArray(result) ? result.length : 1,
      data: serializedResult
    })
    
  } catch (error) {
    console.error('❌ SQL query failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Query failed',
      query: (await req.json().catch(() => ({})))?.sql || 'Unknown'
    }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'SQL Console API - Use POST with { "sql": "SELECT ...", "params": [] }',
    examples: {
      countArticles: { sql: 'SELECT COUNT(*) FROM "Article"' },
      recentIssues: { sql: 'SELECT * FROM "Issue" ORDER BY "issueDate" DESC LIMIT 5' },
      searchUnitree: { sql: 'SELECT title, "sourceUrl" FROM "Article" WHERE title ILIKE \'%unitree%\'' }
    },
    security: 'Only SELECT queries allowed in production'
  })
}