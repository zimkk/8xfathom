# Agent Log — Phase 7: CI Green, Extension Resilience, One-Click Sync

**Date:** 2026-09-12
**Agent:** Claude Opus 4.8
**Phase:** 7 — Ship the audit fixes to production, unblock CI, and tighten the calendar UX
**PRs:** #17 (audit fixes, see log 06), #18 (resilience), #19 (sync UX) — all merged to `main`

## Summary
Merged the Phase-6 audit fixes to production, then fixed two pre-existing CI breaks, added
CORS for the extension API, hardened the app against browser-extension interference, and made
calendar sync a true one-click action everywhere it's connected. Every change type-checks clean
and CI (Install / Lint / Typecheck / Test / Build) is green.

## CI unblocked (was red on two pre-existing infra breaks, masked because runs died at the first)
- **pnpm version conflict** — the workflow pinned pnpm 9 via `PNPM_VERSION` while `package.json`
  pins `packageManager: pnpm@12.4.1`, so `pnpm/action-setup` aborted with `ERR_PNPM_BAD_PM_VERSION`.
  Removed the explicit `version:` input so action-setup reads the pin. `.github/workflows/ci.yml`
- **`next lint` had no config** → it dropped into its interactive setup wizard and failed in CI.
  Added `apps/web/.eslintrc.json` (extends `next/core-web-vitals`), disabled the cosmetic
  `react/no-unescaped-entities`, and removed stale `@typescript-eslint/no-explicit-any` disable
  directives (that plugin isn't registered under Next's config, so the directives themselves
  errored). Verified the exact error set is cleared; the 7 remaining `exhaustive-deps` warnings
  don't fail `next lint`.

## Extension / ad-blocker resilience (PR #18)
- **CORS for the extension API** — the Chrome extension calls `/api/extension/*` from a content
  script on `meet.google.com` (cross-origin). Added OPTIONS-preflight handling and credentialed
  CORS headers (allowed origins: `meet.google.com` + `EXTENSION_ALLOWED_ORIGINS`) in
  `apps/web/middleware.ts`, which already matches the path.
- **Error boundaries** — added `app/error.tsx` (route-segment) and `app/global-error.tsx`
  (root, **fully inlined styles** so it renders even if CSS never loaded), plus
  `suppressHydrationWarning` on `<body>`, so extensions that mutate the DOM or throw can't blank
  the page.
- **Verified production styling is fine** on `https://8xfathom.vercel.app`: stylesheet 200, 592
  rules, `bg-primary` computes correctly. The unstyled-page report is a `next dev` artifact (dev
  injects CSS via JS; a blocked dev/HMR client stops the injection) and does not affect prod.
- Confirmed the core app has no blockable third-party dependency: `/api/*` is first-party,
  `next/font` self-hosts Inter, Sentry is server-only, and Vercel Analytics/Speed Insights fail
  gracefully.
- **Known caveat (not yet fixed):** the extension's credentialed calls still won't send the
  `SameSite=Lax` session cookie cross-site → `/api/extension/*` returns 401 until the cookie is
  `SameSite=None; Secure` or the extension uses a bearer token. Left for the user to decide.

## Calendar sync UX (PR #19)
- Sync was two steps: "Sync calendar" on the dashboard/calendar just linked to settings, where a
  separate form ran the sync. Now it's one click.
- Added `components/calendar/sync-button.tsx` — POSTs `/api/calendar/sync` in place, shows a
  spinner, toasts the result, and `router.refresh()`es; on `needsReauth`/`needsConnect` it routes
  through `/api/calendar/connect`.
- `/api/calendar/sync` returns JSON again (`needsReauth`/`needsConnect` flags) instead of a form
  redirect. Wired the button into the dashboard empty state, the calendar header + empty state, and
  the settings page (replacing the old form). It renders **only when the calendar is connected** —
  disconnected shows "Connect" (one step), connected shows one-click "Sync" everywhere.

## Still required by hand (unchanged; code can't do these)
1. Google Cloud Console → OAuth client → add redirect URI
   `https://8xfathom.vercel.app/api/calendar/callback`; confirm `GOOGLE_REDIRECT_URI` matches.
2. Recall dashboard → Webhooks → point at `https://8xfathom.vercel.app/api/webhooks/recall`.

## Open follow-ups (documented, not done)
- Extension cross-site auth (SameSite=None cookie or bearer token).
- Embedding/pgvector retrieval for Ask; durable-queue summarization; Supabase recording re-upload.
