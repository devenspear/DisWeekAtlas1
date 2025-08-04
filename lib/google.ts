import { google } from 'googleapis'

export function getGoogleAuth() {
  // Try Base64 encoded service account first (recommended for Vercel)
  if (process.env.GOOGLE_SERVICE_ACCOUNT_BASE64) {
    try {
      console.log('🔑 Using Base64 encoded service account')
      const base64Credentials = process.env.GOOGLE_SERVICE_ACCOUNT_BASE64
      const decodedCredentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
      const credentials = JSON.parse(decodedCredentials)
      
      return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/documents.readonly']
      })
    } catch (error) {
      console.error('❌ Failed to decode Base64 service account:', error)
      throw new Error('Invalid GOOGLE_SERVICE_ACCOUNT_BASE64 format')
    }
  }
  
  // Fallback to individual environment variables with improved private key handling
  console.log('🔑 Using individual environment variables')
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || ''
  
  if (!clientEmail || !privateKey) {
    throw new Error('Missing Google credentials. Set GOOGLE_SERVICE_ACCOUNT_BASE64 or GOOGLE_CLIENT_EMAIL + GOOGLE_PRIVATE_KEY')
  }
  
  // Handle different private key formats that might cause DECODER errors
  privateKey = privateKey
    .replace(/\\n/g, '\n')  // Convert literal \n to actual newlines
    .replace(/^"/, '')      // Remove leading quote
    .replace(/"$/, '')      // Remove trailing quote
    .trim()                 // Remove any extra whitespace
  
  // Ensure proper BEGIN/END format
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    throw new Error('Invalid private key format - must include BEGIN/END markers')
  }
  
  console.log('🔑 Private key format verified')
  
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
