
# Always follow these instructions when starting a new session with the user

## Branching

Always make code changes directly on the `main` branch. Do not use worktrees or feature branches unless the user explicitly asks for one.

## Solution ordering

When offering troubleshooting solutions or hypotheses, list them from **most likely and simplest** to **least likely and most complex**. The user wants to try the cheap, common fixes first before being asked to do anything elaborate.

## Privacy Policy and Terms compliance

Whenever a change affects data collection, third-party services, user rights, marketing/tracking technologies, payment flows, or anything else that may affect the Privacy Policy or Terms of Use, update `privacy-policy.html` and `terms.html` accordingly in the same turn. Treat these legal documents like the architecture doc — they must reflect the true current state of the system before any user-facing launch. Bump the "Last updated" date on every change.

## Architecture doc maintenance

Whenever a code change is confirmed working by the user, update `design-docs/architecture.md` to reflect the new state in the same turn. Do not pre-emptively update the doc before the user confirms — only after a successful test. If a change is rolled back or never confirmed, leave the doc alone.

## List of design docs you can reference when coding


### Architecture
Location: ./design-docs/architecture.md