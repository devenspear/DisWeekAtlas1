import { NextRequest, NextResponse } from 'next/server'
import { exportGoogleDocAsText } from '@/lib/google'
import { splitIssuesByFriday, parseIssueBlock } from '@/lib/parse'
import { db } from '@/lib/db'
import crypto from 'node:crypto'
import { sendFailureAlert } from '@/lib/alerts'

const DOC_ID = process.env.GOOGLE_DOC_ID as string

export async function POST(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('mode') || 'weekly'
  const job = await db.jobRun.create({ data: { jobType: `ingest:${mode}`, status: 'running' } })
  try {
    const { text, html } = await exportGoogleDocAsText(DOC_ID)
    const issues = splitIssuesByFriday(text)

    let processed = 0
    for (const issue of issues) {
      // If weekly, only process latest block
      if (mode === 'weekly') {
        const latest = issues[issues.length - 1]
        if (issue.dateISO !== latest.dateISO) continue
      }
      const hash = crypto.createHash('sha256').update(issue.block).digest('hex')
      const existing = await db.issue.findUnique({ where: { issueDate: new Date(issue.dateISO) } })
      if (existing && existing.hash === hash) continue

      const parsed = parseIssueBlock(issue.block, html)

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

      // Categories + articles
      for (const cat of parsed.categories) {
        const slug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')
        const category = await db.category.upsert({
          where: { slug },
          create: { slug, name: cat.name },
          update: { name: cat.name }
        })
        for (const a of cat.articles) {
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
        }
      }

      processed++
    }

    const result = { processed, mode, issues: issues.map(i=>i.dateISO).slice(-3) }
    await db.jobRun.update({ where: { id: job.id }, data: { status: 'success', endedAt: new Date() } })
    return NextResponse.json(result)
  } catch (e:any) {
    await db.jobRun.update({ where: { id: job.id }, data: { status: 'failure', error: e?.message || String(e), endedAt: new Date() } })
    await sendFailureAlert('Disruption Weekly Ingestion Failed', String(e?.stack || e))
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
