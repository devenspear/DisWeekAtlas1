import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Query must be at least 2 characters long'
      }, { status: 400 })
    }
    
    console.log(`🔍 Search query: "${query}" (limit: ${limit}, offset: ${offset})`)
    const startTime = Date.now()
    
    // Enhanced search with deduplication and proper ordering
    const articles = await db.article.findMany({
      where: {
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { summaryText: { contains: query, mode: 'insensitive' } },
          { summaryMd: { contains: query, mode: 'insensitive' } }
        ]
      },
      include: {
        issue: {
          select: {
            id: true,
            issueDate: true,
            subjectLine: true
          }
        },
        category: {
          select: {
            name: true,
            slug: true
          }
        }
      },
      orderBy: [
        { issue: { issueDate: 'desc' } }, // Most recent first
        { createdAt: 'desc' }
      ],
      take: limit,
      skip: offset
    })
    
    // Deduplicate by sourceUrl (keep most recent)
    const uniqueArticles = articles.reduce((acc, article) => {
      const existing = acc.find(a => a.sourceUrl === article.sourceUrl)
      if (!existing) {
        acc.push(article)
      } else if (new Date(article.issue.issueDate) > new Date(existing.issue.issueDate)) {
        // Replace with more recent version
        const index = acc.indexOf(existing)
        acc[index] = article
      }
      return acc
    }, [] as typeof articles)
    
    const searchTime = Date.now() - startTime
    console.log(`✅ Search completed in ${searchTime}ms, found ${uniqueArticles.length} unique results`)
    
    // Format results for frontend
    const results = uniqueArticles.map(article => ({
      id: article.id,
      title: article.title,
      summary: article.summaryText || article.summaryMd?.substring(0, 200) + '...' || '',
      sourceUrl: article.sourceUrl,
      sourceDomain: article.sourceDomain,
      quotedStat: article.quotedStat,
      issue: {
        date: article.issue.issueDate,
        subjectLine: article.issue.subjectLine
      },
      category: article.category?.name || 'Uncategorized'
    }))
    
    return NextResponse.json({
      success: true,
      query,
      results,
      total: uniqueArticles.length,
      searchTime: `${searchTime}ms`,
      hasMore: uniqueArticles.length === limit // Simple pagination indicator
    })
    
  } catch (error) {
    console.error('❌ Search failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Search failed'
    }, { status: 500 })
  }
}