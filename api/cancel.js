// POST /api/cancel
// Body: { access_token: string }
// Cancels the user's PayFast subscription and marks Supabase status as 'cancelling'.

const crypto = require('crypto');

const SUPABASE_URL        = 'https://thvdbfkhedoirdliemsd.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PF_MERCHANT_ID      = process.env.PF_MERCHANT_ID  || '34599725';
const PF_PASSPHRASE       = process.env.PF_PASSPHRASE   || '';
const BASE_URL            = 'https://mywealthlens.com';
const PF_API_BASE         = 'https://api.payfast.co.za';

// ── Supabase helpers ──────────────────────────────────────────────────────────

function sbHeaders() {
  return {
    'apikey':        SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type':  'application/json',
  };
}

async function getUser(accessToken) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey':        SUPABASE_SERVICE_KEY,
    },
  });
  if (!r.ok) return null;
  return r.json();
}

async function getSubscription(userId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&limit=1`,
    { headers: sbHeaders() }
  );
  const arr = await r.json();
  return arr[0] || null;
}

async function patchSubscription(userId, data) {
  await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}`, {
    method:  'PATCH',
    headers: sbHeaders(),
    body:    JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
  });
}

// ── PayFast REST API signature ────────────────────────────────────────────────

function pfApiSignature(timestamp) {
  const parts = [
    `merchant-id=${PF_MERCHANT_ID}`,
    PF_PASSPHRASE ? `passphrase=${encodeURIComponent(PF_PASSPHRASE).replace(/%20/g, '+')}` : null,
    `timestamp=${encodeURIComponent(timestamp).replace(/%20/g, '+')}`,
    'version=v1',
  ].filter(Boolean);
  return crypto.createHash('md5').update(parts.join('&')).digest('hex');
}

// ── Main handler ──────────────────────────────────────────────────────────────

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', BASE_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { access_token } = req.body || {};
  if (!access_token) return res.status(401).json({ error: 'Missing access_token' });

  const user = await getUser(access_token);
  if (!user || !user.id) return res.status(401).json({ error: 'Unauthorised' });

  const sub = await getSubscription(user.id);
  if (!sub) return res.status(404).json({ error: 'No subscription found' });
  if (!['active', 'cancelling'].includes(sub.status)) {
    return res.status(400).json({ error: 'Subscription is not active' });
  }
  if (!sub.payfast_subscription_token) {
    return res.status(400).json({ error: 'No subscription token on record' });
  }

  // Call PayFast cancel API
  const timestamp = new Date().toISOString().slice(0, 19);
  const signature = pfApiSignature(timestamp);

  const pfRes = await fetch(
    `${PF_API_BASE}/subscriptions/${sub.payfast_subscription_token}/cancel`,
    {
      method:  'PUT',
      headers: {
        'merchant-id': PF_MERCHANT_ID,
        'version':     'v1',
        'timestamp':   timestamp,
        'signature':   signature,
      },
    }
  );

  if (!pfRes.ok && pfRes.status !== 200) {
    const txt = await pfRes.text();
    console.error('PayFast cancel failed:', pfRes.status, txt);
    return res.status(502).json({ error: 'PayFast cancel request failed' });
  }

  // Mark as cancelling — access continues until access_until date
  await patchSubscription(user.id, { status: 'cancelling' });

  return res.status(200).json({
    ok:           true,
    access_until: sub.access_until || sub.next_billing_date,
  });
}

module.exports = handler;
