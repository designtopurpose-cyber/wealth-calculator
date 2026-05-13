// GET /api/unsubscribe?email=...&token=...
// Marks the marketing_subscribers row as unsubscribed.
// Token is sha256(email_lowercased + UNSUBSCRIBE_SECRET) truncated to 24 chars.

const crypto = require('crypto');
const config = require('../config/region');

const SUPABASE_URL         = 'https://thvdbfkhedoirdliemsd.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const UNSUBSCRIBE_SECRET   = process.env.UNSUBSCRIBE_SECRET || 'mwl-unsub-default-change-me';

function expectedToken(email) {
  return crypto.createHash('sha256').update(email.toLowerCase() + UNSUBSCRIBE_SECRET).digest('hex').slice(0, 24);
}

function htmlPage(title, message, success) {
  return `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} — MyWealthLens</title>
<link rel="icon" href='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📈</text></svg>' />
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; background: #080b12; color: #f1f5f9; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
  .card { max-width: 480px; text-align: center; background: #111827; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 40px 32px; }
  .icon { font-size: 2.5rem; margin-bottom: 12px; }
  h1 { font-size: 1.4rem; margin: 0 0 12px; color: #ffffff; }
  p { color: #94a3b8; line-height: 1.6; margin: 0 0 24px; font-size: 0.95rem; }
  a.btn { display: inline-block; background: #f59e0b; color: #0a0a0a; padding: 10px 22px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 0.9rem; }
</style>
</head><body>
<div class="card">
  <div class="icon">${success ? '✓' : '⚠️'}</div>
  <h1>${title}</h1>
  <p>${message}</p>
  <a class="btn" href="${config.baseUrl}">Back to MyWealthLens</a>
</div>
</body></html>`;
}

async function handler(req, res) {
  const method = (req.method || '').toUpperCase();
  if (method !== 'GET' && method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  const { email, token } = req.query || {};
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!email || !token) {
    return res.status(400).send(htmlPage('Invalid link', 'This unsubscribe link is missing required information. Please use the link from the email you received, or email <a href="mailto:support@mywealthlens.co.za" style="color:#f59e0b;">support@mywealthlens.co.za</a> to be unsubscribed manually.', false));
  }

  if (token !== expectedToken(email)) {
    return res.status(403).send(htmlPage('Invalid link', 'This unsubscribe link is not valid. Please use the link from the most recent email you received, or email <a href="mailto:support@mywealthlens.co.za" style="color:#f59e0b;">support@mywealthlens.co.za</a> to be unsubscribed manually.', false));
  }

  // Mark as unsubscribed in Supabase
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/marketing_subscribers?email=eq.${encodeURIComponent(email.toLowerCase())}`,
      {
        method:  'PATCH',
        headers: {
          'apikey':        SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ unsubscribed_at: new Date().toISOString(), consent: false }),
      }
    );
    if (!r.ok) {
      console.error('Unsubscribe PATCH failed:', r.status);
    }
  } catch (err) {
    console.error('Unsubscribe error:', err);
  }

  return res.status(200).send(htmlPage(
    "You've been unsubscribed",
    "You won't receive any further MyWealthLens marketing emails. You can still use the calculator and any active Pro subscription is unaffected.",
    true
  ));
}

module.exports = handler;
