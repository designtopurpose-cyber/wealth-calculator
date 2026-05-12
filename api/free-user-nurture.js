// GET /api/free-user-nurture  — daily cron at 06:00 UTC (08:00 SAST)
// Sends Day 0, 3, 7 nurture emails to marketing subscribers who haven't gone Pro.
// One email per subscriber per cron run; max one nurture sequence per user.

const crypto = require('crypto');
const config = require('../config/region');

const SUPABASE_URL         = 'https://thvdbfkhedoirdliemsd.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY       = process.env.RESEND_API_KEY || 're_7wiMBPfY_9Lxy2WKaMQZ2Fu7qG81m3vxr';
const CRON_SECRET          = process.env.CRON_SECRET;
const UNSUBSCRIBE_SECRET   = process.env.UNSUBSCRIBE_SECRET || 'mwl-unsub-default-change-me';

// Nurture timeline — earliest unsent step that is past its threshold gets sent
const STEPS = [
  { name: 'day_0', daysOld: 0 },
  { name: 'day_3', daysOld: 3 },
  { name: 'day_7', daysOld: 7 },
];

function sbHeaders() {
  return {
    'apikey':        SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type':  'application/json',
  };
}

function ageInDays(timestamp) {
  return Math.floor((Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60 * 24));
}

function unsubscribeToken(email) {
  return crypto.createHash('sha256').update(email.toLowerCase() + UNSUBSCRIBE_SECRET).digest('hex').slice(0, 24);
}

function unsubscribeUrl(email) {
  return `${config.baseUrl}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${unsubscribeToken(email)}`;
}

// ── Email templates ──────────────────────────────────────────────────────────

function emailFooter(email) {
  return `<p style="font-size:0.78rem;color:#94a3b8;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px;line-height:1.5;">
You're receiving this because you opted in to MyWealthLens insights on <a href="${config.baseUrl}" style="color:#94a3b8;">mywealthlens.co.za</a>. Returns illustrative only — not financial advice.<br><br>
<a href="${unsubscribeUrl(email)}" style="color:#94a3b8;">Unsubscribe</a> &nbsp;·&nbsp; <a href="${config.baseUrl}/privacy-policy" style="color:#94a3b8;">Privacy Policy</a></p>`;
}

function emailHeader() {
  return `<div style="margin-bottom:24px;"><span style="font-size:1.4rem;font-weight:800;color:#f59e0b;">📈 MyWealthLens</span></div>`;
}

function emailCTA(label, href) {
  return `<div style="margin:28px 0;"><a href="${href}" style="display:inline-block;background:#f59e0b;color:#0a0a0a;padding:11px 22px;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.92rem;">${label}</a></div>`;
}

function wrapEmail(bodyHtml, email) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8" /></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8fafc;margin:0;padding:24px;color:#1e293b;">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
${emailHeader()}
${bodyHtml}
${emailFooter(email)}
</div></body></html>`;
}

function buildDay0(email) {
  const html = wrapEmail(`
<h1 style="font-size:1.4rem;font-weight:700;margin:0 0 12px;color:#0f172a;">Welcome — your first scenario awaits</h1>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;">Thanks for joining MyWealthLens. You've now got the South African wealth calculator built for the questions you actually have.</p>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;margin-top:14px;">A few ideas to try right now (free, no signup needed beyond what you've done):</p>
<ul style="color:#475569;line-height:1.7;font-size:0.95rem;padding-left:20px;">
  <li><strong>Goal Solver</strong> — pick a target like R5m by 65, then see what monthly contribution or annual return gets you there.</li>
  <li><strong>Projection</strong> — enter your current numbers and project forward to retirement age.</li>
  <li><strong>TFSA mode</strong> — model your tax-free savings against the R46k annual and R500k lifetime caps.</li>
</ul>
${emailCTA('Open the calculator →', config.baseUrl + '/calculator')}
<p style="color:#94a3b8;font-size:0.82rem;margin-top:24px;">P.S. Pro (R39/month) adds retirement-income drawdown planning, inflation-adjusted projections, tax analysis, and PDF export. No pressure — the free tools cover most planning needs.</p>
`, email);
  return {
    subject: 'Welcome to MyWealthLens — your first scenario awaits',
    html,
    text: `Welcome to MyWealthLens — your first scenario awaits.\n\nA few ideas to try right now:\n- Goal Solver: pick a target and see what gets you there\n- Projection: project your current numbers forward\n- TFSA mode: model R46k annual / R500k lifetime caps\n\nOpen the calculator → ${config.baseUrl}/calculator\n\nReturns illustrative only — not financial advice.\nUnsubscribe: ${unsubscribeUrl(email)}`,
  };
}

function buildDay3(email) {
  const html = wrapEmail(`
<h1 style="font-size:1.4rem;font-weight:700;margin:0 0 12px;color:#0f172a;">12% returns aren't 12% returns</h1>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;">Most SA investors quote nominal returns. At 12% nominal and 6% inflation, your <strong>real</strong> return — what your purchasing power actually grows by — is closer to 5.7%, not 6%.</p>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;margin-top:14px;">It compounds. Over 30 years:</p>
<ul style="color:#475569;line-height:1.7;font-size:0.95rem;padding-left:20px;">
  <li>R3,000/month at <strong>12% nominal</strong> → R10.6m on paper</li>
  <li>Same R3,000/month at <strong>5.7% real</strong> → R2.7m in today's rand</li>
</ul>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;">Same investment. The first number is what your statement shows. The second is what you can actually buy with it.</p>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;margin-top:14px;">Pro's <strong>Inflation-Adjusted Projections</strong> show both side by side so you plan against real purchasing power, not paper numbers.</p>
${emailCTA('See real-return projections →', config.baseUrl + '/account.html#pricing')}
`, email);
  return {
    subject: '12% returns aren\'t 12% returns — here\'s why',
    html,
    text: `12% returns aren't 12% returns.\n\nAt 12% nominal and 6% inflation, your real return is ~5.7%.\n\nR3,000/month over 30 years:\n- At 12% nominal: R10.6m on paper\n- At 5.7% real: R2.7m in today's rand\n\nSame investment. Different reality.\n\nPro's Inflation-Adjusted Projections show both. Upgrade: ${config.baseUrl}/account.html#pricing\n\nReturns illustrative only — not financial advice.\nUnsubscribe: ${unsubscribeUrl(email)}`,
  };
}

function buildDay7(email) {
  const html = wrapEmail(`
<h1 style="font-size:1.4rem;font-weight:700;margin:0 0 12px;color:#0f172a;">You set your number. Now plan for after.</h1>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;">Hitting your retirement number isn't the end of the planning — it's the start of the next 20–30 years of drawdown.</p>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;margin-top:14px;">The questions that actually matter at retirement:</p>
<ul style="color:#475569;line-height:1.7;font-size:0.95rem;padding-left:20px;">
  <li>How much can I withdraw each month without running out?</li>
  <li>At what age does my plan break under different return scenarios?</li>
  <li>How does inflation eat into my drawdown over 25 years?</li>
</ul>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;">Pro's <strong>Forecast After Target</strong> models the full retirement income picture — drawdown rates, depletion ages, and how robust your plan is across different return assumptions.</p>
${emailCTA('Plan the drawdown →', config.baseUrl + '/account.html#pricing')}
`, email);
  return {
    subject: 'You set your number. Now plan for after.',
    html,
    text: `You set your number. Now plan for after.\n\nHitting your retirement number isn't the end — it's the start of 20–30 years of drawdown.\n\nQuestions that matter at retirement:\n- How much can I withdraw without running out?\n- At what age does my plan break?\n- How does inflation eat into drawdown?\n\nPro's Forecast After Target models all of it. Upgrade: ${config.baseUrl}/account.html#pricing\n\nReturns illustrative only — not financial advice.\nUnsubscribe: ${unsubscribeUrl(email)}`,
  };
}

function buildEmail(stepName, email) {
  if (stepName === 'day_0') return buildDay0(email);
  if (stepName === 'day_3') return buildDay3(email);
  if (stepName === 'day_7') return buildDay7(email);
  return null;
}

// ── Supabase queries ─────────────────────────────────────────────────────────

async function getEligibleSubscribers() {
  const url = `${SUPABASE_URL}/rest/v1/marketing_subscribers`
    + `?consent=eq.true`
    + `&unsubscribed_at=is.null`
    + `&region=eq.${config.region}`
    + `&select=id,email,captured_at`;
  const r = await fetch(url, { headers: sbHeaders() });
  return r.json();
}

async function getSentSteps(subscriberId) {
  const url = `${SUPABASE_URL}/rest/v1/nurture_emails_sent`
    + `?subscriber_id=eq.${subscriberId}&select=email_step`;
  const r = await fetch(url, { headers: sbHeaders() });
  const arr = await r.json();
  return new Set((arr || []).map(x => x.email_step));
}

async function markSent(subscriberId, step) {
  await fetch(`${SUPABASE_URL}/rest/v1/nurture_emails_sent`, {
    method:  'POST',
    headers: { ...sbHeaders(), 'Prefer': 'resolution=ignore-duplicates' },
    body:    JSON.stringify({ subscriber_id: subscriberId, email_step: step }),
  });
}

async function isProUser(email) {
  // Find auth user by email via admin API
  const ru = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?filter=email.eq.${encodeURIComponent(email.toLowerCase())}`,
    { headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'apikey': SUPABASE_SERVICE_KEY } }
  );
  if (!ru.ok) return false;
  const data = await ru.json();
  const users = data.users || (Array.isArray(data) ? data : []);
  if (!users.length) return false;
  const userId = users[0].id;

  // Check for active subscription
  const rs = await fetch(
    `${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&status=in.(active,cancelling)&select=id&limit=1`,
    { headers: sbHeaders() }
  );
  const subs = await rs.json();
  return Array.isArray(subs) && subs.length > 0;
}

// ── Send via Resend ──────────────────────────────────────────────────────────

async function sendEmail(toEmail, payload) {
  const r = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    config.emailFrom,
      to:      [toEmail],
      subject: payload.subject,
      html:    payload.html,
      text:    payload.text,
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl(toEmail)}>` },
    }),
  });
  if (!r.ok) {
    let body = '';
    try { body = await r.text(); } catch (e) {}
    return { ok: false, status: r.status, body: body.slice(0, 300) };
  }
  return { ok: true };
}

// ── Main handler ─────────────────────────────────────────────────────────────

async function handler(req, res) {
  if (CRON_SECRET) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorised' });
    }
  }

  const subscribers = await getEligibleSubscribers();
  if (!Array.isArray(subscribers) || subscribers.length === 0) {
    return res.status(200).json({ sent: 0, total: 0 });
  }

  let sent = 0;
  let skipped = 0;
  const debug = [];

  for (const sub of subscribers) {
    const days = ageInDays(sub.captured_at);
    const sentSteps = await getSentSteps(sub.id);
    const sentList = Array.from(sentSteps);

    let stepToSend = null;
    for (const step of STEPS) {
      if (sentSteps.has(step.name)) continue;
      if (days >= step.daysOld) { stepToSend = step; break; }
    }

    if (!stepToSend) {
      debug.push({ id: sub.id, email: sub.email, days, sentSteps: sentList, outcome: 'no_eligible_step' });
      continue;
    }

    let isPro = false;
    try { isPro = await isProUser(sub.email); }
    catch (err) {
      debug.push({ id: sub.id, email: sub.email, days, step: stepToSend.name, outcome: 'isProUser_error', error: String(err).slice(0, 200) });
    }
    if (isPro) {
      skipped++;
      debug.push({ id: sub.id, email: sub.email, days, step: stepToSend.name, outcome: 'skipped_pro' });
      continue;
    }

    const payload = buildEmail(stepToSend.name, sub.email);
    if (!payload) {
      debug.push({ id: sub.id, email: sub.email, days, step: stepToSend.name, outcome: 'payload_null' });
      continue;
    }

    const result = await sendEmail(sub.email, payload);
    if (result.ok) {
      await markSent(sub.id, stepToSend.name);
      sent++;
      debug.push({ id: sub.id, email: sub.email, days, step: stepToSend.name, outcome: 'sent' });
    } else {
      debug.push({ id: sub.id, email: sub.email, days, step: stepToSend.name, outcome: 'resend_failed', status: result.status, body: result.body });
    }
  }

  return res.status(200).json({ sent, skipped, total: subscribers.length, debug });
}

module.exports = handler;
