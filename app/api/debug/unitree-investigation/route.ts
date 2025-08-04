import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Starting comprehensive Unitree investigation...')
    
    // 1. Check ALL articles containing "unitree" (case-insensitive)
    const allUnitreeArticles = await db.article.findMany({
      where: {
        OR: [
          { title: { contains: 'unitree', mode: 'insensitive' } },
          { summaryText: { contains: 'unitree', mode: 'insensitive' } },
          { summaryMd: { contains: 'unitree', mode: 'insensitive' } }
        ]
      },
      include: {
        issue: {
          select: {
            id: true,
            issueDate: true,
            subjectLine: true,
            rawMarkdown: true
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
        { issue: { issueDate: 'desc' } },
        { createdAt: 'desc' }
      ]
    })
    
    // 2. Check issues by date range where we expect Unitree content
    const issuesByDate = await db.issue.findMany({
      where: {
        issueDate: {
          gte: new Date('2024-08-01'),
          lte: new Date('2025-09-01')
        }
      },
      include: {
        articles: {
          where: {
            OR: [
              { title: { contains: 'unitree', mode: 'insensitive' } },
              { summaryText: { contains: 'unitree', mode: 'insensitive' } }
            ]
          }
        }
      },
      orderBy: { issueDate: 'desc' }
    })
    
    // 3. Check for duplicate URLs
    const duplicateUrls = await db.$queryRaw`
      SELECT 
        a."sourceUrl",
        COUNT(*)::int as count,
        ARRAY_AGG(DISTINCT i."issueDate"::text ORDER BY i."issueDate" DESC) as dates,
        ARRAY_AGG(DISTINCT a.title) as titles
      FROM "Article" a
      JOIN "Issue" i ON a."issueId" = i.id
      WHERE LOWER(a.title) LIKE '%unitree%' 
         OR LOWER(a."summaryText") LIKE '%unitree%'
      GROUP BY a."sourceUrl"
      ORDER BY count DESC
    `
    
    // 4. Search raw markdown content in issues for "unitree"
    const rawContentMatches = await db.issue.findMany({
      where: {
        rawMarkdown: {
          contains: 'unitree',
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        issueDate: true,
        subjectLine: true,
        rawMarkdown: true
      },
      orderBy: { issueDate: 'desc' }
    })
    
    // 5. Check specific dates from user's screenshots
    const specificDates = [
      new Date('2024-08-30'),
      new Date('2025-05-16'), 
      new Date('2025-08-01')
    ]
    
    const issuesOnSpecificDates = await Promise.all(
      specificDates.map(async (date) => {
        const issue = await db.issue.findFirst({
          where: {
            issueDate: {
              gte: new Date(date.getTime() - 24 * 60 * 60 * 1000), // 1 day before
              lte: new Date(date.getTime() + 24 * 60 * 60 * 1000)  // 1 day after
            }
          },
          include: {
            articles: true
          }
        })
        
        return {
          targetDate: date.toISOString().split('T')[0],
          found: !!issue,
          issue: issue ? {
            id: issue.id,
            date: issue.issueDate,
            subjectLine: issue.subjectLine,
            articleCount: issue.articles.length,
            unitreeArticles: issue.articles.filter(a => 
              a.title.toLowerCase().includes('unitree') || 
              (a.summaryText && a.summaryText.toLowerCase().includes('unitree'))
            ).length
          } : null
        }
      })
    )
    
    // 6. Analyze what the search API would return
    const searchApiResults = await db.article.findMany({
      where: {
        OR: [
          { title: { contains: 'unitree', mode: 'insensitive' } },
          { summaryText: { contains: 'unitree', mode: 'insensitive' } },
          { summaryMd: { contains: 'unitree', mode: 'insensitive' } }
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
        { issue: { issueDate: 'desc' } },
        { createdAt: 'desc' }
      ],
      take: 20
    })
    
    // Deduplicate search results (same logic as search API)
    const uniqueSearchResults = searchApiResults.reduce((acc, article) => {
      const existing = acc.find(a => a.sourceUrl === article.sourceUrl)
      if (!existing) {
        acc.push(article)
      } else if (new Date(article.issue.issueDate) > new Date(existing.issue.issueDate)) {
        const index = acc.indexOf(existing)
        acc[index] = article
      }
      return acc
    }, [] as typeof searchApiResults)
    
    return NextResponse.json({
      success: true,
      investigation: {
        summary: {
          totalUnitreeArticles: allUnitreeArticles.length,
          uniqueArticlesAfterDedup: uniqueSearchResults.length,
          issuesWithUnitreeContent: issuesByDate.filter(i => i.articles.length > 0).length,
          rawMarkdownMatches: rawContentMatches.length
        },
        allUnitreeArticles: allUnitreeArticles.map(a => ({
          id: a.id,
          title: a.title,
          sourceUrl: a.sourceUrl,
          issueDate: a.issue.issueDate,
          subjectLine: a.issue.subjectLine,
          category: a.category?.name || 'Uncategorized',
          createdAt: a.createdAt
        })),
        duplicateUrls,
        issuesOnSpecificDates,
        rawContentMatches: rawContentMatches.map(i => ({
          id: i.id,
          date: i.issueDate,
          subjectLine: i.subjectLine,
          unitreeMatches: (i.rawMarkdown || '').match(/unitree/gi)?.length || 0,
          preview: i.rawMarkdown ? 
            i.rawMarkdown.toLowerCase().split('unitree')[0].slice(-100) + 
            '[UNITREE]' + 
            i.rawMarkdown.toLowerCase().split('unitree')[1]?.slice(0, 100) 
            : null
        })),
        searchApiWouldReturn: uniqueSearchResults.map(a => ({
          id: a.id,
          title: a.title,
          sourceUrl: a.sourceUrl,
          issueDate: a.issue.issueDate,
          category: a.category?.name || 'Uncategorized'
        })),
        expectedDates: {
          august2024: issuesOnSpecificDates[0],
          may2025: issuesOnSpecificDates[1], 
          august2025: issuesOnSpecificDates[2]
        }
      },
      recommendations: [
        allUnitreeArticles.length === 0 ? "❌ NO UNITREE ARTICLES FOUND - ingestion failed completely" : 
        uniqueSearchResults.length < 3 ? "⚠️ Missing expected articles - check ingestion for recent dates" :
        "✅ Articles found, check for date/content mismatches",
        
        rawContentMatches.length > 0 ? 
        `✅ Found ${rawContentMatches.length} issues with 'unitree' in raw markdown - parsing may be the issue` :
        "❌ No raw markdown matches - content may not have been ingested",
        
        "Run fresh ingestion if data is missing or corrupted",
        "Check article parsing logic for recent issues"
      ]
    })
    
  } catch (error) {
    console.error('❌ Unitree investigation failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Investigation failed'
    }, { status: 500 })
  }
}