import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Starting database diagnostic check...')

    // Check all tables for record counts
    const [
      issueCount,
      categoryCount,
      articleCount,
      tagCount,
      entityCount,
      jobRunCount
    ] = await Promise.all([
      db.issue.count(),
      db.category.count(),
      db.article.count(),
      db.tag.count(),
      db.entity.count(),
      db.jobRun.count()
    ])

    console.log('📊 Record counts:')
    console.log(`- Issues: ${issueCount}`)
    console.log(`- Categories: ${categoryCount}`) 
    console.log(`- Articles: ${articleCount}`)
    console.log(`- Tags: ${tagCount}`)
    console.log(`- Entities: ${entityCount}`)
    console.log(`- JobRuns: ${jobRunCount}`)

    // Get recent job runs
    const recentJobs = await db.jobRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 5
    })

    console.log('🔧 Recent jobs:')
    recentJobs.forEach(job => {
      console.log(`- ${job.jobType}: ${job.status} (${job.startedAt.toISOString()})`)
      if (job.error) console.log(`  Error: ${job.error}`)
    })

    // Get sample issues if any exist
    const sampleIssues = await db.issue.findMany({
      take: 3,
      include: {
        articles: {
          include: {
            category: true
          }
        }
      }
    })

    console.log(`📰 Sample issues found: ${sampleIssues.length}`)
    sampleIssues.forEach(issue => {
      console.log(`- ${issue.issueDate.toISOString().split('T')[0]}: ${issue.articles.length} articles`)
    })

    // Raw database check
    console.log('🔬 Raw database check...')
    const rawIssueCheck = await db.$executeRaw`SELECT COUNT(*) as count FROM "Issue"`
    const rawArticleCheck = await db.$executeRaw`SELECT COUNT(*) as count FROM "Article"`
    
    console.log('Raw counts:', { rawIssueCheck, rawArticleCheck })

    return NextResponse.json({
      success: true,
      counts: {
        issues: issueCount,
        categories: categoryCount,
        articles: articleCount,
        tags: tagCount,
        entities: entityCount,
        jobRuns: jobRunCount
      },
      recentJobs: recentJobs.map(job => ({
        id: job.id,
        type: job.jobType,
        status: job.status,
        startedAt: job.startedAt.toISOString(),
        endedAt: job.endedAt?.toISOString(),
        error: job.error
      })),
      sampleIssues: sampleIssues.map(issue => ({
        id: issue.id,
        date: issue.issueDate.toISOString(),
        subject: issue.subjectLine,
        articleCount: issue.articles.length
      })),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Database check failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}