// POST /api/send-scenario-email
// Body: { email, scenario, marketingConsent }
// Sends a branded HTML email with the scenario contents via Resend.
// If marketingConsent is true, adds the email to the marketing_subscribers table.

const config = require('../config/region');

const SUPABASE_URL         = 'https://thvdbfkhedoirdliemsd.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY       = process.env.RESEND_API_KEY || 're_7wiMBPfY_9Lxy2WKaMQZ2Fu7qG81m3vxr';

function isValidEmail(email) {
  return typeof email === 'string'
    && email.length <= 320
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function safe(v) {
  if (v == null || v === '' || v === '—') return '—';
  return String(v);
}

function row(label, value) {
  return '<tr>'
    + `<td style="padding:8px 0;color:#64748b;font-size:0.92rem;">${label}</td>`
    + `<td style="padding:8px 0;text-align:right;font-weight:600;color:#1e293b;font-size:0.92rem;">${value}</td>`
    + '</tr>';
}

function buildEmailHtml(scenario) {
  const r = scenario.result || {};
  const modeLabel = scenario.mode === 'goal'
    ? 'Goal Solver'
    : scenario.mode === 'tfsa'
      ? 'TFSA'
      : 'Projection';

  const inputsRows = [
    row('Mode', modeLabel),
    row('Current age', scenario.currentAge ? scenario.currentAge + ' yrs' : '—'),
    row('Target age', scenario.targetAge ? scenario.targetAge + ' yrs' : '—'),
    row('Initial capital', safe(scenario.initialCapital)),
    row('Monthly contribution', safe(scenario.monthlyContrib)),
    row('Annual return', scenario.annualRate ? scenario.annualRate + '%' : '—'),
  ];
  if (scenario.mode === 'goal' && scenario.targetAmount) {
    inputsRows.push(row('Target amount', safe(scenario.targetAmount)));
  }

  const resultsRows = [
    row('Total contributions',  safe(r.contributions)),
    row('Interest earned',      safe(r.interest)),
    row('Final portfolio value', safe(r.finalValue)),
    row('Investment period',    safe(r.period)),
  ];

  return '<!DOCTYPE html><html><head><meta charset="UTF-8" /></head>'
    + '<body style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#f8fafc;margin:0;padding:24px;color:#1e293b;">'
    +   '<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">'
    +     '<div style="margin-bottom:24px;"><span style="font-size:1.4rem;font-weight:800;color:#f59e0b;">📈 MyWealthLens</span></div>'
    +     '<h1 style="font-size:1.4rem;font-weight:700;margin:0 0 8px;color:#0f172a;">Your scenario</h1>'
    +     '<p style="color:#64748b;margin:0 0 24px;font-size:0.95rem;">Here\'s the scenario you saved at mywealthlens.co.za. Drop back in any time to refine or compare.</p>'
    +     '<h2 style="font-size:1.05rem;font-weight:700;margin:24px 0 4px;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Inputs</h2>'
    +     '<table style="width:100%;border-collapse:collapse;">' + inputsRows.join('') + '</table>'
    +     '<h2 style="font-size:1.05rem;font-weight:700;margin:28px 0 4px;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:8px;">Result</h2>'
    +     '<table style="width:100%;border-collapse:collapse;">' + resultsRows.join('') + '</table>'
    +     '<div style="margin:32px 0 16px;padding:18px;background:#fef3c7;border-radius:8px;">'
    +       '<p style="margin:0 0 12px;color:#78350f;font-size:0.9rem;font-weight:600;">Want to plan retirement income, see inflation impact, or compare scenarios side-by-side?</p>'
    +       `<a href="${config.baseUrl}/account.html#pricing" style="display:inline-block;background:#f59e0b;color:#0a0a0a;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:700;font-size:0.9rem;">Unlock Pro for R39/month</a>`
    +     '</div>'
    +     '<p style="font-size:0.78rem;color:#94a3b8;margin-top:24px;border-top:1px solid #e2e8f0;padding-top:16px;line-height:1.5;">'
    +       `This is the scenario you saved at <a href="${config.baseUrl}" style="color:#94a3b8;">mywealthlens.co.za</a>. Returns are illustrative only and not financial advice.`
    +     '</p>'
    +   '</div>'
    + '</body></html>';
}

function buildEmailText(scenario) {
  const r = scenario.result || {};
  const lines = [
    'Your MyWealthLens scenario:',
    '',
    'Inputs:',
    '  Mode: ' + (scenario.mode || '—'),
    '  Current age: ' + (scenario.currentAge || '—'),
    '  Target age: ' + (scenario.targetAge || '—'),
    '  Initial capital: ' + (scenario.initialCapital || '—'),
    '  Monthly contribution: ' + (scenario.monthlyContrib || '—'),
    '  Annual return: ' + (scenario.annualRate || '—') + '%',
  ];
  if (scenario.mode === 'goal' && scenario.targetAmount) {
    lines.push('  Target amount: ' + scenario.targetAmount);
  }
  lines.push(
    '',
    'Result:',
    '  Total contributions: ' + (r.contributions || '—'),
    '  Interest earned: ' + (r.interest || '—'),
    '  Final portfolio value: ' + (r.finalValue || '—'),
    '  Investment period: ' + (r.period || '—'),
    '',
    'Refine or compare at ' + config.baseUrl + '/calculator',
    '',
    'Unlock Pro (Forecast After Target, Inflation-Adjusted Projections, Tax Analysis, PDF Export) for R39/month at ' + config.baseUrl + '/account.html#pricing',
    '',
    'Returns are illustrative only. Not financial advice.'
  );
  return lines.join('\n');
}

async function sendEmail(email, scenario) {
  const r = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    config.emailFrom,
      to:      [email],
      subject: 'Your MyWealthLens scenario',
      html:    buildEmailHtml(scenario),
      text:    buildEmailText(scenario),
    }),
  });
  return r.ok;
}

async function addToMarketingList(email) {
  await fetch(`${SUPABASE_URL}/rest/v1/marketing_subscribers`, {
    method:  'POST',
    headers: {
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type':  'application/json',
      'Prefer':        'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      email:    email.toLowerCase(),
      consent:  true,
      source:   'scenario_email',
      region:   config.region,
    }),
  });
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', config.baseUrl);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const method = (req.method || '').toUpperCase();
  if (method === 'OPTIONS') return res.status(200).end();
  if (method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, scenario, marketingConsent } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  if (!scenario || typeof scenario !== 'object') return res.status(400).json({ error: 'Missing scenario' });

  try {
    const ok = await sendEmail(email, scenario);
    if (!ok) return res.status(502).json({ error: 'Email send failed' });

    if (marketingConsent === true) {
      try { await addToMarketingList(email); }
      catch (err) { console.warn('addToMarketingList failed:', err); }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-scenario-email error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}

module.exports = handler;
