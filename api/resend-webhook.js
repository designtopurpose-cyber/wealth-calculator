// POST /api/resend-webhook
// Receives Resend webhook events. Specifically handles email.opened to flip
// nurture_emails_sent.opened = true (used by Day 60/90 cold-path re-engagement logic).
//
// Optional signature verification via RESEND_WEBHOOK_SECRET (Svix-format signature in
// the svix-signature header). If the env var is unset, signature is not verified — set
// it to enforce.

const crypto = require('crypto');

const SUPABASE_URL          = 'https://thvdbfkhedoirdliemsd.supabase.co';
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET; // e.g. whsec_xxx

function sbHeaders() {
  return {
    'apikey':        SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type':  'application/json',
  };
}

// Svix signature verification: HMAC-SHA256(secretBytes, `${svix-id}.${svix-timestamp}.${body}`) → base64.
// Header `svix-signature` has the format: `v1,<sig> v1,<sig2> …` (space-separated rotation list).
function verifySvixSignature(rawBody, headers, secret) {
  if (!secret) return true; // not configured → skip
  const id = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const sigHeader = headers['svix-signature'];
  if (!id || !timestamp || !sigHeader) return false;

  // Reject events older than 5 minutes (replay protection)
  const ts = parseInt(timestamp, 10);
  if (!ts || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;

  let secretBytes;
  try { secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64'); }
  catch (e) { return false; }

  const signedPayload = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secretBytes).update(signedPayload).digest('base64');

  const provided = sigHeader.split(' ').map(p => p.replace(/^v1,/, ''));
  return provided.some(p => {
    try { return crypto.timingSafeEqual(Buffer.from(p), Buffer.from(expected)); }
    catch (e) { return false; }
  });
}

async function markOpened(resendEmailId) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/nurture_emails_sent?resend_email_id=eq.${encodeURIComponent(resendEmailId)}`,
    {
      method:  'PATCH',
      headers: sbHeaders(),
      body:    JSON.stringify({ opened: true }),
    }
  );
}

async function handler(req, res) {
  const method = (req.method || '').toUpperCase();
  if (method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Read raw body for signature verification
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const rawBody = Buffer.concat(chunks).toString('utf8');

  if (!verifySvixSignature(rawBody, req.headers, RESEND_WEBHOOK_SECRET)) {
    console.warn('Resend webhook: signature verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch (e) { return res.status(400).json({ error: 'Invalid JSON' }); }

  // We currently only care about email.opened. Other events (delivered, bounced, complained)
  // can be added later if needed.
  if (event.type === 'email.opened') {
    const emailId = event.data && event.data.email_id;
    if (emailId) {
      try { await markOpened(emailId); }
      catch (err) { console.error('markOpened failed:', err); }
    }
  }

  return res.status(200).json({ ok: true });
}

handler.config = { api: { bodyParser: false } };
module.exports  = handler;
