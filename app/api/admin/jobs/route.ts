import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const jobs = await db.jobRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20 // Get last 20 jobs
    })

    return NextResponse.json({ 
      success: true,
      jobs: jobs.map(job => ({
        id: job.id,
        jobType: job.jobType,
        startedAt: job.startedAt.toISOString(),
        endedAt: job.endedAt?.toISOString() || null,
        status: job.status,
        error: job.error
      }))
    })

  } catch (error) {
    console.error('Failed to fetch job history:', error)
    
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      jobs: []
    }, { status: 500 })
  }
}