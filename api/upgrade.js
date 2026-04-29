// POST /api/upgrade
// Body: { access_token: string }
// Cancels the user's monthly PayFast subscription and returns PayFast params for annual sign-up.

const crypto = require('crypto');

const SUPABASE_URL         = 'https://thvdbfkhedoirdliemsd.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PF_MERCHANT_ID       = process.env.PF_MERCHANT_ID  || '34599725';
const PF_MERCHANT_KEY      = process.env.PF_MERCHANT_KEY || 'td3mihaxkox8x';
const PF_PASSPHRASE        = process.env.PF_PASSPHRASE   || '';
const BASE_URL             = 'https://mywealthlens.com';
const PF_URL               = 'https://www.payfast.co.za/eng/process';
const PF_API_BASE          = 'https://api.payfast.co.za';

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

// ── PayFast helpers ───────────────────────────────────────────────────────────

function pfApiSignature(timestamp) {
  const parts = [
    `merchant-id=${PF_MERCHANT_ID}`,
    PF_PASSPHRASE ? `passphrase=${encodeURIComponent(PF_PASSPHRASE).replace(/%20/g, '+')}` : null,
    `timestamp=${encodeURIComponent(timestamp).replace(/%20/g, '+')}`,
    'version=v1',
  ].filter(Boolean);
  return crypto.createHash('md5').update(parts.join('&')).digest('hex');
}

function pfFormSignature(data) {
  const str = Object.keys(data)
    .sort()
    .filter(k => data[k] !== '' && data[k] != null)
    .map(k => `${k}=${encodeURIComponent(String(data[k])).replace(/%20/g, '+')}`)
    .join('&');
  const full = PF_PASSPHRASE
    ? `${str}&passphrase=${encodeURIComponent(PF_PASSPHRASE).replace(/%20/g, '+')}`
    : str;
  return crypto.createHash('md5').update(full).digest('hex');
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
  if (sub.plan !== 'monthly' || sub.status !== 'active') {
    return res.status(400).json({ error: 'Upgrade is only available for active monthly subscribers' });
  }
  if (!sub.payfast_subscription_token) {
    return res.status(400).json({ error: 'No subscription token on record' });
  }

  // Cancel the existing monthly PayFast subscription
  const timestamp = new Date().toISOString().slice(0, 19);
  const apiSig    = pfApiSignature(timestamp);

  const pfCancelRes = await fetch(
    `${PF_API_BASE}/subscriptions/${sub.payfast_subscription_token}/cancel`,
    {
      method:  'PUT',
      headers: {
        'merchant-id': PF_MERCHANT_ID,
        'version':     'v1',
        'timestamp':   timestamp,
        'signature':   apiSig,
      },
    }
  );

  if (!pfCancelRes.ok) {
    const txt = await pfCancelRes.text();
    console.error('PayFast cancel failed during upgrade:', pfCancelRes.status, txt);
    return res.status(502).json({ error: 'Could not cancel monthly subscription. Please try again.' });
  }

  // Mark monthly as cancelling in Supabase
  await patchSubscription(user.id, { status: 'cancelling' });

  // Build PayFast annual subscription params
  const meta      = user.user_metadata || {};
  const fullName  = (meta.full_name || meta.name || '').trim();
  const parts     = fullName.split(' ');
  const nameFirst = parts[0] || 'Pro';
  const nameLast  = parts.slice(1).join(' ') || 'User';
  const today     = new Date().toISOString().slice(0, 10);

  const params = {
    merchant_id:       PF_MERCHANT_ID,
    merchant_key:      PF_MERCHANT_KEY,
    return_url:        `${BASE_URL}/account.html?upgraded=1`,
    cancel_url:        `${BASE_URL}/account.html`,
    notify_url:        `${BASE_URL}/api/webhook`,
    name_first:        nameFirst,
    name_last:         nameLast,
    email_address:     user.email,
    m_payment_id:      user.id,
    amount:            '399.00',
    item_name:         'MyWealthLens Pro Annual',
    subscription_type: '1',
    billing_date:      today,
    recurring_amount:  '399.00',
    frequency:         '6',
    cycles:            '0',
    custom_str1:       user.id,
    custom_str2:       'annual',
  };

  params.signature = pfFormSignature(params);

  return res.status(200).json({ pfUrl: PF_URL, params });
}

module.exports = handler;
