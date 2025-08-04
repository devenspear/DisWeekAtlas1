import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    console.log('📊 Analyzing newsletter coverage...')
    
    // 1. Get total count and date range
    const totalIssues = await db.issue.count()
    
    const dateRange = await db.issue.aggregate({
      _min: { issueDate: true },
      _max: { issueDate: true }
    })
    
    // 2. Get all issues ordered by date
    const allIssues = await db.issue.findMany({
      select: {
        id: true,
        issueDate: true,
        subjectLine: true,
        _count: {
          select: {
            articles: true
          }
        }
      },
      orderBy: { issueDate: 'asc' }
    })
    
    // 3. Check for weekly gaps
    const weeklyGaps = []
    const issuesByWeek = []
    
    if (allIssues.length > 0) {
      const startDate = new Date(allIssues[0].issueDate)
      const endDate = new Date(allIssues[allIssues.length - 1].issueDate)
      
      // Generate expected weekly dates (assuming Fridays)
      const expectedDates = []
      let currentDate = new Date(startDate)
      
      while (currentDate <= endDate) {
        expectedDates.push(new Date(currentDate))
        currentDate.setDate(currentDate.getDate() + 7) // Add 7 days
      }
      
      // Check which expected dates are missing
      for (const expectedDate of expectedDates) {
        const found = allIssues.find(issue => {
          const issueDate = new Date(issue.issueDate)
          const timeDiff = Math.abs(issueDate.getTime() - expectedDate.getTime())
          return timeDiff < (3 * 24 * 60 * 60 * 1000) // Within 3 days
        })
        
        if (found) {
          issuesByWeek.push({
            expectedDate: expectedDate.toISOString().split('T')[0],
            actualDate: found.issueDate.toISOString().split('T')[0],
            subjectLine: found.subjectLine,
            articleCount: found._count.articles,
            daysDiff: Math.round((new Date(found.issueDate).getTime() - expectedDate.getTime()) / (24 * 60 * 60 * 1000))
          })
        } else {
          weeklyGaps.push({
            expectedDate: expectedDate.toISOString().split('T')[0],
            missing: true
          })
        }
      }
    }
    
    // 4. Get issues by year/month for distribution analysis
    const issueDistribution = await db.$queryRaw`
      SELECT 
        EXTRACT(YEAR FROM "issueDate")::int as year,
        EXTRACT(MONTH FROM "issueDate")::int as month,
        COUNT(*)::int as issue_count,
        MIN("issueDate")::date as first_issue,
        MAX("issueDate")::date as last_issue
      FROM "Issue"
      GROUP BY EXTRACT(YEAR FROM "issueDate"), EXTRACT(MONTH FROM "issueDate")
      ORDER BY year DESC, month DESC
    ` as Array<{ year: number; month: number; issue_count: number; first_issue: Date; last_issue: Date }>
    
    // 5. Check for duplicate dates
    const duplicateDates = await db.$queryRaw`
      SELECT 
        "issueDate"::date as date,
        COUNT(*)::int as count,
        ARRAY_AGG("subjectLine") as subject_lines
      FROM "Issue"
      GROUP BY "issueDate"::date
      HAVING COUNT(*) > 1
      ORDER BY "issueDate" DESC
    ` as Array<{ date: string; count: number; subject_lines: string[] }>
    
    // 6. Calculate expected vs actual coverage
    const expectedWeeks = Math.ceil((new Date().getTime() - new Date('2023-08-18').getTime()) / (7 * 24 * 60 * 60 * 1000))
    const actualWeeks = allIssues.length
    const coveragePercentage = totalIssues > 0 ? (actualWeeks / expectedWeeks * 100).toFixed(1) : 0
    
    // 7. Check for recent missing issues
    const recentMissingIssues = []
    const now = new Date()
    for (let i = 0; i < 8; i++) { // Check last 8 weeks
      const checkDate = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000))
      const found = allIssues.find(issue => {
        const issueDate = new Date(issue.issueDate)
        const timeDiff = Math.abs(issueDate.getTime() - checkDate.getTime())
        return timeDiff < (3 * 24 * 60 * 60 * 1000)
      })
      
      if (!found) {
        recentMissingIssues.push(checkDate.toISOString().split('T')[0])
      }
    }
    
    // Serialize BigInt values for JSON response
    const serializeData = (data: any) => JSON.parse(JSON.stringify(data, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    ))

    return NextResponse.json({
      success: true,
      coverage: serializeData({
        summary: {
          totalIssuesInDatabase: totalIssues,
          expectedApproximate: expectedWeeks,
          coveragePercentage: `${coveragePercentage}%`,
          userClaimed: 100,
          shortfall: Math.max(0, 100 - totalIssues)
        },
        dateRange: {
          earliest: dateRange._min.issueDate,
          latest: dateRange._max.issueDate,
          spanInDays: dateRange._min.issueDate && dateRange._max.issueDate ? 
            Math.ceil((new Date(dateRange._max.issueDate).getTime() - new Date(dateRange._min.issueDate).getTime()) / (24 * 60 * 60 * 1000)) : 0
        },
        weeklyAnalysis: {
          totalWeeksFound: issuesByWeek.length,
          missingSomeWeeks: weeklyGaps.length,
          recentMissing: recentMissingIssues
        },
        distribution: issueDistribution,
        qualityChecks: {
          duplicateDates: duplicateDates,
          issuesWithoutArticles: allIssues.filter(i => i._count.articles === 0).length
        }
      }),
      detailedIssues: serializeData(allIssues.map(issue => ({
        date: issue.issueDate.toISOString().split('T')[0],
        subjectLine: issue.subjectLine || 'No subject',
        articleCount: issue._count.articles
      }))),
      missingWeeks: serializeData(weeklyGaps),
      recommendations: [
        totalIssues < 90 ? "⚠️ Significantly fewer than 100 issues - major ingestion problem" :
        totalIssues < 100 ? "⚠️ Missing some issues - partial ingestion problem" :
        totalIssues >= 100 ? "✅ Good coverage - check for quality issues" : "❓ Unknown",
        
        weeklyGaps.length > 10 ? "❌ Many missing weeks - parser may have failed on certain date formats" :
        weeklyGaps.length > 0 ? "⚠️ Some missing weeks - check specific date parsing" :
        "✅ Good weekly coverage",
        
        recentMissingIssues.length > 0 ? 
        `⚠️ Missing recent issues: ${recentMissingIssues.join(', ')} - ingestion may not include latest content` :
        "✅ Recent issues present",
        
        duplicateDates.length > 0 ? "⚠️ Duplicate dates found - check parsing logic" : "✅ No duplicate dates",
        
        "If issues are missing, run fresh ingestion with backfill mode"
      ]
    })
    
  } catch (error) {
    console.error('❌ Newsletter coverage analysis failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Coverage analysis failed'
    }, { status: 500 })
  }
}