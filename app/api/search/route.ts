import { NextRequest, NextResponse } from 'next/server'
import { keywordSearch } from '@/lib/search'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || ''
  if (!q) return NextResponse.json({ items: [] })
  const items = await keywordSearch(q, 40)
  return NextResponse.json({ items })
}
