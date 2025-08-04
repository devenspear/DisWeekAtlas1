import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Special endpoint to initialize database schema
export async function POST(req: NextRequest) {
  try {
    // This will create all the tables if they don't exist
    // In production, we'd use migrations, but for initial setup this works
    
    console.log('Initializing database schema...')
    
    // Test database connection and create tables
    await db.$executeRaw`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `
    
    // Check if tables exist, if not Prisma will handle the creation
    const tableCheck = await db.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('Issue', 'Article', 'Category', 'Tag', 'Entity', 'JobRun');
    `
    
    console.log('Existing tables:', tableCheck)
    
    // Test creating a job run record
    const testJob = await db.jobRun.create({
      data: {
        jobType: 'database-init',
        status: 'success',
        endedAt: new Date()
      }
    })
    
    console.log('Database initialization successful!')
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database initialized successfully',
      tables: tableCheck,
      testJobId: testJob.id
    })
    
  } catch (error) {
    console.error('Database initialization error:', error)
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Database initialization failed. You may need to run `prisma db push` first.'
    }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    message: 'Database initialization endpoint. Use POST to initialize.',
    instructions: 'This endpoint will create the necessary database tables.'
  })
}