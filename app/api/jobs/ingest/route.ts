import { NextRequest, NextResponse } from 'next/server'
import { exportGoogleDocAsText } from '@/lib/google'
import { splitIssuesByFriday, parseIssueBlock } from '@/lib/parse'
import { db } from '@/lib/db'
import crypto from 'node:crypto'
import { sendFailureAlert } from '@/lib/alerts'

const DOC_ID = process.env.GOOGLE_DOC_ID as string

export async function POST(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode') || 'weekly'
  
  // Detailed environment variable debugging
  console.log('🔍 Environment Check:')
  console.log('- GOOGLE_DOC_ID:', DOC_ID ? '✅ Set' : '❌ Missing')
  console.log('- GOOGLE_SERVICE_ACCOUNT_BASE64:', process.env.GOOGLE_SERVICE_ACCOUNT_BASE64 ? '✅ Set' : '❌ Missing')
  console.log('- GOOGLE_CLIENT_EMAIL:', process.env.GOOGLE_CLIENT_EMAIL ? '✅ Set' : '❌ Missing')
  console.log('- GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? '✅ Set' : '❌ Missing')
  console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing')
  
  if (!DOC_ID) {
    console.error('❌ GOOGLE_DOC_ID not set')
    return NextResponse.json({ error: 'GOOGLE_DOC_ID environment variable not set' }, { status: 500 })
  }
  
  console.log(`🚀 Starting ingestion job in mode: ${mode}`)
  
  let job: any
  try {
    console.log('📝 Creating job record...')
    job = await db.jobRun.create({ data: { jobType: `ingest:${mode}`, status: 'running' } })
    console.log(`✅ Job created with ID: ${job.id}`)
  } catch (dbError) {
    console.error('❌ Failed to create job record:', dbError)
    return NextResponse.json({ error: `Database error creating job: ${dbError}` }, { status: 500 })
  }
  
  try {
    console.log('📄 Fetching Google Doc content...')
    const { text, html } = await exportGoogleDocAsText(DOC_ID)
    console.log(`✅ Google Doc fetched successfully. Text length: ${text.length}, HTML length: ${html.length}`)
    
    console.log('📊 Parsing issues from text...')
    const issues = splitIssuesByFriday(text)
    console.log(`✅ Found ${issues.length} issues`)

    let processed = 0
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i]
      console.log(`🔄 Processing issue ${i + 1}/${issues.length}: ${issue.dateISO}`)
      
      // If weekly, only process latest block
      if (mode === 'weekly') {
        const latest = issues[issues.length - 1]
        if (issue.dateISO !== latest.dateISO) {
          console.log(`⏭️ Skipping ${issue.dateISO} (not latest in weekly mode)`)
          continue
        }
      }
      
      console.log('🔐 Generating content hash...')
      const hash = crypto.createHash('sha256').update(issue.block).digest('hex')
      console.log(`✅ Hash generated: ${hash.substring(0, 16)}...`)
      
      console.log('🔍 Checking for existing issue...')
      const existing = await db.issue.findUnique({ where: { issueDate: new Date(issue.dateISO) } })
      if (existing && existing.hash === hash) {
        console.log(`⏭️ Issue ${issue.dateISO} unchanged (same hash)`)
        continue
      }
      
      console.log('📝 Parsing issue block...')
      const parsed = parseIssueBlock(issue.block, html)
      console.log(`✅ Parsed: ${parsed.categories.length} categories, subject: "${parsed.subjectLine}"`)

      console.log('💾 Upserting issue to database...')

      const upserted = await db.issue.upsert({
        where: { issueDate: new Date(issue.dateISO) },
        create: {
          issueDate: new Date(issue.dateISO),
          subjectLine: parsed.subjectLine,
          toplineShift: parsed.topline?.shift,
          toplineSignal: parsed.topline?.signal,
          toplineWhy: parsed.topline?.why,
          rawMarkdown: issue.block,
          rawHtml: html,
          hash
        },
        update: {
          subjectLine: parsed.subjectLine,
          toplineShift: parsed.topline?.shift,
          toplineSignal: parsed.topline?.signal,
          toplineWhy: parsed.topline?.why,
          rawMarkdown: issue.block,
          rawHtml: html,
          hash
        }
      })

      console.log(`✅ Issue upserted with ID: ${upserted.id}`)

      // Categories + articles
      console.log(`📂 Processing ${parsed.categories.length} categories...`)
      for (let catIndex = 0; catIndex < parsed.categories.length; catIndex++) {
        const cat = parsed.categories[catIndex]
        console.log(`📂 Category ${catIndex + 1}: "${cat.name}" (${cat.articles.length} articles)`)
        
        const slug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
        const category = await db.category.upsert({
          where: { slug },
          create: { slug, name: cat.name },
          update: { name: cat.name }
        })
        console.log(`✅ Category upserted: ${category.id}`)
        
        for (let artIndex = 0; artIndex < cat.articles.length; artIndex++) {
          const a = cat.articles[artIndex]
          console.log(`📄 Article ${artIndex + 1}: "${a.title}"`)
          
          try {
            await db.article.create({
              data: {
                issueId: upserted.id,
                categoryId: category.id,
                title: a.title,
                summaryMd: a.summaryMd,
                summaryText: a.summaryText,
                sourceUrl: a.sourceUrl,
                sourceDomain: a.sourceDomain,
                quotedStat: a.quotedStat
              }
            })
            console.log(`✅ Article created successfully`)
          } catch (articleError) {
            console.error(`❌ Failed to create article: ${articleError}`)
            throw new Error(`Failed to create article "${a.title}": ${articleError}`)
          }
        }
      }

      processed++
    }

    console.log(`🎉 Ingestion completed successfully! Processed ${processed} issues.`)
    const result = { 
      processed, 
      mode, 
      issues: issues.map(i=>i.dateISO).slice(-3),
      totalIssuesFound: issues.length,
      jobId: job.id
    }
    
    await db.jobRun.update({ where: { id: job.id }, data: { status: 'success', endedAt: new Date() } })
    console.log(`✅ Job ${job.id} marked as successful`)
    
    return NextResponse.json(result)
  } catch (e:any) {
    console.error('❌ INGESTION FAILED:')
    console.error('Error message:', e?.message)
    console.error('Error stack:', e?.stack)
    console.error('Full error object:', e)
    
    // Determine error category for better debugging
    let errorCategory = 'Unknown'
    if (e?.message?.includes('google') || e?.message?.includes('auth')) {
      errorCategory = 'Google Authentication'
    } else if (e?.message?.includes('database') || e?.message?.includes('prisma')) {
      errorCategory = 'Database'
    } else if (e?.message?.includes('parse') || e?.message?.includes('split')) {
      errorCategory = 'Content Parsing'
    }
    
    const errorDetails = {
      category: errorCategory,
      message: e?.message || 'Unknown error',
      stack: e?.stack || 'No stack trace',
      fullError: String(e)
    }
    
    try {
      await db.jobRun.update({ 
        where: { id: job.id }, 
        data: { 
          status: 'failure', 
          error: JSON.stringify(errorDetails),
          endedAt: new Date() 
        } 
      })
      console.log(`✅ Job ${job.id} marked as failed`)
    } catch (updateError) {
      console.error('❌ Failed to update job status:', updateError)
    }
    
    try {
      await sendFailureAlert('Disruption Weekly Ingestion Failed', JSON.stringify(errorDetails, null, 2))
    } catch (alertError) {
      console.error('❌ Failed to send failure alert:', alertError)
    }
    
    return NextResponse.json({ 
      error: e?.message || 'Unknown error',
      category: errorCategory,
      details: errorDetails
    }, { status: 500 })
  }
}
