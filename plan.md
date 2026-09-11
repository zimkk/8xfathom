# Fathom 8x — Build Progress Tracker

> Reference: architecture.md (authoritative specification)
> Platform: Google Meet AI Notetaker
> Target: End-to-end production-ready application

---

## Phase 0 — Repository Compliance
- [x] architecture.md present
- [ ] Initialize git repository
- [ ] pnpm workspace + Turborepo monorepo scaffold
- [ ] .agent-logs/ directory created and committed
- [ ] .env.example
- [ ] Initial CI (.github/workflows/ci.yml)
- [ ] .gitignore

## Phase 1 — Foundation
- [ ] Next.js web app (apps/web)
- [ ] Tailwind CSS + shadcn/ui setup
- [ ] Drizzle ORM + schema migrations (packages/db)
- [ ] Auth.js with Google OAuth
- [ ] Authenticated shell layout (sidebar, nav)
- [ ] Demo/public shell layout
- [ ] Seed infrastructure scripts
- [ ] packages/core (domain types, capture interface, AI interface)
- [ ] packages/ui (shared components)
- [ ] packages/config (eslint, typescript, tailwind configs)
- [ ] packages/integrations scaffold

## Phase 2 — Demo-First UX
- [ ] Seed 10 meetings with realistic data (scripts/seed-demo.ts)
- [ ] Hero meeting: 1h 3m, 8 participants, 300+ transcript segments
- [ ] Meeting library page (/app/meetings)
- [ ] Dashboard (/app) with upcoming + recent meetings
- [ ] Meeting workspace (/app/meetings/[id])
  - [ ] Video player with custom controls
  - [ ] Virtualized transcript with sync
  - [ ] Overview tab (summary, decisions, action items, highlights)
  - [ ] Transcript tab with search
  - [ ] Ask tab (mock AI)
- [ ] Action item checkbox mutations
- [ ] Highlight creation (transcript range selection)
- [ ] Public share flow (/share/meeting/[token], /share/clip/[token])
- [ ] Demo routes (/demo, /demo/meetings/[id])
- [ ] Landing page (/) with Explore Demo
- [ ] Global search (/app/search)

## Phase 3 — Google Calendar
- [ ] OAuth credential storage with AES-256-GCM encryption
- [ ] Calendar connect/disconnect UI (/app/settings/calendar)
- [ ] Calendar OAuth flow (/api/calendar/connect, /api/calendar/callback)
- [ ] Google Calendar sync job (Trigger.dev)
- [ ] Event normalization (extract Meet URLs)
- [ ] Upcoming meetings calendar UI (/app/calendar)
- [ ] Capture policy engine (pure domain function)
- [ ] Per-meeting Record/Skip overrides
- [ ] Auto-record preference UI (/app/settings/capture)
- [ ] Schedule/reschedule/cancel bot logic
- [ ] Token refresh with needs_reauth handling

## Phase 4 — Recall.ai Bot
- [ ] CaptureProvider interface (packages/core/src/capture)
- [ ] RecallMeetCaptureProvider adapter (packages/integrations/src/recall)
- [ ] MockCaptureProvider for local dev
- [ ] Bot schedule/startNow/stop/cancel
- [ ] Webhook endpoint (/api/webhooks/recall)
- [ ] Webhook signature verification
- [ ] Webhook event normalization (internal event types)
- [ ] Meeting lifecycle state machine
- [ ] MeetingLifecycleService.transition()
- [ ] Live status polling (3s interval for non-terminal states)
- [ ] Bot events append-only log
- [ ] Manual Add Notetaker flow (/api/meetings/manual)
- [ ] Live meeting status UI (Recording badge, participant count)

## Phase 5 — Media Ingestion
- [ ] Participant data import from Recall
- [ ] Transcript ingestion (normalize to transcript_segments)
- [ ] Recording streaming copy to Supabase Storage
- [ ] Signed playback URLs (authenticated + public share)
- [ ] Meeting status → processing → ready transitions
- [ ] Clip playback with startMs/endMs seeking

## Phase 6 — AI Processing
- [ ] AI provider abstraction (MeetingIntelligenceProvider interface)
- [ ] OpenAI adapter (via Vercel AI SDK)
- [ ] MockAIProvider for local dev
- [ ] Transcript chunking (5-10 min / 2000-4000 token chunks)
- [ ] Structured extraction (Zod schema + evidence IDs)
- [ ] Multi-chunk reduce/merge for long meetings
- [ ] Evidence validation (verify segment IDs exist)
- [ ] Summary generation and persistence
- [ ] 5 summary templates (general, sales, one_on_one, interview, project)
- [ ] Template switching with on-demand generation
- [ ] Action items with evidence timestamps
- [ ] Decisions with confirmed/tentative status
- [ ] Topics/chapters for navigation
- [ ] PostgreSQL full-text search across meetings/transcript/summary
- [ ] Embedding chunks generation (pgvector)
- [ ] Ask-this-meeting (P2, after P0 stable)

## Phase 7 — Polish + P1 Companion
- [ ] All loading/empty/error states
- [ ] Denied admission UX
- [ ] Responsive layout (mobile meeting library, drawer sidebar)
- [ ] Accessibility (keyboard nav, focus, semantic HTML)
- [ ] Sentry error monitoring
- [ ] Rate limiting
- [ ] Chrome Meet companion (P1, only after P0 complete)
  - [ ] WXT Manifest V3 extension scaffold
  - [ ] Add Notetaker, Highlight, Open Notes, Stop controls
  - [ ] Status display
- [ ] Final E2E Playwright tests
- [ ] Production deployment (Vercel + Supabase + Trigger.dev)
- [ ] README with screenshots, setup, architecture

---

## Database Tables Implemented
- [ ] users
- [ ] accounts (Auth.js)
- [ ] sessions (Auth.js)
- [ ] calendar_connections
- [ ] user_capture_preferences
- [ ] calendar_events
- [ ] meetings
- [ ] capture_sessions
- [ ] bot_events
- [ ] meeting_participants
- [ ] transcript_segments
- [ ] meeting_summaries
- [ ] decisions
- [ ] action_items
- [ ] topics
- [ ] highlights
- [ ] share_links
- [ ] embedding_chunks
- [ ] ask_threads
- [ ] ask_messages
- [ ] webhook_events
- [ ] audit_logs

---

## API Routes Implemented
- [ ] /api/auth/[...nextauth]
- [ ] /api/calendar/connect, /callback, /disconnect, /sync
- [ ] /api/meetings (GET, POST /manual)
- [ ] /api/meetings/[id] (GET, PATCH)
- [ ] /api/meetings/[id]/capture (POST, /stop POST)
- [ ] /api/meetings/[id]/status (GET)
- [ ] /api/meetings/[id]/transcript (GET)
- [ ] /api/meetings/[id]/summary (GET, /generate POST)
- [ ] /api/meetings/[id]/ask (POST)
- [ ] /api/meetings/[id]/highlights (GET, POST)
- [ ] /api/highlights/[id] (PATCH, DELETE, /share POST)
- [ ] /api/shares/meeting/[id] (POST)
- [ ] /api/shares/[id] (DELETE, GET)
- [ ] /api/search (GET)
- [ ] /api/webhooks/recall (POST)
- [ ] /api/extension/* (P1)

---

## Current Status: Phase 0 — Starting
Last updated: 2026-09-12
