import { google } from 'googleapis'

export function getGoogleAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

  const jwt = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/documents.readonly']
  })
  return jwt
}

export async function exportGoogleDocAsText(docId: string): Promise<{ text: string, html: string }> {
  const auth = getGoogleAuth()
  const drive = google.drive({ version: 'v3', auth })
  // Export as plain text and HTML for dual parsing
  const [txtRes, htmlRes] = await Promise.all([
    drive.files.export({ fileId: docId, mimeType: 'text/plain' }, { responseType: 'arraybuffer' }),
    drive.files.export({ fileId: docId, mimeType: 'text/html' }, { responseType: 'arraybuffer' }),
  ])
  const text = Buffer.from(txtRes.data as ArrayBuffer).toString('utf-8')
  const html = Buffer.from(htmlRes.data as ArrayBuffer).toString('utf-8')
  return { text, html }
}
