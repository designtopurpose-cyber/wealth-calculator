// POST /api/payfast-init
// Body: { plan: 'monthly' | 'annual', access_token: string, promo?: string }
// Returns: { pfUrl, params, promoApplied? } — frontend submits these as a form to PayFast
//
// Promo support: FIRSTMONTH19 (monthly plan only) sets amount=19, recurring_amount=39.
// Single-use per email via promo_redemptions table. Redemption is recorded in webhook.js
// after COMPLETE ITN, not here, so abandoned signups don't burn the promo.

const crypto = require('crypto');
const config = require('../config/region');

const SUPABASE_URL        = 'https://thvdbfkhedoirdliemsd.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PF_MERCHANT_ID      = process.env.PF_MERCHANT_ID  || '34599725';
const PF_MERCHANT_KEY     = process.env.PF_MERCHANT_KEY || 'td3mihaxkox8x';
const PF_PASSPHRASE       = process.env.PF_PASSPHRASE   || '';   // set in Vercel if you add one in PayFast settings
const BASE_URL            = config.baseUrl;
const PF_URL              = config.payfast.formUrl;

// PHP's urlencode (which PayFast uses) encodes a strict subset: only
// A-Z a-z 0-9 - _ . are left unescaped; everything else is %-encoded,
// and spaces become '+'. encodeURIComponent leaves !*'() unescaped,
// which breaks the signature when any field value contains those chars
// (e.g. "Pro Monthly (FIRSTMONTH19)" → PHP encodes parens, JS doesn't).
function phpUrlEncode(s) {
  return encodeURIComponent(String(s))
    .replace(/%20/g, '+')
    .replace(/!/g,   '%21')
    .replace(/'/g,   '%27')
    .replace(/\(/g,  '%28')
    .replace(/\)/g,  '%29')
    .replace(/\*/g,  '%2A')
    .replace(/~/g,   '%7E');
}

function pfSignature(data) {
  const str = Object.keys(data)
    .filter(k => data[k] !== '' && data[k] != null)
    .map(k => `${k}=${phpUrlEncode(data[k])}`)
    .join('&');
  const full = PF_PASSPHRASE
    ? `${str}&passphrase=${phpUrlEncode(PF_PASSPHRASE)}`
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

// Valid promo codes — extend as new promos ship. Each has {plan: 'monthly'|'annual'|null, firstAmount: string}.
const PROMOS = {
  FIRSTMONTH19: { plan: 'monthly', firstAmount: '19.00' },
};

async function hasRedeemedPromo(code, email) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/promo_redemptions?code=eq.${encodeURIComponent(code)}&email=eq.${encodeURIComponent(email.toLowerCase())}&select=id&limit=1`,
    { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );
  if (!r.ok) return false;
  const arr = await r.json();
  return Array.isArray(arr) && arr.length > 0;
}

async function validatePromo(code, plan, email) {
  if (!code) return null;
  const promo = PROMOS[code];
  if (!promo) return null;
  if (promo.plan && promo.plan !== plan) return null; // plan restriction
  if (await hasRedeemedPromo(code, email)) return null;
  return promo;
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', BASE_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const method = (req.method || '').toUpperCase();
  if (method === 'OPTIONS') return res.status(200).end();
  if (method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { plan, access_token, promo: promoCode } = req.body || {};
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

  const planCfg   = config.plans[plan];
  const fullPrice = planCfg.amount;
  const frequency = planCfg.frequency;

  // Promo validation. Silently ignored if invalid / ineligible / already redeemed.
  const promo = promoCode ? await validatePromo(promoCode, plan, user.email) : null;
  const promoApplied = promo ? promoCode : null;
  const firstAmount  = promo ? promo.firstAmount : fullPrice;
  const itemName     = promo ? `${planCfg.itemName} (${promoCode})` : planCfg.itemName;

  const meta      = user.user_metadata || {};
  const fullName  = (meta.full_name || meta.name || '').trim();
  const parts     = fullName.split(' ');
  const nameFirst = parts[0] || 'Pro';
  const nameLast  = parts.slice(1).join(' ') || 'User';

  // IMPORTANT: PayFast validates the signature against fields in the order they appear
  // in its documented attributes table — NOT alphabetical. Build params in that order:
  //   merchant_id, merchant_key, return_url, cancel_url, notify_url,
  //   name_first, name_last, email_address,
  //   m_payment_id, amount, item_name,
  //   custom_str1, custom_str2, custom_str3,
  //   subscription_type, recurring_amount, frequency, cycles
  // Inserting recurring_amount or custom_str3 out of order = 400 "signature does not match".
  const params = {
    merchant_id:       PF_MERCHANT_ID,
    merchant_key:      PF_MERCHANT_KEY,
    return_url:        `${BASE_URL}/account.html?welcome=1`,
    cancel_url:        `${BASE_URL}/#pricing`,
    notify_url:        `${BASE_URL}/api/webhook`,
    name_first:        nameFirst,
    name_last:         nameLast,
    email_address:     user.email,
    m_payment_id:      crypto.randomUUID(),
    amount:            firstAmount,
    item_name:         itemName,
    custom_str1:       user.id,
    custom_str2:       plan,
  };
  if (promo) params.custom_str3 = promoApplied;
  params.subscription_type = '1';
  if (promo) params.recurring_amount = fullPrice;
  params.frequency = frequency;
  params.cycles    = '0';

  params.signature = pfSignature(params);

  return res.status(200).json({ pfUrl: PF_URL, params, promoApplied });
}

module.exports = handler;
