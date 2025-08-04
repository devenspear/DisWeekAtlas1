import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Disable static generation for this diagnostic endpoint
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // Check actual table structure
    const tableStructure = await db.$queryRaw`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name IN ('Issue', 'Article', 'Category', 'Tag', 'Entity', 'JobRun')
      ORDER BY table_name, ordinal_position
    `

    // Check actual data samples
    const dataSamples: Record<string, any> = {}
    
    try {
      dataSamples.issue = await db.$queryRaw`SELECT * FROM "Issue" LIMIT 2`
    } catch (e) {
      dataSamples.issue = `Error: ${e}`
    }

    try {
      dataSamples.article = await db.$queryRaw`SELECT * FROM "Article" LIMIT 2`
    } catch (e) {
      dataSamples.article = `Error: ${e}`
    }

    try {
      dataSamples.jobrun = await db.$queryRaw`SELECT * FROM "JobRun" ORDER BY "startedAt" DESC LIMIT 2`
    } catch (e) {
      dataSamples.jobrun = `Error: ${e}`
    }

    // Try different case variations
    const caseTests: Record<string, any> = {}
    
    try {
      caseTests.upperCase = await db.$queryRaw`SELECT COUNT(*)::int as count FROM "Issue"`
    } catch (e) {
      caseTests.upperCase = `Error: ${e}`
    }

    try {
      caseTests.lowerCase = await db.$queryRaw`SELECT COUNT(*)::int as count FROM "issue"`
    } catch (e) {
      caseTests.lowerCase = `Error: ${e}`
    }

    return NextResponse.json({
      success: true,
      tableStructure,
      dataSamples,
      caseTests,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}