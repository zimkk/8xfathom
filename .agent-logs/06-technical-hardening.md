# Agent Log — Phase 6: Technical Hardening (Pre-Client Audit Fixes)

**Date:** 2026-09-12
**Agent:** Claude Opus 4.8
**Phase:** 6 — Core pipeline correctness pass before client handoff

## Summary
Full technical audit of the working pipeline (Google connect, Recall bot injection, recording,
transcription, AI summarization, cron/webhook plumbing), written to `AUDIT.md`, followed by
implementation of every Critical/High/Medium finding plus targeted cleanup. Verified the Recall
API assumptions against the live Recall.ai docs. `apps/web` type-checks clean after all changes.

## Critical fixes
- **C1 — Recall bot config used non-existent API fields.** Replaced top-level
  `real_time_transcription` + `webhook_url` (silently ignored by the current Recall API) with
  `recording_config.realtime_endpoints: [{ type: 'webhook', url, events: ['transcript.data'] }]`.
  Without this, real-time transcript webhooks never fired. `packages/integrations/src/recall/index.ts`
  > Operational requirement: the Recall **dashboard** webhook must also point at
  > `${APP_URL}/api/webhooks/recall` for bot **status** events (account-level Svix delivery).
- **C2 — no reliable summary trigger.** Ingest now triggers on `bot.done` as well as
  `transcript.done` (the latter isn't guaranteed for the captions provider). `runRecordingIngest`
  is now idempotent via an atomic status claim, and `reconcile-captures` calls it to finalize any
  meeting Recall reports `done` but that never finalized locally — plus marks failed/denied bots.
  `apps/web/app/api/webhooks/recall/route.ts`, `recording-ingest-service.ts`, `cron/reconcile-captures/route.ts`
- **C3 — capture depended on a once-daily cron.** Bots are now scheduled at calendar-sync time
  (Recall accepts future `join_at`); the daily cron remains a backstop. `calendar-sync-service.ts`
- **C4 — calendar sync cancelled real meetings past the first 25.** `listUpcomingEvents` now
  paginates the full window via `nextPageToken` with a `timeMax`; cancellation is scoped to events
  within the fetched window only. `packages/integrations/src/google/index.ts`, `calendar-sync-service.ts`
- **C5 — webhook `waitUntil` work killed early.** Added `export const maxDuration = 60`.
  `apps/web/app/api/webhooks/recall/route.ts`

## High fixes
- **H1 — transcript segment duplication (sequence race).** Real-time inserts now derive
  `sequence` from `startMs` (race-free) and all readers order by `startMs`. Duplicate deliveries
  are stopped by the new idempotency guard. `webhooks/recall/route.ts`, `meeting-service.ts`, `summary-generate-service.ts`
- **H2 — Google refresh-token trap.** Removed `calendar.readonly` from the **login** scope so the
  dedicated `/api/calendar/connect` flow is the sole owner of the calendar refresh token.
  `apps/web/lib/auth/config.ts`
- **H3 — AI extraction had no JSON mode.** `chat()` now sends `response_format: json_object`, with
  a fence-stripping tolerant parser and 429/5xx retry with backoff. `packages/integrations/src/ai/index.ts`
- **H4 — long meetings exceeded the time budget.** AI chunk calls now run with bounded
  concurrency (4) instead of fully sequential. `packages/integrations/src/ai/index.ts`
- **H5 — "Ask" only saw the first 100 segments.** Added lexical keyword ranking to select the most
  relevant segments across the whole transcript. `apps/web/app/api/meetings/[meetingId]/ask/route.ts`

## Medium fixes
- **M1** — added `openid email` to the calendar connect scope so the userinfo/email lookup works.
- **M2** — `stopCapture` now targets the newest capture session, not the oldest.
- **M3** — webhook idempotency via `webhook_events` (unique Svix message id); duplicates short-circuit.
- **M4** — dedup guard added to both `scheduleCapture` and `startCaptureNow`.
- **M5** — webhook rejects deliveries whose signed timestamp is older than 5 minutes (replay guard).
- **M6** — `updateActionItemStatus` service helper now scopes updates to meetings owned by the user.

## Low / cleanup
- **L1** — `@fathom/jobs` fixed to compile against current core types (it was dead, non-compiling
  code); documented as deprecated/not-wired. `packages/jobs/src/tasks/meeting-process.ts`
- **L2** — Recall `getTranscript` now logs non-OK responses instead of silently returning empty.
- **L4** — README corrected (`/api/calendar/connect` is GET; scheduling + webhook wiring notes).
- **L5** — OpenAI retry/backoff (folded into H3).
- **L6** — Disconnect/Sync buttons now redirect back to settings (303) instead of dumping raw JSON;
  added synced/disconnected/sync_failed banners. `calendar/disconnect`, `calendar/sync`, `settings/calendar/page.tsx`

## Verification
- `apps/web` `tsc --noEmit` → clean (exit 0).
- Full `pnpm typecheck`/`pnpm test` could not run in this environment: the local `pnpm@12.4.1`
  shim and workspace symlinks are broken on this machine (not a code issue). CI must run a clean
  `pnpm install` before trusting the build.

## Follow-ups not done (documented, out of immediate scope)
- Embedding/pgvector retrieval for Ask (H5 uses lexical ranking as an interim).
- Moving summarization fully off the request lifecycle onto the `@fathom/jobs` durable queue (H4
  mitigated via concurrency + maxDuration).
- Recording URL re-upload to Supabase so playback URLs don't expire after ~24h (L3).
