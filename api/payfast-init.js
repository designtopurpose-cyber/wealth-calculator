// POST /api/payfast-init
// Body: { plan: 'monthly' | 'annual', access_token: string }
// Returns: { pfUrl, params } — frontend submits these as a form to PayFast

const crypto = require('crypto');

const SUPABASE_URL        = 'https://thvdbfkhedoirdliemsd.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PF_MERCHANT_ID      = process.env.PF_MERCHANT_ID  || '34599725';
const PF_MERCHANT_KEY     = process.env.PF_MERCHANT_KEY || 'td3mihaxkox8x';
const PF_PASSPHRASE       = process.env.PF_PASSPHRASE   || '';   // set in Vercel if you add one in PayFast settings
const BASE_URL            = 'https://mywealthlens.com';
const PF_URL              = 'https://www.payfast.co.za/eng/process';

function pfSignature(data) {
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

async function getUser(accessToken) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'apikey': SUPABASE_SERVICE_KEY,
    },
  });
  if (!r.ok) return null;
  return r.json();
}

async function getSubscription(userId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&limit=1`,
    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );
  const arr = await r.json();
  return arr[0] || null;
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', BASE_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const method = (req.method || '').toUpperCase();
  if (method === 'OPTIONS') return res.status(200).end();
  if (method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { plan, access_token } = req.body || {};
  if (!['monthly', 'annual'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  if (!access_token) {
    return res.status(401).json({ error: 'Missing access_token' });
  }

  const user = await getUser(access_token);
  if (!user || !user.id) {
    return res.status(401).json({ error: 'Unauthorised' });
  }

  const existingSub = await getSubscription(user.id);
  if (existingSub && existingSub.status === 'active') {
    return res.status(400).json({ error: 'You already have an active subscription. Visit your account page to manage it.' });
  }

  const amount    = plan === 'annual' ? '399.00' : '39.00';
  const frequency = plan === 'annual' ? '6' : '3';
  const itemName  = plan === 'annual' ? 'MyWealthLens Pro Annual' : 'MyWealthLens Pro Monthly';
  const today     = new Date().toISOString().slice(0, 10);

  const meta      = user.user_metadata || {};
  const fullName  = (meta.full_name || meta.name || '').trim();
  const parts     = fullName.split(' ');
  const nameFirst = parts[0] || 'Pro';
  const nameLast  = parts.slice(1).join(' ') || 'User';

  const params = {
    merchant_id:       PF_MERCHANT_ID,
    merchant_key:      PF_MERCHANT_KEY,
    return_url:        `${BASE_URL}/account.html?welcome=1`,
    cancel_url:        `${BASE_URL}/#pricing`,
    notify_url:        `${BASE_URL}/api/webhook`,
    name_first:        nameFirst,
    name_last:         nameLast,
    email_address:     user.email,
    m_payment_id:      user.id,
    amount,
    item_name:         itemName,
    subscription_type: '1',
    billing_date:      today,
    recurring_amount:  amount,
    frequency,
    cycles:            '0',
    custom_str1:       user.id,
    custom_str2:       plan,
  };

  params.signature = pfSignature(params);

  return res.status(200).json({ pfUrl: PF_URL, params });
}

module.exports = handler;
