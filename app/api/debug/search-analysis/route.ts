import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q') || 'unitree'
    
    console.log(`🔍 Analyzing search for: "${query}"`)
    
    // 1. Check total articles and distribution by date
    const totalArticles = await db.article.count()
    
    const articlesByYear = await db.$queryRaw`
      SELECT 
        EXTRACT(YEAR FROM i."issueDate") as year,
        EXTRACT(MONTH FROM i."issueDate") as month,
        COUNT(a.id)::int as article_count
      FROM "Article" a
      JOIN "Issue" i ON a."issueId" = i.id
      GROUP BY EXTRACT(YEAR FROM i."issueDate"), EXTRACT(MONTH FROM i."issueDate")
      ORDER BY year DESC, month DESC
      LIMIT 20
    `
    
    // 2. Search performance analysis - time each step
    const startTime = Date.now()
    
    // Step 1: Title search
    const titleSearchStart = Date.now()
    const titleMatches = await db.article.findMany({
      where: {
        title: {
          contains: query,
          mode: 'insensitive',
        },
      },
      include: {
        issue: true,
      },
      take: 10
    })
    const titleSearchTime = Date.now() - titleSearchStart
    
    // Step 2: Summary search
    const summarySearchStart = Date.now()
    const summaryMatches = await db.article.findMany({
      where: {
        summaryText: {
          contains: query,
          mode: 'insensitive',
        },
      },
      include: {
        issue: true,
      },
      take: 10
    })
    const summarySearchTime = Date.now() - summarySearchStart
    
    // Step 3: Check for duplicates
    const duplicateCheck = await db.$queryRaw`
      SELECT 
        a."sourceUrl", 
        COUNT(*)::int as duplicate_count,
        MIN(i."issueDate") as first_date,
        MAX(i."issueDate") as last_date
      FROM "Article" a
      JOIN "Issue" i ON a."issueId" = i.id
      WHERE a."sourceUrl" LIKE '%unitree%'
      GROUP BY a."sourceUrl"
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
    `
    
    // Step 4: Check latest issues for missing content
    const recentIssues = await db.issue.findMany({
      where: {
        issueDate: {
          gte: new Date('2025-07-01')
        }
      },
      include: {
        articles: {
          where: {
            OR: [
              { title: { contains: query, mode: 'insensitive' } },
              { summaryText: { contains: query, mode: 'insensitive' } }
            ]
          }
        }
      },
      orderBy: { issueDate: 'desc' },
      take: 5
    })
    
    const totalTime = Date.now() - startTime
    
    // 5. Database index analysis
    const indexAnalysis = await db.$queryRaw`
      SELECT schemaname, tablename, indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename IN ('Article', 'Issue')
      ORDER BY tablename, indexname
    `
    
    return NextResponse.json({
      success: true,
      query: query,
      performance: {
        totalTime: `${totalTime}ms`,
        titleSearchTime: `${titleSearchTime}ms`,
        summarySearchTime: `${summarySearchTime}ms`,
        breakdown: {
          titleSearch: titleSearchTime,
          summarySearch: summarySearchTime,
          total: totalTime
        }
      },
      dataAnalysis: {
        totalArticles,
        articlesByYearMonth: articlesByYear,
        duplicates: duplicateCheck,
        recentIssuesWithQuery: recentIssues.map(issue => ({
          date: issue.issueDate,
          matchingArticles: issue.articles.length,
          articles: issue.articles.map(a => ({ title: a.title, url: a.sourceUrl }))
        }))
      },
      searchResults: {
        titleMatches: titleMatches.length,
        summaryMatches: summaryMatches.length,
        titleResults: titleMatches.map(a => ({
          title: a.title,
          issueDate: a.issue.issueDate,
          sourceUrl: a.sourceUrl
        })),
        summaryResults: summaryMatches.map(a => ({
          title: a.title,
          issueDate: a.issue.issueDate,
          sourceUrl: a.sourceUrl
        }))
      },
      databaseIndexes: indexAnalysis,
      recommendations: [
        "Add database indexes on title and summaryText for faster text search",
        "Implement full-text search using PostgreSQL's tsvector",
        "Check for duplicate article ingestion logic",
        "Verify recent content is being ingested properly"
      ]
    })
    
  } catch (error) {
    console.error('❌ Search analysis failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}