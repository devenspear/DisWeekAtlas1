import { NextRequest, NextResponse } from 'next/server'
import { splitIssuesByFriday, parseIssueBlock } from '@/lib/parse'
import { db } from '@/lib/db'
import crypto from 'node:crypto'

// Handle Google Apps Script webhook (NO Google Cloud needed!)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Verify webhook secret (add this to your environment variables)
    const authHeader = req.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.WEBHOOK_SECRET}`
    
    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { content, source } = body
    
    if (!content || source !== 'google-apps-script') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    // Process the content (same logic as regular ingestion)
    const issues = splitIssuesByFriday(content)
    
    let processed = 0
    for (const issue of issues) {
      // Only process the latest issue for weekly updates
      const latest = issues[issues.length - 1]
      if (issue.dateISO !== latest.dateISO) continue
      
      const hash = crypto.createHash('sha256').update(issue.block).digest('hex')
      const existing = await db.issue.findUnique({ 
        where: { issueDate: new Date(issue.dateISO) } 
      })
      
      if (existing && existing.hash === hash) continue

      const parsed = parseIssueBlock(issue.block, content)

      await db.issue.upsert({
        where: { issueDate: new Date(issue.dateISO) },
        update: {
          subjectLine: parsed.subjectLine,
          toplineShift: parsed.topline?.shift,
          toplineSignal: parsed.topline?.signal,
          toplineWhy: parsed.topline?.why,
          rawMarkdown: issue.block,
          rawHtml: content,
          hash
        },
        create: {
          issueDate: new Date(issue.dateISO),
          subjectLine: parsed.subjectLine,
          toplineShift: parsed.topline?.shift,
          toplineSignal: parsed.topline?.signal,
          toplineWhy: parsed.topline?.why,
          rawMarkdown: issue.block,
          rawHtml: content,
          hash
        }
      })
      
      processed++
    }

    // Create job record
    await db.jobRun.create({
      data: {
        jobType: 'webhook:google-apps-script',
        status: 'success',
        endedAt: new Date()
      }
    })

    return NextResponse.json({ 
      success: true, 
      processed,
      message: `Processed ${processed} issues via Google Apps Script webhook` 
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    
    await db.jobRun.create({
      data: {
        jobType: 'webhook:google-apps-script',
        status: 'failure',
        error: error instanceof Error ? error.message : 'Unknown error',
        endedAt: new Date()
      }
    })

    return NextResponse.json({ 
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}