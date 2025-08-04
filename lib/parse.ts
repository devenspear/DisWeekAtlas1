import * as cheerio from 'cheerio'

export type ParsedIssue = {
  dateISO: string
  rawBlock: string
  subjectLine?: string
  topline?: { shift?: string, signal?: string, why?: string }
  categories: Array<{
    name: string
    articles: Array<{
      title: string
      summaryText?: string
      summaryMd?: string
      sourceUrl: string
      sourceDomain: string
      quotedStat?: string
    }>
  }>
}

// Multiple regex patterns to handle formatting variations across 2+ years of content
const ISSUE_DATE_PATTERNS = [
  // Current format: "DISRUPTION WEEKLY  >  Month day, year" (flexible spacing)
  /^DISRUPTION\s+WEEKLY\s*>\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})/mi,
  // Older possible formats with various spacing and punctuation
  /^DISRUPTION\s+WEEKLY\s*[-–—>]\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})/mi,
  // Without separator
  /^DISRUPTION\s+WEEKLY\s+([A-Za-z]+\s+\d{1,2},\s*\d{4})/mi,
  // With extra text before date
  /^DISRUPTION\s+WEEKLY.*?([A-Za-z]+\s+\d{1,2},\s*\d{4})/mi,
  // Date-only patterns (fallback for very different formatting)
  /^([A-Za-z]+\s+\d{1,2},\s*\d{4})\s*$/mi
]

function normalizeDateToISO(dateStr: string) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) throw new Error('Invalid date: ' + dateStr)
  const iso = d.toISOString().slice(0,10)
  return iso
}

export function splitIssuesByFriday(text: string): Array<{ dateISO: string, block: string }> {
  const lines = text.split(/\r?\n/)
  const indices: Array<{idx: number, dateISO: string}> = []
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Try each pattern until one matches
    for (let patternIndex = 0; patternIndex < ISSUE_DATE_PATTERNS.length; patternIndex++) {
      const pattern = ISSUE_DATE_PATTERNS[patternIndex]
      const match = line.match(pattern)
      
      if (match && match[1]) {
        try {
          const dateStr = match[1].trim()
          const dateISO = normalizeDateToISO(dateStr)
          console.log(`🔍 Found issue date: "${dateStr}" on line ${i + 1} (pattern ${patternIndex + 1})`)
          indices.push({ idx: i, dateISO })
          break // Found a match, stop trying other patterns for this line
        } catch (error) {
          console.log(`⚠️ Date parse failed for "${match[1]}" on line ${i + 1}: ${error}`)
          continue // Try next pattern
        }
      }
    }
  }
  indices.sort((a,b)=>a.idx-b.idx)
  const results: Array<{ dateISO: string, block: string }> = []
  for (let i=0;i<indices.length;i++) {
    const start = indices[i].idx
    const end = i < indices.length - 1 ? indices[i+1].idx : lines.length
    const block = lines.slice(start, end).join('\n')
    results.push({ dateISO: indices[i].dateISO, block })
  }
  return results
}

function extractUrlDomain(url: string) {
  try { return new URL(url).hostname.replace(/^www\./,'') } catch { return '' }
}

export function parseIssueBlock(block: string, htmlFallback?: string): ParsedIssue {
  const out: ParsedIssue = { dateISO: 'unknown', rawBlock: block, categories: [] }

  // Subject Line
  const subjMatch = block.match(/^(?:Subject Line|Subject):\s*(.+)$/mi)
  if (subjMatch) out.subjectLine = subjMatch[1].trim()

  // Topline Takeaway
  const shift = block.match(/\*\*?The shift\*\*?:?\s*([\s\S]*?)(?=\n\*\*?The signal|\n\*\*?Why it matters|\n[A-Z])/i)
  const signal = block.match(/\*\*?The signal\*\*?:?\s*([\s\S]*?)(?=\n\*\*?Why it matters|\n[A-Z])/i)
  const why = block.match(/\*\*?Why it matters\*\*?:?\s*([\s\S]*?)(?=\n[A-Z]|$)/i)
  out.topline = { shift: shift?.[1]?.trim(), signal: signal?.[1]?.trim(), why: why?.[1]?.trim() }

  // Categories (simple heuristic by known headings)
  const catNames = [
    'AI News', 'Web3', 'Crypto', 'Wellness', 'Marketing Innovators', 'Reports', 'Reports & Guides', 'Guides'
  ]
  const lines = block.split(/\r?\n/)
  let i=0
  while (i < lines.length) {
    const line = lines[i].trim()
    const isCat = catNames.find(c => new RegExp(`^${c}`, 'i').test(line))
    if (isCat) {
      const name = isCat
      const articles: ParsedIssue['categories'][number]['articles'] = []
      i++
      while (i < lines.length && !catNames.some(c => new RegExp(`^${c}`, 'i').test(lines[i].trim()))) {
        const l = lines[i].trim()
        // Bullet or headline + URL on next line
        if (/^[-*•]/.test(l) || l.length > 0) {
          // try "Title — URL" or "Title (URL)"
          let title = l.replace(/^[-*•]\s*/, '')
          let url = ''
          const paren = title.match(/\((https?:[^\)]+)\)/i)
          if (paren) { url = paren[1]; title = title.replace(paren[0],'').trim() }
          const dash = title.match(/\s[-–—]\s(https?:\S+)/)
          if (dash) { url = dash[1]; title = title.replace(dash[0],'').trim() }
          // or line below might be URL
          if (!url && i+1 < lines.length && /^https?:\/\//.test(lines[i+1].trim())) {
            url = lines[i+1].trim(); i++
          }
          if (title && url) {
            articles.push({
              title,
              sourceUrl: url,
              sourceDomain: extractUrlDomain(url),
              summaryText: undefined,
              summaryMd: undefined,
            })
          }
        }
        i++
      }
      out.categories.push({ name, articles })
      continue
    }
    i++
  }

  // As a fallback, we can attempt to parse anchor tags from htmlFallback
  if (out.categories.length === 0 && htmlFallback) {
    const $ = cheerio.load(htmlFallback)
    const anchors = $('a[href]')
    const articles: any[] = []
    anchors.each((_, a) => {
      const url = $(a).attr('href') || ''
      const title = $(a).text().trim()
      if (url && title) {
        articles.push({ title, sourceUrl: url, sourceDomain: extractUrlDomain(url) })
      }
    })
    if (articles.length) out.categories.push({ name: 'Uncategorized', articles })
  }

  return out
}
