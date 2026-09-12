# Fathom 8x

AI-powered Google Meet notetaker. Automatic recording, real-time transcription, smart summaries, action items, and searchable meeting history.

---

## What it does

- **Joins your Google Meet automatically** via a bot that records and transcribes the call
- **Generates structured summaries** — overview, decisions, action items, key topics — using GPT-4o
- **Searchable transcript** with speaker attribution and timestamp deep-links
- **Highlight clips** — save moments from any meeting and share them
- **Share links** — share a full meeting or a single clip with anyone, no account required
- **Ask anything** — Q&A against the meeting transcript
- **Chrome extension** (in progress) — live transcription during the call via Web Speech API

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 App Router |
| Language | TypeScript (strict) |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Auth.js v5 (Google OAuth) |
| Storage | Supabase Storage |
| Meeting capture | Recall.ai |
| AI | OpenAI GPT-4o |
| Background jobs | Vercel Cron + `waitUntil` |
| Monorepo | pnpm workspaces + Turborepo |

---

## Project structure

```
fathom8x/
├── apps/
│   └── web/                  # Next.js application
│       ├── app/              # App Router pages and API routes
│       ├── components/       # React components + shadcn/ui
│       └── lib/              # Services, auth, utilities
├── packages/
│   ├── core/                 # Domain logic, types, capture decisions
│   ├── db/                   # Drizzle schema and migrations
│   ├── integrations/         # Recall.ai, OpenAI, Google Calendar, Storage
│   ├── jobs/                 # Background job definitions (Trigger.dev compatible)
│   └── ui/                   # Shared UI primitives
├── scripts/                  # Setup and seed scripts
├── docker-compose.yml        # Local Postgres
└── vercel.json               # Cron schedules
```

---

## Local development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for local Postgres)

### One-command setup

```bash
pnpm setup
```

This starts Docker Postgres, enables pgvector, runs migrations, and seeds demo data.

Then start the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The app runs fully in mock mode — no external API keys needed.

### Environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

The defaults work for local development. For real meeting capture and AI, fill in:

| Variable | Where to get it |
|----------|----------------|
| `RECALL_API_KEY` | [recall.ai](https://recall.ai) dashboard |
| `RECALL_WEBHOOK_SECRET` | Recall dashboard → Webhooks |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → OAuth 2.0 |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth 2.0 |
| `AI_API_KEY` | [platform.openai.com](https://platform.openai.com) |
| `DATABASE_URL` | Your Postgres connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project settings |
| `CRON_SECRET` | Generate: `openssl rand -hex 32` |
| `AUTH_SECRET` | Generate: `openssl rand -hex 32` |
| `APP_ENCRYPTION_KEY` | Generate: `openssl rand -hex 32` |

### Mock mode

Set `USE_MOCK_INTEGRATIONS=true` and `DEV_AUTH_BYPASS=true` to run without any external services. A demo sign-in panel appears on the login page.

---

## Key API routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/meetings` | List meetings (paginated) |
| `POST` | `/api/meetings` | Create meeting manually |
| `GET` | `/api/meetings/:id` | Get single meeting |
| `POST` | `/api/meetings/:id/capture` | Start/schedule bot capture |
| `POST` | `/api/meetings/:id/capture/stop` | Stop active capture |
| `GET` | `/api/meetings/:id/summary` | Get AI summary |
| `POST` | `/api/meetings/:id/summary/generate` | Re-generate summary |
| `GET` | `/api/meetings/:id/transcript` | Get transcript segments |
| `GET` | `/api/meetings/:id/action-items` | List action items |
| `POST` | `/api/meetings/:id/action-items` | Create manual action item |
| `PATCH` | `/api/meetings/:id/action-items/:itemId` | Toggle action item status |
| `GET` | `/api/meetings/:id/highlights` | List highlights |
| `POST` | `/api/meetings/:id/highlights` | Create highlight |
| `POST` | `/api/meetings/:id/ask` | Ask a question about the meeting |
| `GET` | `/api/meetings/:id/share` | List share links |
| `POST` | `/api/meetings/:id/share` | Create share link |
| `GET` | `/api/calendar/connect` | Start Google Calendar OAuth (redirects to Google) |
| `POST` | `/api/calendar/sync` | Sync upcoming calendar events |
| `GET` | `/api/search` | Full-text search across meetings |
| `POST` | `/api/webhooks/recall` | Recall.ai webhook receiver |
| `GET` | `/api/cron/schedule-captures` | Vercel Cron — schedule upcoming bots |
| `GET` | `/api/cron/reconcile-captures` | Vercel Cron — fix stuck captures |

---

## Deployment (Vercel)

1. Import the repo in [vercel.com](https://vercel.com)
2. Add all environment variables from `.env.example`
3. Set `CRON_SECRET` — Vercel sends this automatically to cron routes
4. Deploy — cron jobs activate automatically from `vercel.json`

> **Note:** Vercel Hobby plan caps function execution at 60s. This covers transcription and AI summary for meetings up to ~45 minutes. For longer meetings, upgrade to Pro and set `maxDuration = 300` in the webhook route.

---

## Running tests

```bash
# Unit tests
pnpm test

# Type checking
pnpm typecheck

# Lint
pnpm lint
```

---

## Database

```bash
# Generate migrations after schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Open Drizzle Studio (DB browser)
pnpm db:studio

# Seed demo data
pnpm seed:demo
```

---

## How meeting capture works

> **Scheduling:** a Recall.ai bot is scheduled as soon as a meeting is created during calendar
> sync (Recall accepts a future `join_at`). The daily `schedule-captures` cron is a backstop only.
> Bot **status** and real-time **transcript** webhooks must both be pointed at
> `${APP_URL}/api/webhooks/recall` — status events via the Recall dashboard webhook config, and
> transcript events via the bot's `recording_config.realtime_endpoints` (set automatically).

```
Google Calendar event (Meet URL detected)
         ↓
Fathom schedules a Recall.ai bot (POST /v1/bot)
         ↓
Recall's bot joins the Google Meet call
         ↓
Recall webhooks → POST /api/webhooks/recall
  • bot.status_change  → updates meeting status in DB
  • bot.transcript.data → stores live transcript segments
         ↓
When meeting ends, Recall finishes processing (analysis_done)
         ↓
waitUntil() kicks off in background:
  1. Fetches full transcript from Recall
  2. Inserts transcript segments
  3. Calls OpenAI to extract summary, action items, decisions, topics
  4. Marks meeting as ready
```

---

## License

MIT
