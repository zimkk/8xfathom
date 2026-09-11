# Fathom 8x — AI Meeting Notetaker

A polished, end-to-end Google Meet AI notetaker built as a Fathom-style product. Connects to Google Calendar, automatically schedules a visible AI notetaker for eligible meetings, records and transcribes, and distills every meeting into a navigable knowledge workspace.

**Live demo:** _deploy to Vercel — see Deployment below_

---

## Product Overview

```
Google Calendar
      ↓
meeting is known automatically
      ↓
user joins Google Meet normally
      ↓
real visible AI notetaker joins (via Recall.ai)
      ↓
recording + speaker-aware transcript
      ↓
automatic AI processing
      ↓
recording playback synchronized with transcript
      ↓
summary templates + action items + highlights
      ↓
cross-meeting search + public sharing
```

### Key Features

- **Calendar awareness** — connect Google Calendar, upcoming Meet events appear automatically
- **Auto-record rules** — all, external only, internal only, or never; per-meeting overrides
- **Real visible bot** — Recall.ai-backed notetaker joins as a visible participant, waits for admission
- **Recording playback** — synchronized with speaker-aware transcript; click any segment to seek
- **AI summaries** — 5 templates (General, Sales, 1:1, Interview, Project); switch on demand
- **Action items & decisions** — extracted with evidence timestamps, user-checkable
- **Highlights & clips** — create by selecting transcript segments; public clip sharing
- **Cross-meeting search** — PostgreSQL full-text across title, participants, transcript, summary
- **Public sharing** — share any meeting or clip without requiring sign-in
- **Demo workspace** — full seeded demo accessible without authentication

---

## Architecture

```
Browser (Next.js)
      │
      ▼
Next.js App Router (Vercel)
├── Auth (Auth.js + Google OAuth)
├── Calendar API (connect, sync, events)
├── Meetings API (lifecycle, capture, transcript, AI)
├── Search API (PostgreSQL FTS)
├── Share API (token-based public access)
└── Webhook endpoint (Recall.ai events)
      │
      ├── PostgreSQL (Supabase) + pgvector
      ├── Supabase Storage (recordings, media)
      ├── Trigger.dev (background jobs)
      │     ├── calendar.sync
      │     ├── recording.ingest
      │     ├── transcript.ingest
      │     ├── meeting.process (AI extraction)
      │     └── embeddings.generate
      ├── Google APIs (Calendar)
      ├── Recall.ai (meeting bot infrastructure)
      └── AI Provider (OpenAI via Vercel AI SDK)
```

**Capture layer:** Recall.ai handles all meeting-bot browser infrastructure — joining Google Meet, media capture, transcription, and participant metadata. The application wraps Recall behind a `CaptureProvider` interface so the provider can be swapped without changing domain logic.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + shadcn/ui |
| Database ORM | Drizzle ORM |
| Database | Supabase Postgres + pgvector |
| Object Storage | Supabase Storage |
| Auth | Auth.js v5 (Google OAuth) |
| Background Jobs | Trigger.dev |
| Meeting Capture | Recall.ai |
| AI | OpenAI (via Vercel AI SDK) |
| Monorepo | pnpm workspaces + Turborepo |
| Deployment | Vercel |

---

## Monorepo Structure

```
/
├── apps/
│   └── web/              Next.js application
├── packages/
│   ├── core/             Domain types, capture + AI interfaces
│   ├── db/               Drizzle schema + migrations
│   ├── integrations/     Recall.ai, Google, OpenAI, Supabase adapters
│   ├── jobs/             Trigger.dev background tasks
│   ├── ui/               Shared UI components
│   └── config/           Shared eslint, typescript, tailwind config
└── scripts/
    ├── seed-demo.ts      Demo data seeder
    └── seed-data.ts      Hero meeting transcript + 10 seed meetings
```

---

## Setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- Supabase project (Postgres + Storage)
- Google Cloud project with Calendar API and OAuth 2.0
- Recall.ai account
- OpenAI API key
- Trigger.dev project

### 1. Clone and install

```bash
git clone <repo>
cd fathom
pnpm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
# Fill in all required values
```

See `.env.example` for all required variables.

### 3. Database

```bash
pnpm --filter @fathom/db db:generate
pnpm --filter @fathom/db db:migrate
```

Enable `pgvector` extension in Supabase SQL editor:
```sql
create extension if not exists vector;
```

### 4. Seed demo data

```bash
pnpm seed:demo
```

This creates 10 seeded meetings including the hero enterprise implementation meeting with 195 transcript segments, AI summaries, action items, decisions, topics, and highlights.

### 5. Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

With `USE_MOCK_INTEGRATIONS=true` in `.env.local`, the app runs fully without real Recall.ai or AI API keys — using mock providers that simulate bot lifecycle in seconds.

---

## Environment Variables

```bash
# App
APP_URL=http://localhost:3000
AUTH_SECRET=<random 32 bytes>
APP_ENCRYPTION_KEY=<random 32 bytes base64>
USE_MOCK_INTEGRATIONS=false

# Database (Supabase)
DATABASE_URL=postgresql://...
DIRECT_DATABASE_URL=postgresql://...
NEXT_PUBLIC_SUPABASE_URL=https://...supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=meeting-media

# Google OAuth + Calendar
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/callback

# Recall.ai
RECALL_API_KEY=...
RECALL_WEBHOOK_SECRET=...
RECALL_REGION=us-east-1

# AI
AI_PROVIDER=openai
AI_API_KEY=...
AI_CHAT_MODEL=gpt-4o
AI_EMBEDDING_MODEL=text-embedding-3-small

# Trigger.dev
TRIGGER_SECRET_KEY=...
TRIGGER_PROJECT_REF=...

# Sentry (optional)
NEXT_PUBLIC_SENTRY_DSN=...
```

---

## How Meeting Capture Works

1. **Calendar sync** — the Trigger.dev `calendar.sync` job polls the user's Google Calendar every 10 minutes for upcoming Meet events.

2. **Capture policy** — a pure function `evaluateCaptureDecision()` evaluates the user's default recording rule and per-meeting overrides to decide whether to schedule the bot.

3. **Bot scheduling** — `CaptureOrchestrationService` calls `RecallCaptureProvider.schedule()`, which creates a Recall.ai bot targeting the meeting URL. The bot joins ~1 minute before the meeting.

4. **Admission** — Recall's bot appears as a visible participant ("AI Notetaker"). If the host requires admission, it waits and the meeting shows `Waiting for host approval`. Once admitted, recording begins.

5. **Webhook lifecycle** — Recall.ai sends webhook events to `/api/webhooks/recall` (HMAC-SHA256 verified). Events are normalized to internal types and drive `MeetingLifecycleService.transition()`.

6. **Ingestion** — when recording is ready, `recording.ingest` streams it to Supabase Storage. `transcript.ingest` normalizes segments to `transcript_segments`.

7. **AI processing** — `meeting.process` chunks the transcript, runs structured extraction via OpenAI, validates evidence segment IDs, and persists summaries, action items, decisions, and topics.

8. **Playback** — signed Supabase Storage URLs enable direct browser playback without proxying through Vercel.

**Note:** This application uses Recall.ai for meeting-bot infrastructure. Recall provides the Chromium-based bot that visibly joins Google Meet. This is an intentional architectural choice — building a self-hosted bot would add weeks of complexity without improving the core product experience.

---

## Deployment

### Vercel

```bash
vercel deploy
```

Set all environment variables in the Vercel dashboard. The app deploys from `apps/web`.

### Recall.ai Webhook

After deployment, configure your Recall.ai webhook URL:
```
https://<your-domain>/api/webhooks/recall
```

### Google OAuth

Add authorized redirect URIs in Google Cloud Console:
```
https://<your-domain>/api/auth/callback/google
https://<your-domain>/api/calendar/callback
```

---

## Test Commands

```bash
pnpm typecheck    # TypeScript check (all packages)
pnpm lint         # ESLint
pnpm test         # Vitest unit tests
pnpm build        # Production build
```

---

## Tradeoffs & Known Limitations

- **Google Meet only** — intentional scope constraint for assessment depth over breadth
- **Recall.ai dependency** — third-party bot admission depends on Google Meet host settings; some organizations block third-party bots at the domain level
- **AI quality** — summary and action item quality depends on transcript quality from Recall
- **No real-time transcript in demo** — the demo uses seeded data; live meetings use polling for status
- **Consent requirements** — recording laws vary by jurisdiction; the meeting host is responsible for compliance
- **Chrome extension** — a lightweight P1 Meet companion extension (Add Notetaker, Highlight, Open Notes, Stop) is architecturally designed but not included in this build

---

## Agent Logs

This project was built using Claude Code with multi-agent parallelism. See `.agent-logs/` for the agent capture setup and incremental development logs committed throughout the build.
