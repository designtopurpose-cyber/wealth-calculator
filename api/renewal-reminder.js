// GET /api/renewal-reminder  — called daily by Vercel Cron at 06:00 UTC (08:00 SAST)
// Finds annual subscribers whose next_billing_date is 21 days away and sends a reminder email.

const SUPABASE_URL        = 'https://thvdbfkhedoirdliemsd.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY      = process.env.RESEND_API_KEY || 're_7wiMBPfY_9Lxy2WKaMQZ2Fu7qG81m3vxr';
const CRON_SECRET         = process.env.CRON_SECRET;  // optional — set in Vercel to protect this endpoint

function sbHeaders() {
  return {
    'apikey':        SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type':  'application/json',
  };
}

function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function getEligibleSubscribers() {
  const targetDate = addDays(21);
  const url = `${SUPABASE_URL}/rest/v1/subscriptions`
    + `?plan=eq.annual`
    + `&status=eq.active`
    + `&next_billing_date=eq.${targetDate}`
    + `&reminder_sent_at=is.null`   // hasn't been sent yet
    + `&select=id,user_id,next_billing_date`;
  const r   = await fetch(url, { headers: sbHeaders() });
  return r.json();
}

async function getUserEmail(userId) {
  const r = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${userId}`,
    {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey':        SUPABASE_SERVICE_KEY,
      },
    }
  );
  if (!r.ok) return null;
  const u = await r.json();
  return u.email || null;
}

async function sendReminderEmail(email, renewalDate) {
  const formatted = formatDate(renewalDate);
  const r = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:    'MyWealthLens <noreply@mywealthlens.com>',
      to:      [email],
      subject: `Your MyWealthLens Pro annual subscription renews on ${formatted}`,
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#1e293b;">
          <div style="margin-bottom:24px;">
            <span style="font-size:1.5rem;font-weight:800;color:#f59e0b;">MyWealthLens</span>
          </div>
          <h2 style="font-size:1.2rem;font-weight:700;margin-bottom:16px;">Your annual subscription renews in 3 weeks</h2>
          <p style="color:#475569;line-height:1.7;">
            Your MyWealthLens Pro annual subscription will automatically renew on
            <strong>${formatted}</strong> for <strong>R399</strong>.
          </p>
          <p style="color:#475569;line-height:1.7;margin-top:12px;">
            If you'd like to cancel before that date, you can do so at any time from your account settings.
          </p>
          <div style="margin:28px 0;">
            <a href="https://mywealthlens.com/account.html"
               style="display:inline-block;background:#f59e0b;color:#0a0a0a;font-weight:700;
                      padding:12px 24px;border-radius:8px;text-decoration:none;">
              Manage My Account
            </a>
          </div>
          <p style="color:#475569;line-height:1.7;">
            If you do nothing, your subscription will renew and you'll continue to have uninterrupted
            access to all Pro tools.
          </p>
          <p style="color:#94a3b8;font-size:0.85rem;margin-top:32px;border-top:1px solid #e2e8f0;padding-top:20px;">
            Thank you for using MyWealthLens.<br>
            <a href="https://mywealthlens.com/account.html" style="color:#94a3b8;">Manage subscription</a>
            &nbsp;·&nbsp;
            <a href="https://mywealthlens.com/privacy-policy.html" style="color:#94a3b8;">Privacy Policy</a>
          </p>
        </div>
      `,
      text: `Your MyWealthLens Pro annual subscription renews on ${formatted} for R399.\n\nIf you'd like to cancel, visit: https://mywealthlens.com/account.html\n\nIf you do nothing, your subscription will renew automatically.\n\nThank you for using MyWealthLens.`,
    }),
  });
  return r.ok;
}

async function markReminderSent(subscriptionId) {
  await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${subscriptionId}`, {
    method:  'PATCH',
    headers: sbHeaders(),
    body:    JSON.stringify({
      reminder_sent_at: new Date().toISOString(),
      updated_at:       new Date().toISOString(),
    }),
  });
}

async function handler(req, res) {
  // Protect the endpoint with an optional secret (Vercel Cron passes it automatically via Authorization header)
  if (CRON_SECRET) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorised' });
    }
  }

  const subs = await getEligibleSubscribers();
  if (!Array.isArray(subs) || subs.length === 0) {
    return res.status(200).json({ sent: 0 });
  }

  let sent = 0;
  for (const sub of subs) {
    const email = await getUserEmail(sub.user_id);
    if (!email) continue;
    const ok = await sendReminderEmail(email, sub.next_billing_date);
    if (ok) {
      await markReminderSent(sub.id);
      sent++;
    }
  }

  return res.status(200).json({ sent, total: subs.length });
}

module.exports = handler;
