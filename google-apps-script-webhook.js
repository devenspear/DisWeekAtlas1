// Google Apps Script Code (paste this at script.google.com)
// This runs entirely on Google's servers - NO Google Cloud needed!

function doPost(e) {
  // Get your Google Doc ID
  const DOC_ID = 'your_google_doc_id_here';
  
  // Get document content
  const doc = DocumentApp.openById(DOC_ID);
  const content = doc.getBody().getText();
  
  // Send to your Vercel API
  const response = UrlFetchApp.fetch('https://your-app.vercel.app/api/jobs/ingest', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer your_webhook_secret'
    },
    payload: JSON.stringify({
      content: content,
      source: 'google-apps-script'
    })
  });
  
  return ContentService.createTextOutput('Success');
}

// Set up weekly trigger
function createWeeklyTrigger() {
  ScriptApp.newTrigger('doPost')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(9)
    .create();
}