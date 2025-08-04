import { NextRequest, NextResponse } from 'next/server'
import { keywordSearch } from '@/lib/search'

export async function POST(req: NextRequest) {
  const { question } = await req.json()
  if (!question) return NextResponse.json({ answer: '', citations: [] })
  // Stub: return top 5 as "citations"
  const items = await keywordSearch(question, 5)
  const citations = items.map(i => ({ title: i.title, url: i.sourceUrl }))
  const answer = 'Starter: this will synthesize an answer from retrieved context (RAG).'
  return NextResponse.json({ answer, citations })
}
