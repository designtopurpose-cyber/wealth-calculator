// POST /api/webhook  — PayFast ITN handler
// PayFast sends application/x-www-form-urlencoded; we disable Vercel's body parser.

const crypto = require('crypto');

const SUPABASE_URL        = 'https://thvdbfkhedoirdliemsd.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PF_MERCHANT_ID      = process.env.PF_MERCHANT_ID  || '34599725';
const PF_PASSPHRASE       = process.env.PF_PASSPHRASE   || '';

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function sbGet(table, filter) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filter}&limit=1`;
  const r   = await fetch(url, { headers: sbHeaders() });
  const arr = await r.json();
  return arr[0] || null;
}

async function sbUpsert(table, data) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:  'POST',
    headers: { ...sbHeaders(), 'Prefer': 'resolution=merge-duplicates' },
    body:    JSON.stringify(data),
  });
}

async function sbPatch(table, filter, data) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method:  'PATCH',
    headers: sbHeaders(),
    body:    JSON.stringify(data),
  });
}

function sbHeaders() {
  return {
    'apikey':        SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type':  'application/json',
  };
}

// ── PayFast signature verification ───────────────────────────────────────────

function verifySignature(data, passphrase) {
  const str = Object.keys(data)
    .filter(k => k !== 'signature' && data[k] !== '' && data[k] != null)
    .sort()
    .map(k => `${k}=${encodeURIComponent(String(data[k])).replace(/%20/g, '+')}`)
    .join('&');
  const full = passphrase
    ? `${str}&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`
    : str;
  return crypto.createHash('md5').update(full).digest('hex') === data.signature;
}

async function validateWithPayFast(body) {
  const r = await fetch('https://www.payfast.co.za/eng/query/validate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await r.text();
  return text.trim() === 'VALID';
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function addYear(dateStr) {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function addMonth(dateStr) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Main handler ──────────────────────────────────────────────────────────────

async function handler(req, res) {
  const method = (req.method || '').toUpperCase();
  if (method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Read raw body for PayFast re-validation
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const rawBody = Buffer.concat(chunks).toString('utf8');
  const data    = Object.fromEntries(new URLSearchParams(rawBody));

  const { payment_status, token, custom_str1: userId, custom_str2: plan, amount_gross } = data;

  // 1. Verify signature
  if (!verifySignature(data, PF_PASSPHRASE || null)) {
    console.error('PayFast ITN: signature mismatch');
    return res.status(400).send('Invalid signature');
  }

  // 2. Verify merchant ID
  if (data.merchant_id !== PF_MERCHANT_ID) {
    console.error('PayFast ITN: merchant_id mismatch');
    return res.status(400).send('Merchant mismatch');
  }

  // 3. Back-post validation with PayFast
  const isValid = await validateWithPayFast(rawBody);
  if (!isValid) {
    console.error('PayFast ITN: back-post validation failed');
    return res.status(400).send('Validation failed');
  }

  // 4. Handle event
  if (payment_status === 'COMPLETE') {
    const today       = todayStr();
    const nextBilling = plan === 'annual' ? addYear(today) : addMonth(today);
    const accessUntil = plan === 'annual' ? addDays(addYear(today), 3)
                                          : addDays(addMonth(today), 3);

    // Check if subscription row already exists
    const existing = userId
      ? await sbGet('subscriptions', `user_id=eq.${userId}`)
      : null;

    try {
      if (existing) {
        await sbPatch('subscriptions', `user_id=eq.${userId}`, {
          status:                    'active',
          plan:                      plan || existing.plan,
          payfast_subscription_token: token || existing.payfast_subscription_token,
          next_billing_date:          nextBilling,
          access_until:              accessUntil,
        });
      } else if (userId) {
        await sbUpsert('subscriptions', {
          user_id:                   userId,
          plan:                      plan || 'monthly',
          status:                    'active',
          payfast_subscription_token: token,
          next_billing_date:          nextBilling,
          access_until:              accessUntil,
        });
      }
    } catch (err) {
      console.error('Supabase write failed (COMPLETE):', err);
    }

  } else if (payment_status === 'CANCELLED') {
    try {
      if (!userId) {
        const sub = token ? await sbGet('subscriptions', `payfast_subscription_token=eq.${token}`) : null;
        if (sub) {
          await sbPatch('subscriptions', `payfast_subscription_token=eq.${token}`, {
            status: 'cancelled',
          });
        }
      } else {
        const sub = await sbGet('subscriptions', `user_id=eq.${userId}`);
        if (sub) {
          await sbPatch('subscriptions', `user_id=eq.${userId}`, {
            status:       'cancelled',
            access_until: sub.next_billing_date || todayStr(),
          });
        }
      }
    } catch (err) {
      console.error('Supabase write failed (CANCELLED):', err);
    }
  }

  return res.status(200).send('OK');
}

handler.config = { api: { bodyParser: false } };
module.exports  = handler;
