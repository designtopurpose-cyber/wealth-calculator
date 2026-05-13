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

// Nurture timeline — earliest unsent step that is past its threshold gets sent.
// requiresLowOpens=true → only fired when subscriber opened ≤1 prior email
// (re-engagement path; needs Resend webhook to populate nurture_emails_sent.opened)
const STEPS = [
  { name: 'day_0',  daysOld: 0  },
  { name: 'day_3',  daysOld: 3  },
  { name: 'day_7',  daysOld: 7  },
  { name: 'day_14', daysOld: 14 },
  { name: 'day_21', daysOld: 21 },
  { name: 'day_30', daysOld: 30 },
  { name: 'day_60', daysOld: 60, requiresLowOpens: true },
  { name: 'day_90', daysOld: 90, requiresLowOpens: true },
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
<p style="color:#94a3b8;font-size:0.82rem;margin-top:24px;">P.S. Pro (R39/month) picks up where free leaves off — retirement-income drawdown planning, inflation-adjusted projections, tax analysis, and PDF exports. Free answers <em>"am I on track?"</em>. Pro answers <em>"what happens after?"</em>.</p>
`, email);
  return {
    subject: 'Welcome to MyWealthLens — your first scenario awaits',
    html,
    text: `Welcome to MyWealthLens — your first scenario awaits.\n\nA few ideas to try right now:\n- Goal Solver: pick a target and see what gets you there\n- Projection: project your current numbers forward\n- TFSA mode: model R46k annual / R500k lifetime caps\n\nOpen the calculator → ${config.baseUrl}/calculator\n\nP.S. Pro (R39/month) picks up where free leaves off — retirement-income drawdown planning, inflation-adjusted projections, tax analysis, and PDF exports. Free answers "am I on track?". Pro answers "what happens after?".\n\nReturns illustrative only — not financial advice.\nUnsubscribe: ${unsubscribeUrl(email)}`,
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

function buildDay14(email) {
  const html = wrapEmail(`
<h1 style="font-size:1.4rem;font-weight:700;margin:0 0 12px;color:#0f172a;">How taxes silently halve your retirement</h1>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;">SARS doesn't take its cut at retirement. It takes it the whole way along — and most calculators ignore it.</p>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;margin-top:14px;">A R10m portfolio at retirement, in a regular (non-TFSA) investment account:</p>
<ul style="color:#475569;line-height:1.7;font-size:0.95rem;padding-left:20px;">
  <li><strong>Capital gains tax</strong> on ~R8m in gains → ~R1.4m gone</li>
  <li><strong>Dividends withholding tax</strong> on R2m in dividends along the way → ~R400k gone</li>
  <li>Effective hit: ~R1.8m, almost 20% of the portfolio</li>
</ul>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;">The R10m number you saw on the projection? You actually have R8.2m to spend.</p>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;margin-top:14px;">Pro's <strong>Tax Analysis</strong> runs your scenario through SARS's CGT inclusion rates and dividends withholding so you see the after-tax number — the one that pays your retirement.</p>
${emailCTA('See your real tax impact →', config.baseUrl + '/account.html#pricing')}
`, email);
  return {
    subject: 'How taxes silently halve your retirement',
    html,
    text: `How taxes silently halve your retirement.\n\nSARS doesn't take its cut at retirement — it takes it along the way.\n\nA R10m portfolio in a regular account:\n- CGT on ~R8m gains: ~R1.4m gone\n- DWT on R2m dividends: ~R400k gone\n- Effective hit: ~R1.8m (~20% of portfolio)\n\nThat R10m projection? You actually have R8.2m to spend.\n\nPro's Tax Analysis shows your after-tax number. Upgrade: ${config.baseUrl}/account.html#pricing\n\nReturns illustrative only — not financial advice.\nUnsubscribe: ${unsubscribeUrl(email)}`,
  };
}

function buildDay21(email) {
  const html = wrapEmail(`
<h1 style="font-size:1.4rem;font-weight:700;margin:0 0 12px;color:#0f172a;">Here's what Pro users discover first</h1>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;">When MyWealthLens users upgrade to Pro and run their existing scenario through the deeper tools, three things consistently surprise them:</p>
<ol style="color:#475569;line-height:1.7;font-size:0.95rem;padding-left:24px;">
  <li><em>"I needed 30% more than I thought"</em> — once inflation is properly modeled into real purchasing power</li>
  <li><em>"My money runs out at 78, not 90"</em> — once realistic drawdown is modeled, not just accumulation</li>
  <li><em>"Taxes cost me 5–8 years of retirement"</em> — once CGT and dividends withholding are included</li>
</ol>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;margin-top:14px;">Three scenarios. Three numbers you don't see in the free view.</p>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;">The tools that surface them:</p>
<ul style="color:#475569;line-height:1.7;font-size:0.95rem;padding-left:20px;">
  <li><strong>Inflation-Adjusted Projections</strong> — for the real-rand picture</li>
  <li><strong>Forecast After Target</strong> — for the drawdown phase</li>
  <li><strong>Tax Analysis</strong> — for the SARS cost</li>
</ul>
${emailCTA('See your version →', config.baseUrl + '/account.html#pricing')}
`, email);
  return {
    subject: "Here's what Pro users discover first",
    html,
    text: `Here's what Pro users discover first.\n\nThree consistent surprises when free users upgrade:\n1. "I needed 30% more than I thought" — once inflation is modeled\n2. "Money runs out at 78, not 90" — once drawdown is modeled\n3. "Taxes cost me 5–8 years" — once CGT and dividends are included\n\nThe tools: Inflation-Adjusted Projections, Forecast After Target, Tax Analysis.\n\nSee your version: ${config.baseUrl}/account.html#pricing\n\nReturns illustrative only — not financial advice.\nUnsubscribe: ${unsubscribeUrl(email)}`,
  };
}

function buildDay30(email) {
  const promoUrl = config.baseUrl + '/?promo=FIRSTMONTH19#pricing';
  const html = wrapEmail(`
<h1 style="font-size:1.4rem;font-weight:700;margin:0 0 12px;color:#0f172a;">Your first month of Pro for R19</h1>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;">You've been on the list a month. Here's a final nudge: try Pro for half off the first month.</p>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;margin-top:14px;"><strong>R19</strong> (vs R39) gets you full Pro access for 30 days:</p>
<ul style="color:#475569;line-height:1.7;font-size:0.95rem;padding-left:20px;">
  <li>Forecast After Target</li>
  <li>Inflation-Adjusted Projections</li>
  <li>3-Scenario Comparison</li>
  <li>Tax Analysis</li>
  <li>PDF Export</li>
</ul>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;">Use code <strong>FIRSTMONTH19</strong> at checkout. Valid 7 days from this email.</p>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;">After 30 days your subscription continues at the normal amount (R39/month or R399/year). One-click cancel any time — no questions.</p>
${emailCTA('Try Pro for R19 →', promoUrl)}
`, email);
  return {
    subject: 'Your first month of Pro for R19',
    html,
    text: `Your first month of Pro for R19.\n\nHalf off the first month: R19 instead of R39 gets you 30 days of full Pro:\n- Forecast After Target\n- Inflation-Adjusted Projections\n- 3-Scenario Comparison\n- Tax Analysis\n- PDF Export\n\nCode: FIRSTMONTH19 — valid 7 days.\n\nAfter 30 days your subscription continues at the normal amount (R39/month or R399/year). One-click cancel any time.\n\nTry Pro for R19: ${promoUrl}\n\nReturns illustrative only — not financial advice.\nUnsubscribe: ${unsubscribeUrl(email)}`,
  };
}

function buildDay60(email) {
  const html = wrapEmail(`
<h1 style="font-size:1.4rem;font-weight:700;margin:0 0 12px;color:#0f172a;">Did you find what you were looking for?</h1>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;">We've sent a few emails over the past month. Looks like you might have already found what you needed — or moved on.</p>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;margin-top:14px;">No problem either way. Two quick options before we stop:</p>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;margin-top:14px;"><strong>Still curious?</strong> Email us at <a href="mailto:${config.supportEmail}" style="color:#f59e0b;">${config.supportEmail}</a> and tell us what's missing from the calculator, or what would have made you upgrade. Honest feedback genuinely shapes the product — we read every reply.</p>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;margin-top:14px;"><strong>One last useful number, then we'll stop:</strong> Most South Africans need roughly <strong>25–30× their annual expenses</strong> saved to retire comfortably (the global "4% rule" adjusted for local conditions). If your expenses are R500k/year, that's R12.5m–R15m.</p>
${emailCTA('Run yours through the Goal Solver →', config.baseUrl + '/calculator')}
<p style="color:#475569;line-height:1.7;font-size:0.95rem;">Whatever your answer, thanks for trying us out.</p>
`, email);
  return {
    subject: 'Did you find what you were looking for?',
    html,
    text: `Did you find what you were looking for?\n\nWe've sent a few emails. Looks like you might have moved on. Two quick options:\n\nStill curious? Email us at ${config.supportEmail} and tell us what's missing or what would have made you upgrade.\n\nOne last useful number: most South Africans need 25–30× annual expenses saved to retire comfortably. R500k expenses → R12.5m–R15m needed.\n\nRun yours through the Goal Solver: ${config.baseUrl}/calculator\n\nReturns illustrative only — not financial advice.\nUnsubscribe: ${unsubscribeUrl(email)}`,
  };
}

function buildDay90(email) {
  const html = wrapEmail(`
<h1 style="font-size:1.4rem;font-weight:700;margin:0 0 12px;color:#0f172a;">Last call — and a question</h1>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;">This is the last email you'll get from us unless you upgrade to Pro or email us.</p>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;margin-top:14px;">Honest question: was MyWealthLens not useful, or just not for you yet?</p>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;margin-top:14px;">If it's <strong>not for you yet</strong> — that's fine. The calculator stays free forever. Come back when retirement planning gets concrete.</p>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;margin-top:14px;">If it's <strong>not useful</strong>, email us at <a href="mailto:${config.supportEmail}" style="color:#f59e0b;">${config.supportEmail}</a> and tell us what was missing. Two sentences is enough; we read every reply.</p>
<p style="color:#475569;line-height:1.7;font-size:0.95rem;margin-top:14px;">One last reminder: Pro (R39/month) is the version that answers retirement-income drawdown, real-purchasing-power projections, and the SARS tax impact on your portfolio — the questions free leaves open.</p>
${emailCTA('Try Pro now →', config.baseUrl + '/account.html#pricing')}
<p style="color:#475569;line-height:1.7;font-size:0.95rem;">Whatever you decide, thanks for the time.</p>
`, email);
  return {
    subject: 'Last call — and a question',
    html,
    text: `Last call — and a question.\n\nThis is the last email you'll get from us unless you upgrade to Pro or email us.\n\nHonest question: was MyWealthLens not useful, or just not for you yet?\n\nIf it's not for you yet — that's fine. The calculator stays free forever.\n\nIf it's not useful, email us at ${config.supportEmail} and tell us what was missing. Two sentences is enough.\n\nOne last reminder: Pro (R39/month) answers drawdown, real-purchasing-power, and SARS tax impact — the questions free leaves open.\n\n${config.baseUrl}/account.html#pricing\n\nReturns illustrative only — not financial advice.\nUnsubscribe: ${unsubscribeUrl(email)}`,
  };
}

function buildEmail(stepName, email) {
  if (stepName === 'day_0')  return buildDay0(email);
  if (stepName === 'day_3')  return buildDay3(email);
  if (stepName === 'day_7')  return buildDay7(email);
  if (stepName === 'day_14') return buildDay14(email);
  if (stepName === 'day_21') return buildDay21(email);
  if (stepName === 'day_30') return buildDay30(email);
  if (stepName === 'day_60') return buildDay60(email);
  if (stepName === 'day_90') return buildDay90(email);
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

async function markSent(subscriberId, step, resendEmailId) {
  await fetch(`${SUPABASE_URL}/rest/v1/nurture_emails_sent`, {
    method:  'POST',
    headers: { ...sbHeaders(), 'Prefer': 'resolution=ignore-duplicates' },
    body:    JSON.stringify({
      subscriber_id:     subscriberId,
      email_step:        step,
      resend_email_id:   resendEmailId || null,
    }),
  });
}

async function getOpenedCount(subscriberId) {
  const url = `${SUPABASE_URL}/rest/v1/nurture_emails_sent`
    + `?subscriber_id=eq.${subscriberId}&opened=eq.true&select=id`;
  const r = await fetch(url, { headers: sbHeaders() });
  const arr = await r.json();
  return Array.isArray(arr) ? arr.length : 0;
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
      from:     config.emailFrom,
      to:       [toEmail],
      reply_to: config.supportEmail,
      subject:  payload.subject,
      html:     payload.html,
      text:     payload.text,
      headers:  { 'List-Unsubscribe': `<${unsubscribeUrl(toEmail)}>` },
    }),
  });
  if (!r.ok) {
    let body = '';
    try { body = await r.text(); } catch (e) {}
    return { ok: false, status: r.status, body: body.slice(0, 300) };
  }
  let data = {};
  try { data = await r.json(); } catch (e) {}
  return { ok: true, emailId: data.id || null };
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

  for (const sub of subscribers) {
    const days = ageInDays(sub.captured_at);
    const sentSteps = await getSentSteps(sub.id);

    let stepToSend = null;
    for (const step of STEPS) {
      if (sentSteps.has(step.name)) continue;
      if (days < step.daysOld) continue;
      // Cold-path re-engagement: Day 60/90 only fire if subscriber opened ≤1 prior email
      if (step.requiresLowOpens) {
        const opens = await getOpenedCount(sub.id);
        if (opens > 1) continue;
      }
      stepToSend = step;
      break;
    }
    if (!stepToSend) continue;

    try {
      if (await isProUser(sub.email)) { skipped++; continue; }
    } catch (err) {
      console.warn('isProUser check failed for', sub.email, err);
      // Fall through and send anyway — better than silently dropping nurture for all users on auth glitches
    }

    const payload = buildEmail(stepToSend.name, sub.email);
    if (!payload) continue;

    const result = await sendEmail(sub.email, payload);
    if (result.ok) {
      await markSent(sub.id, stepToSend.name, result.emailId);
      sent++;
    } else {
      console.warn('Resend send failed for', sub.email, 'step', stepToSend.name, 'status', result.status, result.body);
    }
  }

  return res.status(200).json({ sent, skipped, total: subscribers.length });
}

module.exports = handler;
