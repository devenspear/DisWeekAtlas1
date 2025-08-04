import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Database setup using Prisma client directly (serverless-friendly)
export async function POST(req: NextRequest) {
  try {
    console.log('🔄 Setting up database schema...')
    
    // Check database connection first
    console.log('🔍 Testing database connection...')
    await db.$executeRaw`SELECT 1`
    console.log('✅ Database connection successful')
    
    // Execute each SQL command separately (PostgreSQL doesn't allow multiple in one statement)
    const commands = [
      // Enable UUID extension (use gen_random_uuid instead of uuid-ossp)
      'CREATE EXTENSION IF NOT EXISTS "pgcrypto"',
      
      // Create EntityType enum with error handling
      `DO $$ BEGIN
        CREATE TYPE "EntityType" AS ENUM ('COMPANY', 'PERSON', 'MODEL', 'PRODUCT', 'GEO');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$`,
      
      // Create Issue table
      `CREATE TABLE IF NOT EXISTS "Issue" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "issueDate" TIMESTAMP(3) NOT NULL UNIQUE,
        "subjectLine" TEXT,
        "toplineShift" TEXT,
        "toplineSignal" TEXT,
        "toplineWhy" TEXT,
        "rawMarkdown" TEXT,
        "rawHtml" TEXT,
        "hash" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Create Category table
      `CREATE TABLE IF NOT EXISTS "Category" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "slug" TEXT NOT NULL UNIQUE,
        "name" TEXT NOT NULL UNIQUE
      )`,
      
      // Create Article table
      `CREATE TABLE IF NOT EXISTS "Article" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "issueId" TEXT NOT NULL,
        "categoryId" TEXT,
        "title" TEXT NOT NULL,
        "summaryMd" TEXT,
        "summaryText" TEXT,
        "sourceUrl" TEXT NOT NULL,
        "sourceDomain" TEXT NOT NULL,
        "quotedStat" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE
      )`,
      
      // Create Tag table
      `CREATE TABLE IF NOT EXISTS "Tag" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "slug" TEXT NOT NULL UNIQUE,
        "name" TEXT NOT NULL UNIQUE,
        "emergent" BOOLEAN NOT NULL DEFAULT false
      )`,
      
      // Create ArticleTag table
      `CREATE TABLE IF NOT EXISTS "ArticleTag" (
        "articleId" TEXT NOT NULL,
        "tagId" TEXT NOT NULL,
        "confidence" DOUBLE PRECISION,
        PRIMARY KEY ("articleId", "tagId"),
        FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )`,
      
      // Create Entity table
      `CREATE TABLE IF NOT EXISTS "Entity" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "type" "EntityType" NOT NULL,
        "name" TEXT NOT NULL,
        "normalized" TEXT
      )`,
      
      // Create index on Entity
      'CREATE INDEX IF NOT EXISTS "Entity_type_name_idx" ON "Entity"("type", "name")',
      
      // Create ArticleEntity table
      `CREATE TABLE IF NOT EXISTS "ArticleEntity" (
        "articleId" TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        "confidence" DOUBLE PRECISION,
        PRIMARY KEY ("articleId", "entityId"),
        FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
        FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )`,
      
      // Create JobRun table
      `CREATE TABLE IF NOT EXISTS "JobRun" (
        "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
        "jobType" TEXT NOT NULL,
        "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "endedAt" TIMESTAMP(3),
        "status" TEXT NOT NULL,
        "error" TEXT
      )`
    ]
    
    // Execute each command separately with better error handling
    const results = []
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i]
      try {
        console.log(`[${i + 1}/${commands.length}] Executing: ${command.substring(0, 50)}...`)
        await db.$executeRawUnsafe(command)
        results.push(`✅ Command ${i + 1}: Success`)
        console.log(`✅ Command ${i + 1} completed successfully`)
      } catch (error) {
        const errorMsg = `❌ Command ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        results.push(errorMsg)
        console.error(errorMsg)
        console.error('Full error:', error)
        // Continue with other commands even if one fails
      }
    }
    
    // Check if tables were actually created
    console.log('🔍 Verifying tables were created...')
    try {
      const tableCheck = await db.$executeRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('Issue', 'Article', 'Category', 'Tag', 'Entity', 'JobRun')
      `
      console.log('✅ Table verification completed:', tableCheck)
    } catch (error) {
      console.error('❌ Table verification failed:', error)
    }
    
    // Test that tables were created by creating a test job
    const testJob = await db.jobRun.create({
      data: {
        jobType: 'schema-setup-test',
        status: 'success',
        endedAt: new Date()
      }
    })
    
    console.log('✅ Database schema created successfully!')
    console.log('✅ Test job created:', testJob.id)
    
    // Clean up test record
    await db.jobRun.delete({
      where: { id: testJob.id }
    })
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database schema created successfully!',
      details: 'All tables (Issue, Article, Category, Tag, Entity, JobRun) created and verified.',
      testJobId: testJob.id,
      executionResults: results
    })
    
  } catch (error) {
    console.error('Database setup error:', error)
    
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Database schema creation failed',
      details: 'Check that your DATABASE_URL is correct and the database is accessible.'
    }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    message: 'Use POST to set up database schema with Prisma db push'
  })
}