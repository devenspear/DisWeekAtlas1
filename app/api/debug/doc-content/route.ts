import { NextRequest, NextResponse } from 'next/server'
import { exportGoogleDocAsText } from '@/lib/google'
import { splitIssuesByFriday } from '@/lib/parse'

// Disable static generation
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const GOOGLE_DOC_ID = process.env.GOOGLE_DOC_ID!
    
    console.log('📄 Fetching Google Doc content...')
    const { text, html } = await exportGoogleDocAsText(GOOGLE_DOC_ID)
    
    console.log(`✅ Doc fetched. Text length: ${text.length}`)
    
    // Show first 2000 characters of content
    const preview = text.substring(0, 2000)
    
    // Try to find Friday dates
    const FRIDAY_REGEX = /^(Friday,\s*[A-Za-z]+\s+\d{1,2},\s*\d{4})$/mi
    const lines = text.split(/\r?\n/)
    const fridayMatches = []
    
    for (let i = 0; i < lines.length && i < 100; i++) {
      const line = lines[i].trim()
      if (line.match(FRIDAY_REGEX)) {
        fridayMatches.push({
          lineNumber: i + 1,
          content: line
        })
      }
    }
    
    // Try the parsing function
    let parsedIssues: any[] = []
    let parseError: string | null = null
    try {
      parsedIssues = splitIssuesByFriday(text)
    } catch (error) {
      parseError = `Parse error: ${error}`
      parsedIssues = []
    }
    
    // Look for any date-like patterns
    const datePatterns = []
    const dateRegexes = [
      /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s*[A-Za-z]+\s+\d{1,2},?\s*\d{4}\b/gi,
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/g,
      /\b[A-Za-z]+\s+\d{1,2},?\s*\d{4}\b/g
    ]
    
    for (let i = 0; i < lines.length && i < 50; i++) {
      const line = lines[i].trim()
      for (const regex of dateRegexes) {
        const matches = line.match(regex)
        if (matches) {
          datePatterns.push({
            lineNumber: i + 1,
            line: line,
            matches: matches
          })
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      docId: GOOGLE_DOC_ID,
      contentLength: text.length,
      preview: preview,
      fridayMatches: fridayMatches,
      parsedIssuesCount: parsedIssues.length,
      parsedIssues: parsedIssues.map(issue => ({
        date: issue.dateISO,
        blockLength: issue.block.length,
        blockPreview: issue.block.substring(0, 200)
      })),
      parseError: parseError,
      datePatterns: datePatterns.slice(0, 10),
      expectedFormat: "The parser expects lines like: 'Friday, August 4, 2025'",
      firstFewLines: lines.slice(0, 20)
    })
    
  } catch (error) {
    console.error('❌ Failed to analyze doc content:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      message: 'Failed to fetch or analyze Google Doc content'
    }, { status: 500 })
  }
}