import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Disable static generation for this diagnostic endpoint
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // Simple checks to avoid BigInt issues
    const results = {
      timestamp: new Date().toISOString(),
      
      // Check if data exists via raw SQL
      rawDataExists: {
        issues: 0,
        articles: 0,
        jobRuns: 0
      },
      
      // Check what Prisma can see
      prismaCanSee: {
        issues: 0,
        articles: 0,
        jobRuns: 0
      },
      
      // Sample data from tables that exist
      sampleData: {} as Record<string, any>,
      
      // Check table structure
      tableExists: {} as any
    }

    // Raw SQL counts (convert to numbers)
    try {
      const issueCount = await db.$queryRaw`SELECT COUNT(*)::int as count FROM "Issue"`
      results.rawDataExists.issues = Array.isArray(issueCount) && issueCount[0] ? Number(issueCount[0].count) : 0
    } catch (e) {
      results.rawDataExists.issues = -1 // Error indicator
    }

    try {
      const articleCount = await db.$queryRaw`SELECT COUNT(*)::int as count FROM "Article"`
      results.rawDataExists.articles = Array.isArray(articleCount) && articleCount[0] ? Number(articleCount[0].count) : 0
    } catch (e) {
      results.rawDataExists.articles = -1
    }

    try {
      const jobCount = await db.$queryRaw`SELECT COUNT(*)::int as count FROM "JobRun"`
      results.rawDataExists.jobRuns = Array.isArray(jobCount) && jobCount[0] ? Number(jobCount[0].count) : 0
    } catch (e) {
      results.rawDataExists.jobRuns = -1
    }

    // Prisma counts
    try {
      results.prismaCanSee.issues = await db.issue.count()
    } catch (e) {
      results.prismaCanSee.issues = -1
    }

    try {
      results.prismaCanSee.articles = await db.article.count()
    } catch (e) {
      results.prismaCanSee.articles = -1
    }

    try {
      results.prismaCanSee.jobRuns = await db.jobRun.count()
    } catch (e) {
      results.prismaCanSee.jobRuns = -1
    }

    // Get sample data if it exists
    try {
      const sampleIssue = await db.$queryRaw`SELECT "id", "issueDate", "subjectLine" FROM "Issue" LIMIT 1`
      results.sampleData.issue = sampleIssue
    } catch (e) {
      results.sampleData.issue = `Error: ${e}`
    }

    try {
      const sampleArticle = await db.$queryRaw`SELECT "id", "title", "issueId" FROM "Article" LIMIT 1`
      results.sampleData.article = sampleArticle
    } catch (e) {
      results.sampleData.article = `Error: ${e}`
    }

    // Check if tables exist
    try {
      const tables = await db.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('Issue', 'Article', 'JobRun')
      `
      results.tableExists = tables
    } catch (e) {
      results.tableExists = `Error: ${e}`
    }

    return NextResponse.json(results)

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}