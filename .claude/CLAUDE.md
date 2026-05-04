
# Always follow these instructions when starting a new session with the user

## Branching

Always make code changes directly on the `main` branch. Do not use worktrees or feature branches unless the user explicitly asks for one.

## Architecture doc maintenance

Whenever a code change is confirmed working by the user, update `design-docs/architecture.md` to reflect the new state in the same turn. Do not pre-emptively update the doc before the user confirms — only after a successful test. If a change is rolled back or never confirmed, leave the doc alone.

## List of design docs you can reference when coding


### Architecture
Location: ./design-docs/architecture.md