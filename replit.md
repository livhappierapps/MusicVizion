# MusicVizion

Music sharing, appreciation, and live analysis with your AI companion. The current MVP is local-first; paid Grok is deliberately disabled.

## Run & Operate

- Use the managed MusicVizion and API Server workflows for previews; their ports and paths are injected.
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `node --experimental-strip-types --test artifacts/api-server/src/lib/spending-consent.test.ts artifacts/musicvizion/src/lib/local-first.test.ts` — local tests, no paid API
- No database or new secret is required by the local-first MusicVizion features.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Frontend: `artifacts/musicvizion/src/App.tsx`; new cost/profile components are in `src/components/musicvizion/`.
- API contract: `lib/api-spec/openapi.yaml`; server routes: `artifacts/api-server/src/routes/musicvizion.ts`.
- Styles: `src/index.css`, `src/local-first.css`, and `src/components/musicvizion/cost-panels.css`.
- Cost/release rationale: `docs/musicvizion-costs.md`.

## Architecture decisions

- Paid inference transport is disconnected, not merely hidden in the UI. No owner spending authorization or verified price ceiling exists; never enable inference just because a connector is installed.
- Request approval alone cannot prevent strangers from spending an app owner's money. Any future paid release must also authorize the payer, enforce owner budgets, verify a maximum provider charge, and prevent retry/replay.
- Local files remain object URLs in the browser, never uploads. Public embeds cannot be analyzed through Web Audio; do not scrape their audio.
- Device-local profiles are not accounts or independent sentient entities. Do not imply cloud backup or cross-device synchronization.

## Product

Local/direct-audio playback and rough live feature meters; official YouTube player and pause-to-discuss; Suno original-page fallback; a fixed free listening guide; separate editable companion notes; neon and pewter-metal themes; historical listening prompts, unavailable popularity status, and cost/release information.

## User preferences

The binding project cost-authorization instruction is preserved in `.agents/memory/cost-policy.md`.

## Gotchas

- Model catalog checks through the connected xAI proxy returned HTTP 400 `invalid-argument` for both `/v1/models` and `/v1/language-models`. No inference was used to investigate; access remains unresolved.
- SDK transport may automatically retry 401 responses. A future billable transport must not blindly retry inference.
- Clearing browser storage loses local profiles. Conversations are in-tab only; audio selections are not restored after reload.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
