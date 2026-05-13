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

### 3.1.1 Approved copy (all 8 emails)

Locked 2026-05-11. Day 0–7 already shipped in code (Phase 4); Day 14–30 + 60–90 ship in Phase 5.

---

**Day 0 — Welcome (shipped Phase 4)**
*Subject:* Welcome to MyWealthLens — your first scenario awaits

> Thanks for joining MyWealthLens. You've now got the South African wealth calculator built for the questions you actually have.
>
> A few ideas to try right now (free, no signup needed beyond what you've done):
> - **Goal Solver** — pick a target like R5m by 65, then see what monthly contribution or annual return gets you there.
> - **Projection** — enter your current numbers and project forward to retirement age.
> - **TFSA mode** — model your tax-free savings against the R46k annual and R500k lifetime caps.
>
> [Open the calculator →]
>
> P.S. Pro (R39/month) picks up where free leaves off — retirement-income drawdown planning, inflation-adjusted projections, tax analysis, and PDF exports. Free answers *"am I on track?"*. Pro answers *"what happens after?"*

---

**Day 3 — Real vs nominal returns (shipped Phase 4)**
*Subject:* 12% returns aren't 12% returns — here's why

> Most SA investors quote nominal returns. At 12% nominal and 6% inflation, your **real** return — what your purchasing power actually grows by — is closer to 5.7%, not 6%.
>
> It compounds. Over 30 years:
> - R3,000/month at **12% nominal** → R10.6m on paper
> - Same R3,000/month at **5.7% real** → R2.7m in today's rand
>
> Same investment. The first number is what your statement shows. The second is what you can actually buy with it.
>
> Pro's **Inflation-Adjusted Projections** show both side by side so you plan against real purchasing power, not paper numbers.
>
> [See real-return projections →]

---

**Day 7 — Plan for after (shipped Phase 4)**
*Subject:* You set your number. Now plan for after.

> Hitting your retirement number isn't the end of the planning — it's the start of the next 20–30 years of drawdown.
>
> The questions that actually matter at retirement:
> - How much can I withdraw each month without running out?
> - At what age does my plan break under different return scenarios?
> - How does inflation eat into my drawdown over 25 years?
>
> Pro's **Forecast After Target** models the full retirement income picture — drawdown rates, depletion ages, and how robust your plan is across different return assumptions.
>
> [Plan the drawdown →]

---

**Day 14 — Tax impact (Phase 5)**
*Subject:* How taxes silently halve your retirement

> SARS doesn't take its cut at retirement. It takes it the whole way along — and most calculators ignore it.
>
> A R10m portfolio at retirement, in a regular (non-TFSA) investment account:
> - **Capital gains tax** on ~R8m in gains → ~R1.4m gone
> - **Dividends withholding tax** on R2m in dividends along the way → ~R400k gone
> - Effective hit: ~R1.8m, almost 20% of the portfolio
>
> The R10m number you saw on the projection? You actually have R8.2m to spend.
>
> Pro's **Tax Analysis** runs your scenario through SARS's CGT inclusion rates and dividends withholding so you see the after-tax number — the one that pays your retirement.
>
> [See your real tax impact →]

---

**Day 21 — What Pro users discover (Phase 5)**
*Subject:* Here's what Pro users discover first

> When MyWealthLens users upgrade to Pro and run their existing scenario through the deeper tools, three things consistently surprise them:
>
> 1. *"I needed 30% more than I thought"* — once inflation is properly modeled into real purchasing power
> 2. *"My money runs out at 78, not 90"* — once realistic drawdown is modeled, not just accumulation
> 3. *"Taxes cost me 5-8 years of retirement"* — once CGT and dividends withholding are included
>
> Three scenarios. Three numbers you don't see in the free view.
>
> The tools that surface them:
> - **Inflation-Adjusted Projections** — for the real-rand picture
> - **Forecast After Target** — for the drawdown phase
> - **Tax Analysis** — for the SARS cost
>
> [See your version →]

---

**Day 30 — Discount offer (Phase 5; requires promo backend)**
*Subject:* Your first month of Pro for R19

> You've been on the list a month. Here's a final nudge: try Pro for half off the first month.
>
> **R19** (vs R39) gets you full Pro access for 30 days:
> - Forecast After Target
> - Inflation-Adjusted Projections
> - 3-Scenario Comparison
> - Tax Analysis
> - PDF Export
>
> Use code **FIRSTMONTH19** at checkout. Valid 7 days from this email.
>
> After 30 days your subscription continues at the normal amount (R39/month or R399/year). One-click cancel any time — no questions.
>
> [Try Pro for R19 →]

---

**Day 60 — Re-engagement (Phase 5; triggered only if opened ≤1 prior email)**
*Subject:* Did you find what you were looking for?

> We've sent a few emails over the past month. Looks like you might have already found what you needed — or moved on.
>
> No problem either way. Two quick options before we stop:
>
> **Still curious?** Hit reply and tell us what's missing from the calculator, or what would have made you upgrade. Honest feedback genuinely shapes the product — we read every reply.
>
> **One last useful number, then we'll stop:** Most South Africans need roughly **25–30× their annual expenses** saved to retire comfortably (the global "4% rule" adjusted for local conditions). If your expenses are R500k/year, that's R12.5m–R15m.
>
> [Run yours through the Goal Solver →]
>
> Whatever your answer, thanks for trying us out.

---

**Day 90 — Last call (Phase 5; final email)**
*Subject:* Last call — and a question

> This is the last email you'll get from us unless you upgrade to Pro or hit reply.
>
> Honest question: was MyWealthLens not useful, or just not for you yet?
>
> If it's not for you yet — that's fine. The calculator stays free forever. Come back when retirement planning gets concrete.
>
> If it's not useful, hit reply and tell us what was missing. Two sentences is enough; we read every reply.
>
> One last reminder: Pro (R39/month) is the version that answers retirement-income drawdown, real-purchasing-power projections, and the SARS tax impact on your portfolio — the questions free leaves open.
>
> Whatever you decide, thanks for the time.

---

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

- Sender identity: `MyWealthLens <noreply@mywealthlens.co.za>`
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
| 1 | Inline email-capture in `calculator.html` (HTML email via Resend; no PDF attachment) | 2–4 h | Highest leverage; everything compounds off this. **✅ Shipped + tested 2026-05-11** |
| 2 | Install Meta Pixel + Google Ads tag (Section 4.1) | 1 h | Pixel passively builds audiences while you build other things |
| 3 | In-product messaging triggers T1–T6 (Section 2.2) | 4–6 h | High leverage, all client-side. **✅ Shipped + tested 2026-05-11 (T1–T4 + T6 verified; T5 requires 10-min wait, accepted untested)** |
| 4 | Email nurture infrastructure (Section 3 — schema + cron + first 3 emails + unsubscribe endpoint) | 6–8 h | Schema + Vercel function + Resend templates. **✅ Shipped + tested 2026-05-11 (Day 0, 3, 7 all verified)** |
| 5 | Email nurture content (Day 14, 21, 30, 60, 90) + **promo code backend in `payfast-init.js`** (Day 30 needs `FIRSTMONTH19` to apply R19 first-month price) + **Resend `email.opened` webhook + handler** to flip `nurture_emails_sent.opened` (Day 60 / 90 only fire to subscribers who opened ≤1 prior email) | 8–12 h | Heavier than originally scoped — adds promo support and open-tracking infrastructure. Copy already approved + saved in §3.1.1. **✅ Shipped + tested 2026-05-13.** Day 14/21/30 content verified via live delivery; full promo flow (banner persistence → modal pricing → R19 payment → webhook → redemption recorded → single-use enforcement → graceful rejection at full price) all green end-to-end. Day 60/90 trigger gates depend on real-user open data — will validate organically post-launch. |
| 5.5 | **Organic content campaign via Blotato MCP** — start posting per the brand guide cadence (LinkedIn 3×/wk, X 1–2×/day, Threads 3–5×/wk, etc.) to drive traffic to mywealthlens.co.za | 2 h setup + ongoing daily generation | **Pre-requisite for Phase 6.** Pixel audiences only accumulate if there's actual traffic. Organic content does this for free while paid retargeting audiences mature. Without this, Phase 6 has no audiences to target. |
| 6 | Launch first paid retargeting campaign | 2 h | Once pixel has 14+ days of audience data **from the Blotato organic campaign** |

**Total:** ~17–24 hours of build + ~2 hours Blotato setup, plus R1,500/m initial ad spend.

**MVP (highest priority):** Phases 1 + 2. ~3–5 hours of work; captures emails AND starts retargeting audience-building immediately.

**Critical dependency for Phase 6:** Paid retargeting requires real visitors to populate retargeting audiences. Phase 5.5 (Blotato organic content campaign) is the upstream driver — without organic-content traffic, pixel data accumulates too slowly to make Phase 6 viable. Intended sequence: ship Phases 1–5 → start Phase 5.5 → let pixels accumulate for 14+ days → launch Phase 6.

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
