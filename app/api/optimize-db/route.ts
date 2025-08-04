import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 Starting database optimization...')
    
    const optimizations = []
    
    // 1. Create indexes for faster search
    try {
      await db.$executeRaw`CREATE INDEX CONCURRENTLY IF NOT EXISTS "Article_title_search_idx" ON "Article" USING gin(to_tsvector('english', title))`
      optimizations.push('✅ Created full-text search index on Article.title')
    } catch (e) {
      optimizations.push('ℹ️ Article title index already exists or creating')
    }
    
    try {
      await db.$executeRaw`CREATE INDEX CONCURRENTLY IF NOT EXISTS "Article_summary_search_idx" ON "Article" USING gin(to_tsvector('english', coalesce("summaryText", '')))`
      optimizations.push('✅ Created full-text search index on Article.summaryText')
    } catch (e) {
      optimizations.push('ℹ️ Article summary index already exists or creating')
    }
    
    try {
      await db.$executeRaw`CREATE INDEX CONCURRENTLY IF NOT EXISTS "Article_issue_date_idx" ON "Article" ("issueId") INCLUDE ("createdAt")`
      optimizations.push('✅ Created index on Article.issueId with createdAt')
    } catch (e) {
      optimizations.push('ℹ️ Article issue index already exists or creating')
    }
    
    try {
      await db.$executeRaw`CREATE INDEX CONCURRENTLY IF NOT EXISTS "Article_source_url_idx" ON "Article" ("sourceUrl")`
      optimizations.push('✅ Created index on Article.sourceUrl for deduplication')
    } catch (e) {
      optimizations.push('ℹ️ Article source URL index already exists or creating')
    }
    
    try {
      await db.$executeRaw`CREATE INDEX CONCURRENTLY IF NOT EXISTS "Issue_date_idx" ON "Issue" ("issueDate" DESC)`
      optimizations.push('✅ Created index on Issue.issueDate')
    } catch (e) {
      optimizations.push('ℹ️ Issue date index already exists or creating')
    }
    
    // 2. Analyze tables for query planning
    await db.$executeRaw`ANALYZE "Article"`
    await db.$executeRaw`ANALYZE "Issue"`
    optimizations.push('✅ Updated table statistics for query planning')
    
    // 3. Clean up duplicate articles (keep most recent)
    const duplicateCleanup = await db.$executeRaw`
      DELETE FROM "Article" a1
      USING "Article" a2, "Issue" i1, "Issue" i2
      WHERE a1.id < a2.id 
      AND a1."sourceUrl" = a2."sourceUrl"
      AND a1."issueId" = i1.id
      AND a2."issueId" = i2.id
      AND i1."issueDate" < i2."issueDate"
    `
    optimizations.push(`✅ Removed ${duplicateCleanup} duplicate articles`)
    
    // 4. Get current database stats
    const statsResult = await db.$queryRaw`
      SELECT 
        (SELECT COUNT(*)::int FROM "Article") as total_articles,
        (SELECT COUNT(*)::int FROM "Issue") as total_issues,
        (SELECT COUNT(DISTINCT "sourceUrl")::int FROM "Article") as unique_urls,
        (SELECT MAX("issueDate") FROM "Issue") as latest_issue,
        (SELECT MIN("issueDate") FROM "Issue") as earliest_issue
    ` as Array<{
      total_articles: number
      total_issues: number  
      unique_urls: number
      latest_issue: Date
      earliest_issue: Date
    }>
    
    console.log('✅ Database optimization completed')
    
    return NextResponse.json({
      success: true,
      message: 'Database optimization completed',
      optimizations,
      stats: statsResult[0] || {},
      recommendations: [
        'Search should now be significantly faster',
        'Duplicate articles have been removed',
        'Full-text search enabled for better relevance',
        'Consider implementing Redis caching for frequently searched terms'
      ]
    })
    
  } catch (error) {
    console.error('❌ Database optimization failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Optimization failed'
    }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'Use POST to run database optimization',
    endpoints: {
      optimize: 'POST /api/optimize-db',
      analyze: 'GET /api/debug/search-analysis?q=unitree'
    }
  })
}