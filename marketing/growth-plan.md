# MyWealthLens — Growth & Conversion Plan

> Strategic plan for in-product messaging, email nurture, and anonymous-visitor retargeting. Saved 2026-05-09 with all founder decisions locked in. Reference document — review before each implementation phase.

---

## Goal

Maximise total revenue. Three independent revenue levers:
1. Move more anonymous visitors → free signups (capture emails earlier)
2. Move more free signups → Pro subscribers (nurture + in-product messaging)
3. Reach lapsed/anonymous users with paid retargeting

The existing Pro tier (R39/m or R399/y) is unchanged. No free Pro trials, no stripping of free features. Premium tier idea saved as future expansion in `memory/premium_tier_future.md`.

---

## Section 1 — User states & reach matrix

| Population | Reachable via |
|---|---|
| Anonymous visitors (vast majority) | **Only retargeting** (Meta Pixel + Google Ads) |
| Anonymous calculator users | **Only retargeting** |
| Email-captured (gave email for PDF, no Pro) | **Email nurture + in-product messaging + retargeting** |
| Free signups, no Pro | Same as above |
| Pro subscribers | Excluded from nurture + retargeting |

**Critical insight:** the calculator does not require signup today (verified via `calculator.html:2438`). Most free users will never give you their email under the existing flow. The single highest-leverage change is adding an early email-capture moment in the calculator itself.

---

## Section 2 — In-product messaging plan

Subtle, contextual upgrade prompts inside `calculator.html`. Not modal blasts — inline banners with one-line copy. Direct tone (matches brand guide).

### 2.1 Email-capture inline (highest priority)

After a calculation result settles in any free mode (Goal Solver, Projection, TFSA), show an inline panel below the result:

```
┌──────────────────────────────────────────────┐
│ 📧 Email this scenario as a PDF             │
│                                              │
│ [your-email@example.com] [Send →]            │
│                                              │
│ ☐ Also send occasional MyWealthLens insights │
│   (unsubscribe any time)                     │
│                                              │
│ By submitting, you agree to our              │
│ Privacy Policy.                              │
└──────────────────────────────────────────────┘
```

**Send button states:**
- Default: `Send →`
- Pending: `Sending…` (disabled)
- Success: `✓ Sent — check your inbox` (green)
- Error: `✗ Send failed — try again` (red)

**Logic:**
- Email-only submission → transactional PDF email (no opt-in needed for transactional comms under POPIA)
- If "Also send occasional…" is ticked → user added to nurture list (`marketing_consent = true`)
- Without opt-in tick: user gets the PDF only, never enters the nurture sequence

**POPIA opt-in copy (final):**
> "Also send occasional MyWealthLens insights (unsubscribe any time)" — unchecked by default

### 2.2 Contextual upgrade prompts (T1–T6)

| # | Trigger condition | Message | Routes to |
|---|---|---|---|
| **T1** | Goal Solver result settles | "You found your number — at today's rand. Inflation eats into it. See real-purchasing-power projections →" | Pro Inflation tab |
| **T2** | Target age 60+ AND result computed | "You've planned to your target age. Most retirements last 20–30 more years. Plan that drawdown →" | Pro Forecast After Target |
| **T3** | TFSA mode hits R36k annual or R500k lifetime cap | "You're maxing TFSA. Beyond the cap, tax matters more. See post-tax compounding →" | Pro Tax Analysis |
| **T4** | User toggles between modes 3+ times in session | "Comparing scenarios? Pro lays them out side-by-side →" | Pro 3-Scenario Compare |
| **T5** | User on page 10+ minutes (engagement signal) | "This is real planning. Save it as a PDF you can share →" | Pro Export to PDF |
| **T6** | Monthly contribution ≥ R10,000 | "At this savings level, CGT and dividends compound up. See the tax impact →" | Pro Tax Analysis |

**(T7 — free Pro trial — REMOVED per founder decision)**

### 2.3 Visual + UX rules

- Inline banner style: amber border-left, ~1 line of copy, link styled as button
- Dismissible per-trigger per-session via `localStorage`
- Limit to **one active prompt at a time** (highest priority wins)
- Email-capture (2.1) is always shown after first calculation; T1–T6 are secondary

---

## Section 3 — Email nurture plan

Audience: anyone whose email is in our system (signup OR ticked the marketing-opt-in checkbox during PDF capture) AND who isn't an active Pro subscriber.

### 3.1 Nurture timeline

6 emails over 30 days, plus re-engagement at 60 and 90.

| Day | Subject (draft) | Theme | CTA |
|---|---|---|---|
| **0** | Welcome — your first scenario in 5 minutes | Warm intro, link to calculator, what to try first | Open calculator |
| **3** | "12% returns aren't 12% returns" | Real vs nominal returns; positions Pro Inflation | Try inflation projection → upgrade |
| **7** | "You set your number. Now plan for after." | Position Pro Forecast After Target | Upgrade |
| **14** | *(Day 14 trial-offer email replaced — no free Pro trials)* — "How taxes silently halve your retirement" | Educational hook on CGT + dividends; positions Pro Tax Analysis | Upgrade |
| **21** | "Here's what Pro users discover first" | Social proof + scenario walkthrough | Upgrade |
| **30** | "Your first month of Pro for R19" | **First-month-only 50% discount, R19 instead of R39, valid 7 days** | Upgrade with promo code `FIRSTMONTH19` |

**Re-engagement (cold path, only if user opened ≤1 of prior emails):**

| Day | Subject | Theme |
|---|---|---|
| **60** | "Did you find what you were looking for?" | Acknowledge silence; ask for feedback (1-line reply); last value-add insight |
| **90** | "Last call — and a question" | One last value pitch + clean unsubscribe link |

### 3.2 Trigger logic

Daily Vercel cron (existing 06:00 UTC). New endpoint `api/free-user-nurture.js`:

```
For each user in the marketing list (consent = true):
  WHERE not on Pro
  AND not unsubscribed
  AND age (days since signup or PDF-capture) hits 0/3/7/14/21/30/60/90
  AND email at that step not yet sent
  AND (for 60/90 only) opened ≤1 prior email:
    Send email via Resend
    Mark sent in nurture_emails_sent
```

### 3.3 Schema additions

Two new tables (cleaner than columns on `subscriptions`):

**`marketing_subscribers`** — captures email + consent state for users who may not have a subscription row
```
id           uuid PRIMARY KEY
email        text NOT NULL UNIQUE
user_id      uuid NULL  -- linked if they later sign up for full account
captured_at  timestamptz NOT NULL DEFAULT now()
consent      boolean NOT NULL DEFAULT false  -- ticked the marketing checkbox
unsubscribed_at  timestamptz NULL
source       text NOT NULL  -- 'pdf_capture' | 'pro_signup' | etc.
```

**`nurture_emails_sent`** — tracks which emails sent to whom
```
id              uuid PRIMARY KEY
subscriber_id   uuid REFERENCES marketing_subscribers(id)
email_step      text NOT NULL  -- 'day_0' | 'day_3' | 'day_7' | etc.
sent_at         timestamptz NOT NULL DEFAULT now()
opened          boolean NOT NULL DEFAULT false  -- updated via Resend webhook
```

### 3.4 Compliance (every email)

- Sender identity: `MyWealthLens <noreply@mywealthlens.com>`
- Physical address in footer (POPIA + GDPR)
- One-click unsubscribe link (Resend native)
- "You're receiving this because…" line
- "Not financial advice" disclaimer
- Maximum 1 nurture email per week per recipient

---

## Section 4 — Anonymous-visitor retargeting plan

For everyone who never gave you their email — the bulk of visitors.

### 4.1 Tools & install

All free to install; spend goes on ads only.

| Tool | Purpose |
|---|---|
| Meta Pixel | Retarget on Facebook + Instagram |
| Google Ads tag (gtag) | Retarget on Google Search + Display + YouTube |
| Cloudflare Web Analytics (free) | Independent site-wide traffic analytics (privacy-friendly) |

Optional later: TikTok Pixel if video content materialises.

### 4.2 Audience definitions

Defined once pixel has fired for ~7+ days. Saved inside Meta / Google as Custom Audiences.

| Audience | Definition |
|---|---|
| All visitors | Loaded any page, last 30/90/180 days |
| Engaged visitors | >2 pageviews or >30s on page |
| Calculator users | Visited `/calculator` (any depth) |
| Calculator engaged | Visited `/calculator` AND stayed >2 min |
| Pricing-page visitors | Visited `/#pricing` or `/account.html?welcome=1` |
| Started signup, didn't complete | Signup modal triggered, no Pro subscription created |
| **Pro subscribers (EXCLUDE)** | Active subscription → never retarget |

### 4.3 Campaign types

| Stage | Audience | Message angle |
|---|---|---|
| Awareness (cold prospecting) | All SA users matching interests | Educational hook from brand guide |
| Consideration | Engaged visitors who haven't converted | Calculator demo + screenshot |
| Direct response | Calculator users + pricing-page visitors | "Try Pro for R39 — cancel anytime" |
| Cart abandonment | Started signup, didn't complete | Friction-reducer / clarity |

### 4.4 Budget

- **Phase 1 (testing, month 1):** R30–50/day across Meta + Google. **R1,500/m total** (founder-confirmed).
- **Phase 2 (scale winners, month 2+):** shift toward winning audiences/creative
- **CPA ceiling:** never spend more per Pro conversion than first-year LTV (R468). Initial target CPA ≤ R200.

---

## Section 5 — Implementation sequencing

| Phase | What | Effort | Why this order |
|---|---|---|---|
| 1 | Inline email-capture in `calculator.html` (incl. PDF generation + Resend send) | 2–4 h | Highest leverage; everything compounds off this |
| 2 | Install Meta Pixel + Google Ads tag (Section 4.1) | 1 h | Pixel passively builds audiences while you build other things |
| 3 | In-product messaging triggers T1–T6 (Section 2.2) | 4–6 h | High leverage, all client-side |
| 4 | Email nurture infrastructure (Section 3 — schema + cron + first 3 emails) | 6–8 h | Schema + Vercel function + Resend templates |
| 5 | Email nurture content (emails 4–8) | 2–3 h | Lighter — just templates once infrastructure exists |
| 6 | Launch first paid retargeting campaign | 2 h | Once pixel has 14+ days of audience data |

**Total:** ~17–24 hours of build, plus R1,500/m initial ad spend.

**MVP (highest priority):** Phases 1 + 2. ~3–5 hours of work; captures emails AND starts retargeting audience-building immediately.

---

## Section 6 — Measurement & analytics

### 6.1 Tools and what each measures

| Tool | What it tracks | Limitations |
|---|---|---|
| **Meta Ads Manager** | Pageviews + custom events from anyone with the Meta Pixel loaded; ad campaign performance, audience growth | Optimised for ad attribution, not site analytics. Won't show anything from users blocking Meta scripts |
| **Google Ads** | Pageviews + custom events from anyone with gtag loaded; ad campaign performance | Same limitations as Meta |
| **Cloudflare Web Analytics** (recommended) | All site traffic — pageviews, unique visitors, top pages, referrers, country, browser. Privacy-friendly, no cookies, free with Cloudflare. Independent of ad pixels | Lighter feature set than GA4; no event tracking out of the box |
| **Vercel Analytics** | Limited free tier; pageviews, top pages | Free tier capped at low pageview counts |

**Recommendation:** Cloudflare Web Analytics for site-wide measurement (you already have Cloudflare), plus Meta Pixel + Google Ads tag for ad-attribution. Skip Google Analytics 4 — its cookie consent overhead creates POPIA friction for a small benefit.

### 6.2 Key metrics by funnel stage

**Top of funnel (awareness)**
- Sessions / unique visitors (Cloudflare)
- Cost per click (Meta + Google)
- Click-through rate — relevance signal (Meta + Google)

**Mid funnel (consideration)**
- Calculator engagement: `/calculator` pageviews / sessions on it
- Email captures (count of new `marketing_subscribers` rows per day)
- Cost per email capture: ad spend ÷ new captures

**Bottom of funnel (conversion)**
- Free signups → Pro conversion rate (% of `marketing_subscribers` who become active subscriptions)
- Cost per Pro conversion: ad spend ÷ Pro signups attributed
- 30-day Return on Ad Spend (ROAS): Pro revenue ÷ spend

**Retention**
- Pro retention at 30/60/90 days
- Cancellation rate
- Renewal-reminder open rate (already trackable via Resend)

### 6.3 Fine-tuning framework

Weekly review cycle, simplest-first:

1. **Kill clear losers.** Anything spending >R200 with no clicks → off. Anything CPA > 2× target → off
2. **Identify winners.** Top 1–2 audience × creative combos by CPA
3. **Double down on winners.** Increase budget by 50% per week on consistent performers
4. **Test variations.** Per top performer, A/B test ONE element at a time: copy, image, audience expansion, placement
5. **After 50+ conversions** on a campaign, switch to **Target CPA bidding** in Meta/Google so the platform optimises for you

Don't optimise too fast — give each ad 7+ days and 1,000+ impressions before judging.

### 6.4 Custom events worth tracking (later)

Once pixels are firing, define custom events on key actions:

| Event | Trigger | Why |
|---|---|---|
| `EmailCaptured` | User submits PDF email form | Tracks mid-funnel conversion |
| `MarketingOptIn` | Ticks the "send insights" checkbox | Nurture audience growth signal |
| `ProClicked` | User clicks any Pro feature button | Pro intent signal |
| `Subscribed` | Successful PayFast COMPLETE webhook → frontend redirect | Conversion event for ad optimisation |

These map to Meta `Lead`, `InitiateCheckout`, and `Subscribe` standard events for better automatic optimisation.

---

## Open items / not-yet-decided

- Welcome email design + copy (Section 3.1 Day 0) — to draft when Phase 4 ships
- ✅ POPIA Privacy Policy update — shipped 2026-05-11; privacy-policy.html discloses Meta Pixel, Google Ads, Cloudflare Web Analytics, and explains opt-out
- ✅ Cookie consent banner — shipped 2026-05-11; `consent.js` shows banner on first visit, loads pixels only after Accept, withdrawable via privacy-policy.html link

---

## Status

Plan finalised 2026-05-09. Approved by founder. No code changes yet — proceed phase by phase on explicit request.
