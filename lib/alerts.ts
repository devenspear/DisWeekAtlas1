const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY
const ALERT_EMAILS = (process.env.ALERT_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean)

export async function sendFailureAlert(subject: string, body: string) {
  if (!MAILERLITE_API_KEY || ALERT_EMAILS.length === 0) return
  // Simple transactional email via MailerLite API v2
  for (const email of ALERT_EMAILS) {
    try {
      await fetch('https://connect.mailerlite.com/api/subscribers/sending', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MAILERLITE_API_KEY}`
        },
        body: JSON.stringify({
          email,
          subject,
          content: body
        })
      })
    } catch (e) {
      console.error('MailerLite alert failed', e)
    }
  }
}
