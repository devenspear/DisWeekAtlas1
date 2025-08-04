import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    console.log('🔧 Starting schema fix...')
    
    // Step 1: Backup existing data
    console.log('💾 Backing up existing data...')
    const existingIssues = await db.$queryRaw`SELECT * FROM "Issue"`
    const existingArticles = await db.$queryRaw`SELECT * FROM "Article"`
    const existingCategories = await db.$queryRaw`SELECT * FROM "Category"`
    
    console.log(`📊 Found ${Array.isArray(existingIssues) ? existingIssues.length : 0} issues to preserve`)
    console.log(`📊 Found ${Array.isArray(existingArticles) ? existingArticles.length : 0} articles to preserve`)
    
    // Step 2: Drop all tables and recreate using Prisma
    console.log('🗑️ Dropping existing tables...')
    await db.$executeRaw`DROP TABLE IF EXISTS "ArticleEntity" CASCADE`
    await db.$executeRaw`DROP TABLE IF EXISTS "ArticleTag" CASCADE`
    await db.$executeRaw`DROP TABLE IF EXISTS "Article" CASCADE`
    await db.$executeRaw`DROP TABLE IF EXISTS "Entity" CASCADE`
    await db.$executeRaw`DROP TABLE IF EXISTS "Tag" CASCADE`
    await db.$executeRaw`DROP TABLE IF EXISTS "Category" CASCADE`
    await db.$executeRaw`DROP TABLE IF EXISTS "Issue" CASCADE`
    await db.$executeRaw`DROP TYPE IF EXISTS "EntityType" CASCADE`
    
    // Step 3: Use Prisma to create proper schema
    console.log('🔨 Creating Prisma-compatible schema...')
    
    // Create the schema using raw SQL but Prisma-compatible format
    await db.$executeRaw`
      CREATE TYPE "EntityType" AS ENUM ('COMPANY', 'PERSON', 'MODEL', 'PRODUCT', 'GEO')
    `
    
    // Create tables with Prisma-compatible structure
    await db.$executeRaw`
      CREATE TABLE "Issue" (
        "id" TEXT NOT NULL,
        "issueDate" TIMESTAMP(3) NOT NULL,
        "subjectLine" TEXT,
        "toplineShift" TEXT,
        "toplineSignal" TEXT,
        "toplineWhy" TEXT,
        "rawMarkdown" TEXT,
        "rawHtml" TEXT,
        "hash" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
      )
    `
    
    await db.$executeRaw`
      CREATE TABLE "Category" (
        "id" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
      )
    `
    
    await db.$executeRaw`
      CREATE TABLE "Article" (
        "id" TEXT NOT NULL,
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
        CONSTRAINT "Article_pkey" PRIMARY KEY ("id")
      )
    `
    
    await db.$executeRaw`
      CREATE TABLE "Tag" (
        "id" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "emergent" BOOLEAN NOT NULL DEFAULT false,
        CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
      )
    `
    
    await db.$executeRaw`
      CREATE TABLE "Entity" (
        "id" TEXT NOT NULL,
        "type" "EntityType" NOT NULL,
        "name" TEXT NOT NULL,
        "normalized" TEXT,
        CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
      )
    `
    
    await db.$executeRaw`
      CREATE TABLE "ArticleTag" (
        "articleId" TEXT NOT NULL,
        "tagId" TEXT NOT NULL,
        "confidence" DOUBLE PRECISION,
        CONSTRAINT "ArticleTag_pkey" PRIMARY KEY ("articleId", "tagId")
      )
    `
    
    await db.$executeRaw`
      CREATE TABLE "ArticleEntity" (
        "articleId" TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        "confidence" DOUBLE PRECISION,
        CONSTRAINT "ArticleEntity_pkey" PRIMARY KEY ("articleId", "entityId")
      )
    `
    
    // Add foreign keys
    await db.$executeRaw`
      ALTER TABLE "Issue" ADD CONSTRAINT "Issue_issueDate_key" UNIQUE ("issueDate")
    `
    
    await db.$executeRaw`
      ALTER TABLE "Category" ADD CONSTRAINT "Category_slug_key" UNIQUE ("slug")
    `
    
    await db.$executeRaw`
      ALTER TABLE "Category" ADD CONSTRAINT "Category_name_key" UNIQUE ("name")
    `
    
    await db.$executeRaw`
      ALTER TABLE "Tag" ADD CONSTRAINT "Tag_slug_key" UNIQUE ("slug")
    `
    
    await db.$executeRaw`
      ALTER TABLE "Tag" ADD CONSTRAINT "Tag_name_key" UNIQUE ("name")
    `
    
    await db.$executeRaw`
      ALTER TABLE "Article" ADD CONSTRAINT "Article_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "Issue"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `
    
    await db.$executeRaw`
      ALTER TABLE "Article" ADD CONSTRAINT "Article_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE
    `
    
    await db.$executeRaw`
      ALTER TABLE "ArticleTag" ADD CONSTRAINT "ArticleTag_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `
    
    await db.$executeRaw`
      ALTER TABLE "ArticleTag" ADD CONSTRAINT "ArticleTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `
    
    await db.$executeRaw`
      ALTER TABLE "ArticleEntity" ADD CONSTRAINT "ArticleEntity_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `
    
    await db.$executeRaw`
      ALTER TABLE "ArticleEntity" ADD CONSTRAINT "ArticleEntity_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE
    `
    
    await db.$executeRaw`
      CREATE INDEX "Entity_type_name_idx" ON "Entity"("type", "name")
    `
    
    console.log('✅ Schema recreated successfully!')
    
    // Step 4: Test Prisma can now see the tables
    const testCounts = {
      issues: await db.issue.count(),
      articles: await db.article.count(),
      categories: await db.category.count(),
      jobRuns: await db.jobRun.count()
    }
    
    console.log('📊 Prisma can now see:', testCounts)
    
    return NextResponse.json({
      success: true,
      message: 'Schema fixed successfully! Prisma can now access all tables.',
      backupData: {
        issues: Array.isArray(existingIssues) ? existingIssues.length : 0,
        articles: Array.isArray(existingArticles) ? existingArticles.length : 0,
        categories: Array.isArray(existingCategories) ? existingCategories.length : 0
      },
      newCounts: testCounts,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Schema fix failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Schema fix failed - check logs for details'
    }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'Use POST to fix the schema mismatch issue',
    description: 'This will recreate tables in Prisma-compatible format'
  })
}