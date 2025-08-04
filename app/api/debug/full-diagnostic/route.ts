import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Disable static generation for this diagnostic endpoint
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const results: {
    timestamp: string
    environment: {
      nodeEnv: string | undefined
      hasGoogleDocId: boolean
      hasGoogleBase64: boolean
      hasDatabaseUrl: boolean
      googleDocId: string | undefined
    }
    database: {
      connected: boolean
      tables: any
      counts: Record<string, any>
      samples: Record<string, any>
      schema: any
      errors: string[]
      rawVerification?: any
    }
    ingestion: {
      totalJobs: number
      successfulJobs: number
      failedJobs: number
      recentJobs: any[]
      lastSuccessfulIngestion: Date | null
      errors: string[]
    }
  } = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasGoogleDocId: !!process.env.GOOGLE_DOC_ID,
      hasGoogleBase64: !!process.env.GOOGLE_SERVICE_ACCOUNT_BASE64,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      googleDocId: process.env.GOOGLE_DOC_ID
    },
    database: {
      connected: false,
      tables: {},
      counts: {},
      samples: {},
      schema: {},
      errors: []
    },
    ingestion: {
      totalJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      recentJobs: [],
      lastSuccessfulIngestion: null,
      errors: []
    }
  }

  try {
    console.log('🔍 Starting comprehensive database diagnostic...')

    // Test database connection
    try {
      await db.$executeRaw`SELECT 1`
      results.database.connected = true
      console.log('✅ Database connection successful')
    } catch (error) {
      results.database.connected = false
      results.database.errors.push(`Connection failed: ${error}`)
      console.error('❌ Database connection failed:', error)
    }

    if (results.database.connected) {
      // Get table information
      console.log('📊 Checking table structure...')
      try {
        const tableInfo = await db.$queryRaw`
          SELECT table_name, column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          ORDER BY table_name, ordinal_position
        `
        results.database.schema = tableInfo
      } catch (error) {
        results.database.errors.push(`Schema check failed: ${error}`)
      }

      // Get record counts
      console.log('🔢 Counting records in all tables...')
      const tables = ['Issue', 'Article', 'Category', 'Tag', 'Entity', 'JobRun', 'ArticleTag', 'ArticleEntity']
      
      for (const table of tables) {
        try {
          const count = await db.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${table}"`)
          results.database.counts[table] = Array.isArray(count) ? count[0]?.count : count
          console.log(`📋 ${table}: ${results.database.counts[table]} records`)
        } catch (error) {
          results.database.counts[table] = `Error: ${error}`
          results.database.errors.push(`Count failed for ${table}: ${error}`)
        }
      }

      // Get sample data from key tables
      console.log('🔍 Getting sample data...')
      
      try {
        // JobRun samples (most important for debugging)
        const jobRuns = await db.jobRun.findMany({
          orderBy: { startedAt: 'desc' },
          take: 10
        })
        results.database.samples.jobRuns = jobRuns
        
        results.ingestion.totalJobs = jobRuns.length
        results.ingestion.successfulJobs = jobRuns.filter(j => j.status === 'success').length
        results.ingestion.failedJobs = jobRuns.filter(j => j.status === 'failure').length
        results.ingestion.recentJobs = jobRuns.slice(0, 5).map(job => ({
          id: job.id,
          type: job.jobType,
          status: job.status,
          startedAt: job.startedAt,
          endedAt: job.endedAt,
          error: job.error
        }))
        
        const lastSuccess = jobRuns.find(j => j.status === 'success')
        if (lastSuccess) {
          results.ingestion.lastSuccessfulIngestion = lastSuccess.startedAt
        }

      } catch (error) {
        results.database.errors.push(`JobRun sample failed: ${error}`)
      }

      try {
        // Issue samples
        const issues = await db.issue.findMany({
          orderBy: { issueDate: 'desc' },
          take: 5,
          include: {
            articles: {
              include: {
                category: true
              }
            }
          }
        })
        results.database.samples.issues = issues.map(issue => ({
          id: issue.id,
          date: issue.issueDate,
          subject: issue.subjectLine,
          hash: issue.hash?.substring(0, 16) + '...',
          articleCount: issue.articles.length,
          categories: [...new Set(issue.articles.map(a => a.category?.name).filter(Boolean))]
        }))
      } catch (error) {
        results.database.errors.push(`Issue sample failed: ${error}`)
      }

      try {
        // Article samples  
        const articles = await db.article.findMany({
          take: 10,
          include: {
            category: true,
            issue: true
          },
          orderBy: { createdAt: 'desc' }
        })
        results.database.samples.articles = articles.map(article => ({
          id: article.id,
          title: article.title,
          category: article.category?.name,
          issueDate: article.issue.issueDate,
          sourceUrl: article.sourceUrl,
          sourceDomain: article.sourceDomain
        }))
      } catch (error) {
        results.database.errors.push(`Article sample failed: ${error}`)
      }

      try {
        // Category samples
        const categories = await db.category.findMany({
          include: {
            _count: {
              select: { articles: true }
            }
          }
        })
        results.database.samples.categories = categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          articleCount: cat._count.articles
        }))
      } catch (error) {
        results.database.errors.push(`Category sample failed: ${error}`)
      }

      // Raw SQL checks for comparison
      console.log('🔬 Running raw SQL verification...')
      try {
        const rawChecks = await Promise.all([
          db.$queryRaw`SELECT COUNT(*)::int as count FROM "Issue"`,
          db.$queryRaw`SELECT COUNT(*)::int as count FROM "Article"`,
          db.$queryRaw`SELECT "jobType", "status", COUNT(*)::int as count FROM "JobRun" GROUP BY "jobType", "status"`,
          db.$queryRaw`SELECT "issueDate", "subjectLine", LENGTH("rawMarkdown")::int as markdown_length FROM "Issue" ORDER BY "issueDate" DESC LIMIT 3`
        ])
        results.database.rawVerification = rawChecks
      } catch (error) {
        results.database.errors.push(`Raw SQL verification failed: ${error}`)
      }
    }

    // Environment diagnostics
    console.log('🌍 Environment diagnostics complete')

    return NextResponse.json(results, { 
      headers: { 'Content-Type': 'application/json' },
      status: 200 
    })

  } catch (error) {
    console.error('❌ Diagnostic failed:', error)
    
    return NextResponse.json({
      ...results,
      criticalError: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}