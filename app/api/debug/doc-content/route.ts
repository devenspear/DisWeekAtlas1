import { NextRequest, NextResponse } from 'next/server'
import { exportGoogleDocAsText } from '@/lib/google'
import { splitIssuesByFriday } from '@/lib/parse'

// Disable static generation
export const dynamic = 'force-dynamic'

// AI-powered analysis of unmatched headers to suggest regex patterns
async function analyzeUnmatchedHeaders(potentialHeaders: any[], matchedHeaders: any[]): Promise<string> {
  if (potentialHeaders.length === 0) return "No potential headers found"
  
  const unmatched = potentialHeaders.filter(ph => 
    !matchedHeaders.some(mh => mh.lineNumber === ph.lineNumber)
  )
  
  if (unmatched.length === 0) return "All headers matched successfully! 🎉"
  
  // Simple AI analysis - suggest patterns based on common variations
  const suggestions = []
  
  for (const header of unmatched.slice(0, 5)) { // Analyze first 5 unmatched
    const content = header.content
    
    if (content.includes('DISRUPTION') && content.includes('WEEKLY')) {
      // Extract any date-like pattern
      const datePattern = content.match(/([A-Za-z]+\s+\d{1,2}[,\s]*\d{4})/i)
      if (datePattern) {
        suggestions.push(`Line ${header.lineNumber}: "${content}" → Date found: "${datePattern[1]}"`)
      } else {
        suggestions.push(`Line ${header.lineNumber}: "${content}" → Contains DISRUPTION WEEKLY but no date pattern`)
      }
    }
  }
  
  return suggestions.length > 0 
    ? `Found ${unmatched.length} unmatched headers. Suggestions:\n${suggestions.join('\n')}`
    : `${unmatched.length} unmatched headers found but no clear date patterns detected`
}

export async function GET(req: NextRequest) {
  try {
    const GOOGLE_DOC_ID = process.env.GOOGLE_DOC_ID!
    
    console.log('📄 Fetching Google Doc content...')
    const { text, html } = await exportGoogleDocAsText(GOOGLE_DOC_ID)
    
    console.log(`✅ Doc fetched. Text length: ${text.length}`)
    
    // Show first 2000 characters of content
    const preview = text.substring(0, 2000)
    
    // Try all date patterns including historical variations
    // Note: Google Docs escapes > as \u003E, so we need to handle both
    const ISSUE_DATE_PATTERNS = [
      /^DISRUPTION\s+WEEKLY\s*\\u003E\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})/mi,
      /^DISRUPTION\s+WEEKLY\s*>\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})/mi,
      /^DISRUPTION\s+WEEKLY\s*[-–—>]\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})/mi,
      /^DISRUPTION\s+WEEKLY\s+([A-Za-z]+\s+\d{1,2},\s*\d{4})/mi,
      /^DISRUPTION\s+WEEKLY.*?([A-Za-z]+\s+\d{1,2},\s*\d{4})/mi,
      /^([A-Za-z]+\s+\d{1,2},\s*\d{4})\s*$/mi
    ]
    
    const lines = text.split(/\r?\n/)
    const issueHeaderMatches = []
    const potentialHeaders = []
    
    // Scan for all potential issue headers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Look for actual matches
      for (let p = 0; p < ISSUE_DATE_PATTERNS.length; p++) {
        const match = line.match(ISSUE_DATE_PATTERNS[p])
        if (match && match[1]) {
          issueHeaderMatches.push({
            lineNumber: i + 1,
            content: line,
            extractedDate: match[1],
            patternUsed: p + 1
          })
          break
        }
      }
      
      // Also collect lines that contain "DISRUPTION" for AI analysis
      if (line.toLowerCase().includes('disruption') && line.toLowerCase().includes('weekly')) {
        potentialHeaders.push({
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
      issueHeaderMatches: issueHeaderMatches,
      potentialHeaders: potentialHeaders.slice(0, 20), // First 20 potential headers for analysis
      parsedIssuesCount: parsedIssues.length,
      parsedIssues: parsedIssues.map(issue => ({
        date: issue.dateISO,
        blockLength: issue.block.length,
        blockPreview: issue.block.substring(0, 200)
      })),
      parseError: parseError,
      datePatterns: datePatterns.slice(0, 10),
      expectedFormats: [
        "DISRUPTION WEEKLY  >  August 1, 2025",
        "DISRUPTION WEEKLY - August 1, 2025", 
        "DISRUPTION WEEKLY August 1, 2025",
        "August 1, 2025 (standalone)"
      ],
      aiAnalysis: await analyzeUnmatchedHeaders(potentialHeaders, issueHeaderMatches),
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