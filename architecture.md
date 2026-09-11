# architecture.md

> **Implementation authority:** This document is the complete build specification for the assessment project. Treat every explicit decision below as authoritative. Do not stop to ask product or architecture questions unless an external credential, API key, or account authorization is literally impossible to infer or create. Where a third-party SDK has changed, preserve the contract and behavior described here while adapting only the provider-specific call syntax to the provider's current official SDK/API.
>
> **Primary objective:** Build and deploy a polished, end-to-end Google-Meet-only AI meeting notetaker that stays deliberately close to the Fathom workflow described in the assessment: connect calendar → automatically recognize eligible meetings → visible notetaker joins Google Meet → record/transcribe → playback against transcript → AI summary/templates/action items → highlights → search → public clip/meeting sharing. Use Recall.ai for the meeting-bot infrastructure. The public web application is the primary product surface and submission link. A lightweight Chrome Meet companion is a fidelity enhancement only after the required flow is complete.
>
> **Assessment priorities:** speed, product judgment, UX/UI quality. Build the important product deeply rather than adding unrelated breadth.
>
> **Capture decision:** Use **Recall.ai** as the production meeting-bot infrastructure. Do not build low-level Chromium/Playwright meeting-bot infrastructure from scratch for this assessment. Keep capture behind our own `CaptureProvider` interface so a self-hosted bot or bot-free capture can be added later.
>
> **Platform scope:** Google Meet only. The required shipped experience is the public web application plus a real visible Google Meet notetaker. A lightweight Chrome Meet companion may be added only after the required flow is stable. Do not build a native desktop application for this assessment; it adds packaging complexity without improving the required evaluated flows. No Zoom, Teams, Slack, CRM, billing, mobile app, or organization/team administration.
>
> **Repository requirement:** Before implementing product code, complete the provided 8x agent capture setup, verify it passes, commit `.agent-logs/`, and keep committing agent logs incrementally throughout the build. Do not dump all logs in one final commit.

---

# 1. Product definition

Build a focused Fathom-style Google Meet notetaker. The user should rarely need to "manage a bot"; the product should automatically know about upcoming meetings and make capture feel ambient.

Required product flow:

1. User signs in and connects Google Calendar.
2. Upcoming Google Meet events appear automatically.
3. User chooses a simple default recording rule:
   - all meetings,
   - external meetings only,
   - internal meetings only,
   - never.
4. Each upcoming meeting has a lightweight `Record / Skip` override.
5. For eligible meetings, the visible AI notetaker is scheduled automatically.
6. The user joins the real Google Meet as normal.
7. The notetaker joins, waits for admission when required, and records/transcribes after admission.
8. After the meeting ends, recording and transcript are processed automatically.
9. The meeting workspace provides the assessment's core post-call flows:
    - recording playback synchronized with transcript,
    - AI summary,
    - summary template switching,
    - action items,
    - highlights/clips.
   P1 may add separately rendered decisions/topics. P2 may add Ask-this-meeting with timestamp evidence.
10. User can search across meetings and jump to matching moments.
11. User can share a whole meeting or a clip with someone who is not signed in.
12. The deployment ships with realistic populated data, including an approximately one-hour, eight-person hero meeting.

The web application is the primary submission surface. It must be fully useful without any extension installed. If all required flows are complete, add the small Chrome Meet companion described later to make the in-meeting interaction feel closer to Fathom.

---

## 1.1 Implementation priority: do not overbuild

Claude Code must follow these priority tiers.

### P0 — required by the assessment; must ship

- Google sign-in and Google Calendar connection.
- Upcoming Google Meet awareness.
- Per-meeting `Record / Skip` behavior and simple automatic recording preference.
- Real visible Google Meet notetaker via Recall.ai.
- Bot lifecycle/status and graceful admission failure.
- Recording playback.
- Timestamped speaker-aware transcript synchronized with playback.
- AI summary.
- Multiple summary templates.
- Action items.
- User-created highlight/clip.
- Search across meetings.
- Public meeting/clip sharing with no login required.
- Realistic seeded meetings, including an approximately one-hour, eight-person case.
- Public live deployment, public repository, `.agent-logs/`, and walkthrough readiness.

### P1 — small Fathom-fidelity enhancements; build only after P0 is stable

- Lightweight Chrome Meet companion with `Add Notetaker`, status, `Highlight`, `Open Notes`, and `Stop`.
- Decisions/topics as separate structured UI when they naturally fall out of summary processing.
- Better live transcript/status polish.

### P2 — useful enhancement, not required for assessment completion

- Ask-this-meeting.
- Embedding/vector semantic retrieval.
- Advanced semantic ranking.
- Extra AI sections beyond what the assessment demonstrates.

If any P1/P2 work threatens P0 quality or deployment reliability, skip it. Do not ask the user whether to skip it.

---

# 2. Product principles

## 2.1 Capture is infrastructure, not the product

The post-meeting experience is the core product. The bot proves that capture is real; the value comes from turning the meeting into useful, navigable, searchable knowledge.

## 2.2 Evidence-first AI

Every important AI-generated claim should be traceable back to transcript evidence. If an answer, decision, or action item is supported by a known transcript segment, preserve the segment/timestamp relationship.

Never generate a polished AI layer that feels disconnected from the source conversation.

## 2.3 Realistic scale

The UI must remain good on an approximately one-hour meeting with eight participants and hundreds of transcript segments.

Do not optimize only for a two-minute demo.

## 2.4 Narrow platform scope

Google Meet only. This enables a better product inside the assessment window and avoids shallow integrations.

## 2.5 Graceful failure is product quality

The bot may be waiting for admission, denied by the host, rejected because third-party bots cannot knock, or fail mid-session. These must be explicit, understandable states in the UI.

## 2.6 Public evaluator path

An evaluator who is not authenticated must be able to open the deployment and immediately understand the product. The landing page must include **Explore Demo**, which enters a read-only seeded workspace without authentication.

## 2.7 Fathom fidelity over platform breadth

When choosing between an extra SaaS feature and improving a flow explicitly named in the assessment, improve the assessment flow.

The essential behavior to preserve is:

```text
calendar awareness
→ automatic notetaker scheduling
→ visible Meet participant
→ recording/transcription
→ recording + transcript playback
→ summary/template/action items
→ highlight/clip
→ cross-meeting search
→ public sharing
```

Do not turn the product into a generic bot scheduler, project-management tool, analytics suite, or AI chat product. The user should mostly encounter the notetaker around meetings and return to the app afterward to use the meeting knowledge.

---

# 3. Non-goals

Do **not** build:

- Zoom support.
- Microsoft Teams support.
- Slack integration.
- Salesforce/HubSpot/CRM sync.
- Billing or subscription management.
- Organization/team administration.
- RBAC beyond app user vs public share viewer.
- Native desktop application. Intentionally omitted for this assessment; web + visible bot + lightweight Meet companion covers the required Fathom-style flow with much less complexity.
- Native mobile application.
- Full browser-based audio recording as the primary capture mode.
- Self-hosted Chromium bot infrastructure.
- Google Meet Media API integration.
- Full analytics/manager coaching suite.
- Revenue intelligence / sales coaching dashboard.
- Calendar write access.
- Email sending.
- Complex notification center.
- Downloadable rendered clip files unless trivial after core completion.
- Multi-language UI.
- Advanced data-retention controls.
- Workspace multi-tenancy.

---

# 4. High-level system architecture

```text
                                   ┌────────────────────────┐
                                   │       Browser          │
                                   │                        │
                                   │ Next.js Web App        │
                                   │ P1 Meet Companion      │
                                   └───────────┬────────────┘
                                               │ HTTPS
                                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                            │
│                                                                      │
│  Next.js App Router                                                  │
│  ├─ Auth/session                                                     │
│  ├─ Calendar UI/API                                                  │
│  ├─ Meetings API                                                     │
│  ├─ Search API                                                       │
│  ├─ Share API                                                        │
│  └─ Webhook endpoints                                                │
│                                                                      │
└───────────┬──────────────────┬─────────────────┬─────────────────────┘
            │                  │                 │
            ▼                  ▼                 ▼
    ┌──────────────┐   ┌──────────────┐  ┌─────────────────┐
    │ PostgreSQL   │   │ Supabase     │  │ Trigger.dev     │
    │ + pgvector   │   │ Storage      │  │ background jobs │
    └──────────────┘   └──────────────┘  └────────┬────────┘
                                                   │
                        ┌──────────────────────────┼────────────────────┐
                        │                          │                    │
                        ▼                          ▼                    ▼
                 ┌──────────────┐          ┌──────────────┐    ┌─────────────┐
                 │ Google APIs  │          │ Recall.ai    │    │ AI Provider │
                 │ Calendar     │          │ Meet Bot API │    │ LLM/embed   │
                 └──────────────┘          └──────────────┘    └─────────────┘
```

The app owns:
- product behavior,
- calendar sync,
- scheduling decisions,
- meeting lifecycle,
- database state,
- search,
- summaries,
- action items,
- highlights,
- sharing,
- user experience.

Recall owns:
- meeting-bot browser infrastructure,
- joining Google Meet,
- media capture,
- participant-level metadata,
- transcription/realtime events where enabled,
- provider-specific meeting behavior.

---

# 5. Technology stack

Use the following stack unless a package is objectively unavailable. Pin current stable versions in the lockfile.

## 5.1 Repository and runtime

- **Monorepo:** pnpm workspaces + Turborepo
- **Runtime:** current active Node.js LTS
- **Language:** TypeScript with `strict: true`
- **Package manager:** pnpm
- **Formatting:** Prettier
- **Linting:** ESLint
- **Git hooks:** simple lint-staged pre-commit hook; do not make hooks so heavy they slow development

## 5.2 Web application

- **Framework:** Next.js App Router
- **React:** current stable version compatible with chosen Next.js version
- **Styling:** Tailwind CSS
- **Component primitives:** shadcn/ui + Radix primitives where appropriate
- **Icons:** Lucide
- **Forms:** React Hook Form + Zod
- **Validation:** Zod
- **Client data:** TanStack Query for polling, mutations, and cache invalidation
- **Tables/lists:** simple semantic components; use virtualization for long transcript lists
- **Transcript virtualization:** `@tanstack/react-virtual`
- **Date/time:** `date-fns`
- **Video:** native HTML5 `<video>` wrapped in custom controls where needed

## 5.3 Database

- **Managed Postgres:** Supabase Postgres
- **ORM:** Drizzle ORM
- **Migrations:** Drizzle Kit
- **Vector search:** pgvector extension
- **Full-text search:** PostgreSQL FTS
- **IDs:** UUID v7 where available; otherwise standard UUID generated server-side
- **Timestamps:** `timestamptz`, always UTC in storage

## 5.4 Storage

- **Media/object storage:** Supabase Storage
- Bucket: `meeting-media`
- Private by default.
- Never expose service-role credentials to browser.
- Create signed URLs server-side for authenticated playback and public share playback.

## 5.5 Authentication

- **Auth:** Auth.js
- **Primary sign-in:** Google
- **Session strategy:** database-backed session
- Google identity login should use ordinary profile/email scopes.
- Calendar access may be requested either during Google sign-in or through the dedicated calendar connection flow described later. Prefer the dedicated integration record because calendar tokens have a different lifecycle and security model.

## 5.6 Background jobs

- **Trigger.dev**
- Use it for:
  - calendar sync,
  - bot scheduling/create/stop commands,
  - recording ingestion,
  - transcript ingestion,
  - AI processing,
  - embedding generation,
  - retryable webhook follow-up work,
  - cleanup jobs.

Do not run long downloads or AI processing inside Vercel request handlers.

## 5.7 Meeting capture

- **Recall.ai**
- Adapter name: `RecallMeetCaptureProvider`
- The rest of the codebase must depend on our own capture contracts, not Recall response shapes.

## 5.8 AI

Use a provider abstraction implemented with the Vercel AI SDK or a small internal adapter.

Required capabilities:
- structured JSON generation,
- ordinary text generation,
- embeddings.

Environment-selected models:
- `AI_PROVIDER`
- `AI_CHAT_MODEL`
- `AI_EMBEDDING_MODEL`

Do not hardcode a model name throughout the codebase.

Default production provider may be OpenAI, but the application must be able to swap providers without changing domain logic.

## 5.9 Observability

- **Error monitoring:** Sentry
- **Server logging:** Pino-compatible structured JSON logs
- Include `requestId`, `meetingId`, `captureSessionId`, and `jobId` when relevant.

## 5.10 Testing

- **Unit/integration:** Vitest
- **UI/E2E:** Playwright
- **Component behavior:** React Testing Library where useful

## 5.11 Chrome Meet companion (P1)

This is a **small fidelity enhancement**, not a second product and not the recording engine. Implement it only after P0 is complete.

- **Framework:** WXT, Manifest V3
- Match only `https://meet.google.com/*`.
- Do **not** use `tabCapture` for the primary product.
- Do **not** build desktop/native capture.
- Responsibilities are intentionally limited to:
  - identify the current Meet URL,
  - show notetaker state,
  - `Add Notetaker`,
  - `Highlight`,
  - `Open Notes`,
  - `Stop`.
- It may use a small injected panel or extension side/popup surface.
- The evaluator must not need the extension to use the public live link; the web app remains fully functional without it.

---

# 6. Monorepo layout

```text
/
├── .agent-logs/
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── public/
│   │   ├── styles/
│   │   ├── tests/
│   │   └── next.config.ts
│   └── extension/
│       ├── entrypoints/
│       ├── components/
│       ├── lib/
│       └── wxt.config.ts
├── packages/
│   ├── core/
│   │   ├── src/domain/
│   │   ├── src/capture/
│   │   ├── src/ai/
│   │   ├── src/search/
│   │   └── src/index.ts
│   ├── db/
│   │   ├── src/schema/
│   │   ├── src/queries/
│   │   ├── src/migrations/
│   │   └── src/index.ts
│   ├── integrations/
│   │   ├── src/google/
│   │   ├── src/recall/
│   │   ├── src/ai/
│   │   ├── src/storage/
│   │   └── src/index.ts
│   ├── jobs/
│   │   ├── src/tasks/
│   │   └── src/index.ts
│   ├── ui/
│   │   ├── src/components/
│   │   ├── src/tokens/
│   │   └── src/index.ts
│   ├── config/
│   │   ├── eslint/
│   │   ├── typescript/
│   │   └── tailwind/
│   └── test-utils/
├── scripts/
│   ├── seed.ts
│   ├── seed-demo.ts
│   └── verify-env.ts
├── architecture.md
├── README.md
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
└── .env.example
```

Keep provider code out of route handlers. Route handlers call services; services call domain interfaces; adapters call third parties.

---

# 7. Application route map

## 7.1 Public routes

```text
/
├── /                         Landing page
├── /login                    Sign-in
├── /demo                     Public read-only demo meeting library
├── /demo/meetings/[id]       Public seeded demo meeting workspace
├── /share/meeting/[token]    Public shared meeting
├── /share/clip/[token]       Public shared highlight/clip
├── /privacy                  Basic privacy page
└── /terms                    Basic terms/recording responsibility page
```

Landing page must have:
- concise product proposition,
- screenshot/product mock,
- `Try with Google`,
- `Explore Demo`,
- no marketing bloat.

## 7.2 Authenticated app routes

```text
/app
├── /                         Today / meeting dashboard
├── /meetings                 Meeting library
├── /meetings/[meetingId]     Meeting workspace
├── /calendar                 Upcoming synced calendar events
├── /search                   Global meeting search
└── /settings
    ├── /                     General
    ├── /calendar             Calendar connection/sync
    ├── /capture              Auto-record rules and bot identity
    └── /account              Account/session actions
```

## 7.3 API routes

```text
/api
├── /auth/[...nextauth]
├── /calendar
│   ├── /connect
│   ├── /callback
│   ├── /disconnect
│   └── /sync
├── /meetings
│   ├── GET /
│   ├── POST /manual
│   ├── GET /[meetingId]
│   ├── PATCH /[meetingId]
│   ├── POST /[meetingId]/capture
│   ├── POST /[meetingId]/capture/stop
│   ├── GET /[meetingId]/status
│   ├── GET /[meetingId]/transcript
│   ├── GET /[meetingId]/summary
│   ├── POST /[meetingId]/summary/generate
│   ├── POST /[meetingId]/ask
│   ├── GET /[meetingId]/highlights
│   └── POST /[meetingId]/highlights
├── /highlights
│   ├── PATCH /[highlightId]
│   ├── DELETE /[highlightId]
│   └── POST /[highlightId]/share
├── /shares
│   ├── POST /meeting/[meetingId]
│   ├── DELETE /[shareId]
│   └── GET /[shareId]
├── /search
│   └── GET /
├── /webhooks
│   └── /recall
└── /extension
    ├── /status
    ├── /add-notetaker
    ├── /highlight
    └── /stop
```

Use route handlers only as transport boundaries. Core logic lives in services/packages.

---

# 8. Frontend layout

## 8.1 Authenticated shell

Desktop:

```text
┌───────────────────────────────────────────────────────────────┐
│ Sidebar                  Main                                 │
│                                                               │
│ Logo                     contextual header                    │
│ Today                                                         │
│ Meetings                 content                              │
│ Calendar                                                      │
│ Search                                                        │
│                                                               │
│ Settings                                                      │
│ User                                                          │
└───────────────────────────────────────────────────────────────┘
```

Sidebar width: 220–240px.

Use a responsive sheet/drawer on smaller widths.

## 8.2 Dashboard

Sections:
- top greeting + `Add meeting` button,
- upcoming meetings today,
- recent completed meetings,
- processing/failed state cards when relevant.

Meeting card should show:
- title,
- date/time,
- duration for completed meetings,
- attendee avatars/initials,
- capture status,
- short generated summary preview,
- action item count,
- highlight count.

Do not add vanity charts.

## 8.3 Meeting workspace

Desktop primary layout:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ← Meetings       Meeting title                  Share      •••        │
│                  Sep 12 · 1:03:18 · 8 attendees                    │
├─────────────────────────────────┬────────────────────────────────────┤
│                                 │ Overview | Transcript | Ask        │
│                                 │                                    │
│          VIDEO PLAYER           │ tab content                        │
│                                 │                                    │
├─────────────────────────────────┤                                    │
│ player timeline                 │                                    │
└─────────────────────────────────┴────────────────────────────────────┘
```

Suggested desktop split:
- left: 58–62%
- right: 38–42%

On smaller widths:
- stack player above tabs.

Meeting workspace tabs:
1. Overview
2. Transcript
3. Ask

Overview sub-sections:
- AI summary
- key topics
- decisions
- action items
- open questions/follow-ups
- highlights

Do not place all content in one giant text blob.

---

# 9. Design system

Do not copy Fathom branding. Build a clean, restrained B2B productivity identity.

## 9.1 Visual direction

- Light-first UI.
- Neutral surfaces.
- One restrained blue/indigo accent.
- Minimal borders.
- Subtle shadows only where hierarchy needs them.
- Dense enough for professional work, never dashboard-heavy.
- Avoid gradients except possibly on landing-page decorative elements.
- Avoid giant marketing typography inside app.

## 9.2 Typography

- Font: Geist or Inter.
- App body: 14–15px.
- Secondary metadata: 12–13px.
- Page title: 24–30px.
- Meeting title: 20–24px.
- Section headings: 14–16px semibold.

## 9.3 Spacing

Base unit: 4px.

Primary values:
- 4
- 8
- 12
- 16
- 20
- 24
- 32
- 40
- 48

## 9.4 Radii

- controls: 8px
- cards: 12px
- large panels: 14–16px
- avatar/pills: full

## 9.5 Status colors

Use semantic tokens:
- scheduled: neutral/blue
- joining/waiting: amber
- recording: red
- processing: blue/purple
- ready: green
- failed/denied: red
- disabled: gray

Status must never depend on color alone. Include icon/text.

---

# 10. Domain model

The principal aggregates are:

```text
User
CalendarConnection
CalendarEvent
Meeting
CaptureSession
MeetingParticipant
TranscriptSegment
MeetingSummary
ActionItem
Decision
Topic
Highlight
ShareLink
EmbeddingChunk
AskThread / AskMessage
WebhookEvent
AuditLog
```

The `Meeting` is the central domain object.

---

# 11. Database schema

Use Drizzle schemas and migrations. All mutable rows have `created_at` and `updated_at`. Use `deleted_at` only where soft deletion is genuinely useful.

## 11.1 users

```text
id uuid pk
name text
email text unique not null
image_url text nullable
timezone text default 'UTC'
created_at timestamptz
updated_at timestamptz
```

## 11.2 auth.js tables

Include official compatible tables:
- accounts
- sessions
- verification_tokens if required.

Do not expose OAuth account records to client code.

## 11.3 calendar_connections

```text
id uuid pk
user_id uuid fk users.id unique
provider enum('google')
provider_account_email text
encrypted_access_token text
encrypted_refresh_token text
access_token_expires_at timestamptz nullable
scopes text[]
sync_token text nullable
status enum('connected','needs_reauth','disconnected','error')
last_synced_at timestamptz nullable
created_at
updated_at
```

Application-level encrypt tokens using AES-256-GCM with `APP_ENCRYPTION_KEY`.

## 11.4 user_capture_preferences

```text
id uuid pk
user_id uuid fk unique
default_mode enum(
  'all',
  'external_only',
  'internal_only',
  'none'
)
bot_display_name text default 'AI Notetaker'
join_lead_seconds integer default 60
leave_grace_seconds integer default 60
send_consent_message boolean default true
created_at
updated_at
```

## 11.5 calendar_events

```text
id uuid pk
user_id uuid fk
calendar_connection_id uuid fk
provider_event_id text
provider_calendar_id text
title text
description text nullable
starts_at timestamptz
ends_at timestamptz
timezone text nullable
meeting_url text nullable
meeting_platform enum('google_meet','unknown')
organizer_email text nullable
attendee_emails text[]
attendee_count integer default 0
is_recurring boolean default false
recurring_event_id text nullable
provider_updated_at timestamptz nullable
status enum('confirmed','tentative','cancelled')
raw_hash text
created_at
updated_at

unique(user_id, provider_calendar_id, provider_event_id)
```

Do not store the entire Google event payload unless needed for debugging. Keep only normalized fields and an optional small `raw_metadata jsonb`.

## 11.6 meetings

```text
id uuid pk
user_id uuid fk nullable for demo-owned seeded meetings
calendar_event_id uuid nullable
source enum('calendar','manual','seed')
title text
meeting_url text nullable
starts_at timestamptz nullable
ends_at timestamptz nullable
actual_started_at timestamptz nullable
actual_ended_at timestamptz nullable
duration_ms bigint nullable
platform enum('google_meet')
status enum(
  'scheduled',
  'bot_queued',
  'bot_starting',
  'waiting_for_admission',
  'recording',
  'ended',
  'processing',
  'ready',
  'denied',
  'failed',
  'cancelled'
)
capture_enabled boolean
capture_override enum('inherit','enabled','disabled')
visibility enum('private','demo')
summary_template_default text default 'general'
recording_storage_path text nullable
recording_mime_type text nullable
recording_size_bytes bigint nullable
transcript_status enum('pending','partial','complete','failed')
processing_error_code text nullable
processing_error_message text nullable
created_at
updated_at
```

Indexes:
- `(user_id, starts_at desc)`
- `(user_id, status)`
- `(status, starts_at)`
- full-text/search helper index if needed.

## 11.7 capture_sessions

```text
id uuid pk
meeting_id uuid fk
provider enum('recall')
provider_bot_id text unique nullable
provider_recording_id text nullable
status enum(
  'created',
  'scheduled',
  'joining',
  'waiting',
  'recording',
  'done',
  'denied',
  'failed',
  'cancelled'
)
scheduled_for timestamptz nullable
joined_at timestamptz nullable
recording_started_at timestamptz nullable
recording_ended_at timestamptz nullable
left_at timestamptz nullable
consent_message_sent_at timestamptz nullable
failure_code text nullable
failure_message text nullable
provider_metadata jsonb
created_at
updated_at
```

## 11.8 bot_events

Append-only event history.

```text
id uuid pk
capture_session_id uuid fk
type text
occurred_at timestamptz
payload jsonb
created_at
```

Useful for debugging and walkthrough reliability.

## 11.9 meeting_participants

```text
id uuid pk
meeting_id uuid fk
provider_participant_id text nullable
display_name text
email text nullable
avatar_url text nullable
is_host boolean default false
first_joined_at timestamptz nullable
last_left_at timestamptz nullable
speaking_ms bigint default 0
created_at
updated_at
```

Unique where provider participant ID is available.

## 11.10 transcript_segments

```text
id uuid pk
meeting_id uuid fk
participant_id uuid nullable
speaker_name text
start_ms bigint
end_ms bigint
text text
confidence real nullable
source enum('recall','seed')
sequence integer
search_tsv tsvector generated/indexed if practical
created_at
updated_at
```

Indexes:
- `(meeting_id, sequence)`
- `(meeting_id, start_ms)`
- GIN on search tsvector.

Constraints:
- `end_ms >= start_ms`
- sequence unique per meeting.

## 11.11 summary_templates

Seeded static definitions may live in code, but the generated output references keys:
- `general`
- `sales`
- `one_on_one`
- `interview`
- `project`

Do not clone dozens of templates.

## 11.12 meeting_summaries

```text
id uuid pk
meeting_id uuid fk
template_key text
version integer
overview text
structured_json jsonb
model_provider text
model_name text
prompt_version text
created_at
updated_at

unique(meeting_id, template_key, version)
```

`structured_json` schema:

```json
{
  "overview": "string",
  "keyPoints": [
    {
      "text": "string",
      "evidenceSegmentIds": ["uuid"]
    }
  ],
  "openQuestions": [
    {
      "text": "string",
      "evidenceSegmentIds": ["uuid"]
    }
  ],
  "followUps": [
    {
      "text": "string",
      "evidenceSegmentIds": ["uuid"]
    }
  ]
}
```

## 11.13 decisions

```text
id uuid pk
meeting_id uuid fk
text text
status enum('confirmed','tentative')
evidence_segment_ids uuid[]
created_at
updated_at
```

## 11.14 action_items

```text
id uuid pk
meeting_id uuid fk
text text
owner_name text nullable
owner_participant_id uuid nullable
due_date date nullable
status enum('open','done')
evidence_segment_ids uuid[]
source enum('ai','user')
created_at
updated_at
```

Checking an action item is a persisted user mutation.

## 11.15 topics

```text
id uuid pk
meeting_id uuid fk
title text
summary text nullable
start_ms bigint nullable
end_ms bigint nullable
evidence_segment_ids uuid[]
sort_order integer
created_at
```

## 11.16 highlights

```text
id uuid pk
meeting_id uuid fk
user_id uuid nullable
title text
description text nullable
start_ms bigint
end_ms bigint
type enum('highlight','decision','action','moment')
source enum('user','ai','extension')
created_at
updated_at
```

A highlight is initially only metadata over the original recording.

Do **not** render a separate clip asset by default.

## 11.17 share_links

```text
id uuid pk
meeting_id uuid nullable
highlight_id uuid nullable
created_by_user_id uuid nullable
kind enum('meeting','clip')
token_hash text unique
status enum('active','revoked')
expires_at timestamptz nullable
allow_transcript boolean default true
allow_summary boolean default true
created_at
updated_at
```

Generate a 256-bit random raw token. Store only SHA-256 hash in DB. URL contains raw token.

Exactly one of `meeting_id` or `highlight_id` should be non-null according to kind.

## 11.18 embedding_chunks

```text
id uuid pk
meeting_id uuid fk
chunk_index integer
start_ms bigint
end_ms bigint
text text
segment_ids uuid[]
embedding vector(<dimension configured for provider>)
created_at

unique(meeting_id, chunk_index)
```

Do not assume a vector dimension in application logic. Migration must match selected embedding model.

## 11.19 ask_threads

```text
id uuid pk
meeting_id uuid fk
user_id uuid fk
created_at
updated_at
```

## 11.20 ask_messages

```text
id uuid pk
thread_id uuid fk
role enum('user','assistant')
content text
citations jsonb
created_at
```

Assistant citation item:

```json
{
  "segmentId": "uuid",
  "startMs": 1882000,
  "speakerName": "Ahmed",
  "quotePreview": "SSO is on the critical path..."
}
```

## 11.21 webhook_events

Used for idempotency.

```text
id uuid pk
provider text
provider_event_id text
event_type text
payload_hash text
received_at timestamptz
processed_at timestamptz nullable
status enum('received','processed','ignored','failed')
error text nullable

unique(provider, provider_event_id)
```

If provider does not supply an event ID, derive a stable hash from type + provider bot ID + provider timestamp + canonicalized payload.

## 11.22 audit_logs

Minimal product/security audit history:

```text
id uuid pk
user_id uuid nullable
action text
entity_type text
entity_id uuid nullable
metadata jsonb
created_at
```

Examples:
- calendar connected/disconnected,
- recording manually started/stopped,
- share link created/revoked.

---

# 12. Authentication and authorization

## 12.1 Authenticated user

All `/app/**` routes require a valid session.

## 12.2 Ownership checks

Every server-side operation involving a private meeting must assert:

```text
meeting.user_id === session.user.id
```

Never rely on hidden client IDs for access control.

## 12.3 Demo content

Seeded demo meetings have `visibility='demo'` and are only served through `/demo/**`.

They are immutable from public demo routes.

## 12.4 Public share viewer

Public share route:
1. hash raw token,
2. load active share link,
3. verify expiry,
4. load only allowed meeting/clip fields,
5. issue short-lived signed media URL.

Do not expose private user data or unrelated meetings.

---

# 13. Google Calendar integration

## 13.1 OAuth scopes

Use minimum scopes:
- identity scopes for login,
- `calendar.events.readonly` for calendar integration.

No calendar write permission.

## 13.2 Calendar connect flow

```text
Settings → Connect Google Calendar
            ↓
Google OAuth consent
            ↓
/api/calendar/callback
            ↓
encrypt access/refresh token
            ↓
store calendar_connection
            ↓
trigger initial calendar sync
            ↓
redirect /app/calendar?connected=1
```

Request offline access and refresh token where supported.

## 13.3 Token refresh

Create integration helper:

```ts
interface GoogleCalendarCredentialStore {
  getValidAccessToken(userId: string): Promise<string>;
}
```

Behavior:
- decrypt stored token,
- if not expired: return,
- if expired and refresh token exists: refresh,
- encrypt and persist new token,
- if refresh fails with invalid grant: mark connection `needs_reauth`,
- surface a reconnect banner in UI.

## 13.4 Sync window

On initial connect:
- past 30 days for recent context,
- next 30 days for upcoming meetings.

Recurring scheduled job:
- sync next 14 days every 10 minutes,
- incremental sync using Google sync token when available.

Manual `Sync now` button triggers the same job.

## 13.5 Event normalization

Only create/update meeting records when:
- event status is not cancelled,
- a valid Google Meet URL exists.

If cancelled:
- mark calendar event cancelled,
- cancel scheduled capture if bot not yet recording.

If start time changes:
- update meeting,
- reschedule capture.

If Meet URL changes:
- update meeting and capture job.

## 13.6 Internal vs external classification

User company domain:
- derive from signed-in email domain unless it is a public consumer domain (gmail.com, outlook.com, etc.).
- for consumer domains, treat external/internal rule conservatively and expose an optional `work domain` setting if needed.

Classification:
- internal if all known attendee emails share user's configured work domain.
- external if one or more attendees have a different non-consumer domain.
- ambiguous meetings default to "internal" for capture-rule evaluation only if user has not configured a work domain; show type as `Meeting`.

Do not let imperfect classification prevent manual overrides.

---

# 14. Capture policy engine

Create a pure domain function:

```ts
type CaptureDecision = {
  shouldCapture: boolean;
  reason:
    | "manual_override_enabled"
    | "manual_override_disabled"
    | "rule_all"
    | "rule_external"
    | "rule_internal"
    | "rule_none"
    | "no_meet_url"
    | "cancelled";
};
```

Input:
- user preferences,
- meeting classification,
- meeting override,
- meeting URL/status.

This must be deterministic and unit tested.

---

# 15. Capture abstraction

In `packages/core/src/capture`:

```ts
export interface CaptureProvider {
  schedule(input: ScheduleCaptureInput): Promise<ScheduleCaptureResult>;
  startNow(input: StartCaptureInput): Promise<StartCaptureResult>;
  stop(input: StopCaptureInput): Promise<void>;
  cancel(input: CancelCaptureInput): Promise<void>;
  getSession(providerSessionId: string): Promise<CaptureProviderSession>;
}
```

Domain types must not import Recall SDK types.

Example:

```ts
export type ScheduleCaptureInput = {
  meetingId: string;
  meetingUrl: string;
  title: string;
  startAt: Date;
  botDisplayName: string;
  metadata: Record<string, string>;
  consent: {
    enabled: boolean;
    message: string;
  };
};
```

---

# 16. Recall.ai adapter

Implement `RecallMeetCaptureProvider`.

## 16.1 Required behavior

For a scheduled Google Meet:
- create/schedule bot through current official Recall API/SDK,
- set branded bot name,
- associate internal meeting ID in metadata where provider supports it,
- enable recording,
- enable transcription,
- enable participant metadata,
- enable separate participant audio/transcript behavior when supported,
- configure webhooks,
- configure consent/chat message if provider supports it directly.

If exact provider API field names differ from this document, adapt the adapter only. Do not leak provider shapes elsewhere.

## 16.2 Bot name

Default:
`AI Notetaker`

Settings allow user customization:
`<First name>'s AI Notetaker`

Avoid impersonating Fathom.

## 16.3 Consent message

Default message:

> AI Notetaker is recording and transcribing this meeting to create notes and action items. Recording laws vary by location; the meeting host is responsible for obtaining any additional consent required.

Pin when provider supports pinning.

Persist `consent_message_sent_at` when confirmed.

## 16.4 Bot scheduling

Default lead:
- create provider bot early enough for provider scheduling,
- target meeting join at meeting start,
- display `joining` shortly before start.

Use Trigger.dev to ensure scheduling/cancellation calls are retryable.

## 16.5 Manual meeting

Authenticated user can paste a Google Meet URL and click `Add Notetaker`.

Flow:
- validate hostname/path,
- create manual meeting,
- call `startNow`,
- redirect to live meeting status page/workspace.

---

# 17. Meeting lifecycle state machine

The `Meeting.status` state machine is authoritative.

```text
scheduled
   │
   ▼
bot_queued
   │
   ▼
bot_starting
   │
   ├──────────────► failed
   ▼
waiting_for_admission
   │
   ├──────────────► denied
   ▼
recording
   │
   ├──────────────► failed
   ▼
ended
   │
   ▼
processing
   │
   ├──────────────► failed
   ▼
ready
```

Cancellation path:

```text
scheduled/bot_queued/bot_starting
   └──────────────► cancelled
```

Never move backward except through explicit provider reconciliation logic.

State changes should go through a service:
`MeetingLifecycleService.transition(...)`

Validate legal transitions.

## 17.1 User-facing language

| State | UI copy |
|---|---|
| scheduled | Notetaker scheduled |
| bot_queued | Preparing notetaker |
| bot_starting | Joining Google Meet |
| waiting_for_admission | Waiting for host approval |
| recording | Recording |
| ended | Meeting ended |
| processing | Preparing notes |
| ready | Notes ready |
| denied | Notetaker was not admitted |
| failed | Notetaker encountered an issue |
| cancelled | Recording cancelled |

---

# 18. Recall webhook handling

Endpoint:
`POST /api/webhooks/recall`

Requirements:
1. read raw request body,
2. verify provider signature using official mechanism,
3. reject invalid signatures,
4. normalize event,
5. idempotently insert `webhook_events`,
6. quickly return 2xx,
7. enqueue processing job,
8. never do long AI/media work inside webhook request.

Normalize events into internal event types such as:

```text
capture.bot.created
capture.bot.joining
capture.bot.waiting
capture.bot.recording
capture.participant.joined
capture.participant.left
capture.transcript.segment
capture.bot.done
capture.recording.ready
capture.transcript.ready
capture.bot.denied
capture.bot.failed
```

Map the provider's actual event names to these in one file.

Store append-only `bot_events` for diagnostics.

---

# 19. Live meeting experience

The authenticated meeting page should work before processing is complete.

When live, show a status header:

```text
● Recording · 24:18
8 participants
```

At minimum poll `/api/meetings/[id]/status` every 3 seconds while state is nonterminal.

If realtime transcript webhook data is available, append segments as they arrive.

Do not make realtime transcript a blocker for the product. Final transcript correctness is more important.

Live actions:
- `Highlight this moment`
- `Stop notetaker`
- participant count
- open calendar event metadata.

`Highlight this moment` during a live meeting creates a provisional highlight marker centered around current elapsed time, e.g.:
- start `elapsed - 15s`
- end `elapsed + 15s`
- user can refine after meeting.

---

# 20. Recording/media pipeline

## 20.1 Provider recording ready

When Recall indicates recording is available:
1. enqueue `ingest-recording`.
2. fetch provider recording through authenticated provider URL.
3. stream upload to private Supabase Storage.
4. never load full large recording into process memory.
5. persist storage path, mime type, and size.
6. if provider supplies multiple layouts, choose a sensible speaker/gallery recording consistent with demo UX.

## 20.2 Playback

Authenticated:
- server verifies ownership,
- returns short-lived signed Supabase Storage URL.

Public share:
- server verifies share token,
- returns short-lived signed URL.

Do not proxy a one-hour video through a Vercel function if direct signed object storage playback works.

## 20.3 Video format

Prefer browser-compatible MP4/H.264/AAC when provider exposes it.

Do not build custom HLS packaging unless required by actual provider output.

## 20.4 Clip playback

Clip pages reuse original recording.

Given:
- `startMs`
- `endMs`

Player behavior:
- seek to start on load,
- stop/pause at end,
- replay returns to start.

No clip rendering required.

---

# 21. Transcript ingestion

Normalize provider transcript into ordered `transcript_segments`.

Each segment must have:
- speaker,
- start/end milliseconds,
- text,
- sequence.

If provider returns words:
- group into readable utterances, roughly 1–3 sentences or speaker-turn segments.
- preserve timing.

If provider returns speaker IDs:
- map to `meeting_participants`.

If real participant name is unavailable:
- preserve stable `Speaker 1`, `Speaker 2`, etc.
- never hallucinate a real name.

After ingestion:
- set `transcript_status='complete'`,
- enqueue AI processing and embedding jobs.

---

# 22. Transcript UI

Requirements:
- virtualized list,
- current segment follows playback,
- click segment seeks player,
- speaker name visually distinct,
- timestamp displayed in `mm:ss` or `h:mm:ss`,
- search-in-transcript input,
- auto-follow can be temporarily disabled when user manually scrolls away.

Playback synchronization algorithm:
1. keep sorted arrays of segment `startMs` and `endMs`,
2. on video `timeupdate` no more than ~4–5x/sec,
3. binary search current time,
4. set active segment,
5. scroll active segment into view only if auto-follow enabled.

Do not trigger a React render on every animation frame.

---

# 23. AI processing pipeline

Trigger after complete transcript.

Pipeline:

```text
Transcript
   ↓
normalize / chunk
   ↓
structured extraction
   ├─ overview/key points
   ├─ topics
   ├─ decisions
   ├─ action items
   ├─ open questions
   └─ follow-ups
   ↓
evidence linking
   ↓
summary persistence
   ↓
embedding chunks
   ↓
meeting ready
```

Do not mark `Meeting.status='ready'` until:
- recording path exists or provider recording is permanently playable,
- transcript complete,
- default `general` summary generated,
- core action items/decisions generated.

Additional summary templates may generate on demand.

---

# 24. Transcript chunking for AI

For long meetings:
- divide transcript into semantic/time chunks around 5–10 minutes or 2,000–4,000 tokens.
- preserve segment IDs.
- do not split in the middle of a transcript segment.
- include speaker and timestamp markers in AI context.

Example chunk text:

```text
[18:42] Sarah Chen: We need the implementation complete before October.
[18:51] Ahmed Khan: The critical path is the Okta SSO integration.
...
```

For global structured extraction:
1. generate per-chunk candidate facts with evidence segment IDs,
2. reduce/merge candidates across chunks,
3. deduplicate action items/decisions,
4. preserve evidence IDs.

This is more reliable than passing an hour-long transcript to one giant prompt.

---

# 25. Structured AI schemas

Use Zod and provider structured output.

## 25.1 Extraction schema

```ts
const MeetingExtractionSchema = z.object({
  overview: z.string(),
  keyPoints: z.array(z.object({
    text: z.string(),
    evidenceSegmentIds: z.array(z.string()).min(1)
  })),
  topics: z.array(z.object({
    title: z.string(),
    summary: z.string(),
    evidenceSegmentIds: z.array(z.string()).min(1)
  })),
  decisions: z.array(z.object({
    text: z.string(),
    status: z.enum(["confirmed", "tentative"]),
    evidenceSegmentIds: z.array(z.string()).min(1)
  })),
  actionItems: z.array(z.object({
    text: z.string(),
    ownerName: z.string().nullable(),
    dueDate: z.string().nullable(),
    evidenceSegmentIds: z.array(z.string()).min(1)
  })),
  openQuestions: z.array(z.object({
    text: z.string(),
    evidenceSegmentIds: z.array(z.string()).min(1)
  })),
  followUps: z.array(z.object({
    text: z.string(),
    evidenceSegmentIds: z.array(z.string()).min(1)
  }))
});
```

Validate evidence IDs exist and belong to the meeting.

If model returns an invalid segment ID:
- drop that evidence reference,
- never create a fake timestamp.

## 25.2 Prompt rules

System-level extraction instructions must emphasize:
- use only transcript evidence,
- do not invent names, commitments, or dates,
- distinguish confirmed decisions from tentative discussion,
- do not turn every statement into an action item,
- action items should be concrete and assign owners only when transcript supports them,
- output concise professional language,
- evidence references are mandatory for substantive extracted items.

Store `prompt_version`.

---

# 26. Summary templates

Implement five:

## general

Sections:
- Overview
- Key points
- Decisions
- Action items
- Open questions / follow-ups

## sales

Sections:
- Customer context
- Goals
- Pain points
- Objections
- Requirements
- Buying signals
- Decisions
- Next steps

## one_on_one

Sections:
- Check-in
- Wins
- Challenges
- Feedback
- Decisions
- Commitments

## interview

Sections:
- Candidate overview
- Experience evidence
- Strengths discussed
- Concerns/gaps
- Candidate questions
- Follow-ups

Do not generate an automated hiring verdict.

## project

Sections:
- Progress
- Blockers
- Decisions
- Risks
- Owners/action items
- Next milestones

Default template: `general`.

When user switches to a template that has not been generated:
- optimistic tab selection,
- show `Generating…`,
- enqueue/generate,
- persist and cache.

---

# 27. Embeddings and semantic search

## 27.1 Chunking

Create embedding chunks around 500–1,000 tokens, respecting transcript segment boundaries.

Each chunk stores:
- text,
- segment IDs,
- start/end time,
- embedding.

## 27.2 Ask-this-meeting retrieval (P2)

For question:
1. embed question,
2. vector search only chunks for target meeting,
3. retrieve top 6–10,
4. optionally combine with keyword match,
5. generate answer using retrieved evidence,
6. require citations.

If evidence is insufficient:
say that the meeting does not clearly answer the question.

Do not answer from general model knowledge when the user is asking about a meeting.

## 27.3 Global search

P0 search must work with PostgreSQL full-text/keyword search across:
- meeting title,
- participant names,
- transcript,
- summary text.

Semantic embedding similarity is P2. Add it only after the required search experience is complete.

Search endpoint:
`GET /api/search?q=...`

Return grouped results:

```ts
type SearchResult = {
  meeting: {
    id: string;
    title: string;
    startsAt: string | null;
  };
  matchType: "title" | "participant" | "transcript" | "semantic" | "summary";
  snippet: string;
  startMs?: number;
  speakerName?: string;
  score: number;
};
```

Clicking transcript result opens:
`/app/meetings/[id]?t=<seconds>`

Player seeks on load.

---

# 28. Ask-this-meeting experience (P2)

UI:
- persistent input at top or bottom,
- suggested questions when thread empty,
- answer rendered with timestamp citation chips.

Example:

```text
Q: Why was the October launch considered risky?

The main risk was completing the Okta SSO integration in time.
Ahmed described SSO as being on the critical path [31:17], and
Sarah later said the pilot could not launch until implementation
was validated [37:42].
```

Citation click:
- switches to player if necessary,
- seeks exact timestamp,
- briefly highlights transcript segment.

Store question/answer thread for authenticated user.

Demo route may ship with 2–3 pre-seeded example Q&A entries but should also allow live querying if AI key is configured.

---

# 29. Highlights and clips

## 29.1 Post-meeting creation

Transcript supports range selection:
- simplest acceptable implementation: click first segment → `Start highlight`, click another later segment → `End highlight`.
- more polished implementation: text/segment selection range.

Create modal:
- title,
- optional description,
- type.

Save:
- startMs = first selected segment start,
- endMs = last selected segment end.

## 29.2 Live marker

`Highlight this moment` during recording creates a provisional time window.

## 29.3 Clip share

Create public `ShareLink(kind='clip')`.

Public page shows:
- clip title,
- meeting title,
- clip-only bounded player,
- optional excerpt transcript,
- no private unrelated meeting content.

---

# 30. Sharing

## 30.1 Meeting share

Authenticated user clicks `Share`:
- default private/no active link,
- `Create public link`,
- optional controls:
  - include transcript,
  - include summary.

Copy raw share URL once created.

## 30.2 Revoke

Revocation updates share link status. Existing URL immediately stops working.

## 30.3 Public meeting page

Show:
- meeting title/date/duration,
- player,
- summary if allowed,
- transcript if allowed,
- highlights if appropriate.

Hide:
- private app navigation,
- calendar data not related to meeting,
- user email unless intentionally displayed as owner attribution.

---

# 31. Manual add-notetaker flow

Route action or modal available from dashboard.

Fields:
- Google Meet URL,
- optional meeting title.

Validation:
- HTTPS,
- host `meet.google.com`,
- plausible meeting path.

On submit:
- create manual meeting,
- create capture session,
- start bot now,
- redirect meeting page.

This ensures the product is demoable even without waiting for a calendar event.

---

# 32. Chrome Meet companion (P1)

This companion makes the Google Meet interaction feel closer to Fathom while keeping implementation small. It is **not required for P0**, is **not** a recorder, and must not become a second application. Build it only after every P0 flow works in production.

## 32.1 Companion experience

When the user is on `meet.google.com/*`, identify the current Meet URL and query the backend for the matching meeting/capture session.

### Notetaker absent

```text
AI Notetaker
Not recording this meeting

[ Add Notetaker ]
```

### Joining

```text
AI Notetaker
Joining…
```

### Waiting

```text
AI Notetaker
Waiting for host approval
```

### Recording

```text
● Recording  24:18

[ Highlight ] [ Open Notes ]
[ Stop ]
```

Only show participant count if it is available without brittle Meet DOM scraping. Participant count is not required for the companion.

## 32.2 Behavior

`Add Notetaker`
- sends the current Google Meet URL to `/api/extension/add-notetaker`,
- reuses an existing meeting if the URL already matches one,
- otherwise creates a manual meeting,
- starts/schedules the Recall-backed visible bot.

`Highlight`
- creates a live moment marker around the current capture elapsed time,
- use the same provisional highlight behavior defined elsewhere.

`Open Notes`
- opens `/app/meetings/[meetingId]` in a new tab.

`Stop`
- asks for a simple confirmation,
- stops the current bot through the existing capture service.

## 32.3 Authentication

Keep authentication simple.

Preferred implementation:
- extension opens the web application for sign-in if no valid session exists,
- backend issues a short-lived extension token scoped to the signed-in user,
- token is stored using `chrome.storage.local`,
- no Google/Recall/API secret is ever embedded in the extension.

Do not create a complicated extension identity system.

## 32.4 Meeting identification

Use the current Meet URL as the primary identifier.

Do not make core functionality depend on Google Meet DOM selectors. Google can change them.

DOM observation is allowed only for nonessential polish and must fail silently.

## 32.5 Explicit exclusions

The companion must **not**:
- record tab audio/video,
- transcribe locally,
- maintain a second meeting database,
- scrape captions as the source of truth,
- require Chrome Web Store publication for the assessment.

It can be installed unpacked for the walkthrough if necessary. The public live link must remain fully usable without it.

---

# 33. UI states and empty states

## 33.1 No calendar connected

Dashboard card:
- title: `Connect your calendar`
- body: discover upcoming Google Meet calls and schedule your notetaker automatically.
- button: `Connect Google Calendar`
- secondary: `Add a Meet manually`

## 33.2 Calendar connected, no meetings

Show:
- next sync time,
- `Sync now`,
- manual add button,
- explanation that only Google Meet events appear.

## 33.3 Recording live

Show status strip and actions.

## 33.4 Processing

Meeting page skeleton should still show:
- title,
- attendees,
- recording status,
- transcript if already available.

Progress copy can be coarse:
- Uploading recording
- Finalizing transcript
- Creating notes

Do not fake precise percentage.

## 33.5 Denied

Explain:
- host may need to admit notetaker,
- some Meet settings block third-party bots,
- retry button if meeting still active.

## 33.6 Failed

Show:
- user-friendly message,
- retry when safe,
- `View meeting without notes` only if recording/transcript partial data exists.

---

# 34. API contracts

Use JSON and Zod validation.

## 34.1 GET `/api/meetings/[id]/status`

Response:

```json
{
  "id": "uuid",
  "status": "recording",
  "elapsedMs": 1458000,
  "participantCount": 8,
  "transcriptStatus": "partial",
  "canStop": true,
  "canHighlight": true
}
```

## 34.2 POST `/api/meetings/[id]/capture`

Body:
```json
{
  "mode": "start_now"
}
```

Response 202:
```json
{
  "meetingId": "uuid",
  "status": "bot_starting"
}
```

Idempotent if a live capture session already exists.

## 34.3 POST `/api/meetings/[id]/capture/stop`

Response 202:
```json
{
  "meetingId": "uuid",
  "status": "recording"
}
```

Provider stop is asynchronous; status updates through webhook.

## 34.4 POST `/api/meetings/[id]/ask`

Body:
```json
{
  "question": "What blocked the launch?"
}
```

Response:
```json
{
  "answer": "The primary blocker was...",
  "citations": [
    {
      "segmentId": "uuid",
      "startMs": 1882000,
      "speakerName": "Ahmed Khan",
      "quotePreview": "SSO is on the critical path..."
    }
  ]
}
```

## 34.5 POST `/api/meetings/[id]/highlights`

Body:
```json
{
  "title": "Launch blocker",
  "startMs": 1882000,
  "endMs": 1940000,
  "type": "highlight"
}
```

Validate times against meeting duration when known.

## 34.6 GET `/api/search`

Query:
`?q=pricing&limit=20`

Return stable typed results.

---

# 35. Server-side service layer

Create services, not giant route handlers:

```text
CalendarService
MeetingService
CaptureOrchestrationService
MeetingLifecycleService
TranscriptService
MeetingProcessingService
SummaryService
SearchService
AskMeetingService
HighlightService
ShareService
MediaService
```

Each service has unit-testable boundaries.

---

# 36. Background tasks

Under `packages/jobs`:

```text
calendar.sync
capture.schedule-upcoming
capture.start
capture.stop
capture.reconcile
recording.ingest
transcript.ingest
meeting.process
summary.generate
embeddings.generate
media.cleanup-temp
```

## 36.1 Idempotency

Every task must accept a stable idempotency key, typically:
- `calendar-sync:<connection-id>:<window>`
- `recording-ingest:<capture-session-id>`
- `meeting-process:<meeting-id>:<transcript-version>`
- `summary:<meeting-id>:<template>:<version>`

Do not duplicate action items or transcript segments on retry.

## 36.2 Retries

Retry:
- network failures,
- provider 5xx,
- rate limits,
- temporary storage failure.

Do not endlessly retry:
- revoked Google credentials,
- invalid meeting URL,
- bot explicitly denied,
- invalid webhook signature.

Use exponential backoff.

---

# 37. Meeting processing readiness

A meeting can become `ready` when:
- transcript complete,
- general summary exists,
- AI extraction completed,
- recording available for playback or clearly marked transcript-only fallback.

If recording ingestion fails but transcript is valid:
- keep `processing` until retries exhausted,
- then allow `ready` with a clear `Recording unavailable` state if transcript/AI are usable.
- record error details.

Product should degrade gracefully.

---

# 38. Seed/demo data

The deployment must never look empty.

Create `scripts/seed-demo.ts`.

Seed at least 10 meetings:

1. **Acme × Northstar — Enterprise Implementation Planning**
   - 1:03:24
   - 8 participants
   - hero meeting
   - detailed transcript
   - decisions
   - 6–10 action items
   - 4+ highlights
   - multiple topics
   - realistic disagreement and follow-ups

2. Weekly Product Sync
   - 38m
   - 6 participants

3. Customer Discovery — Redwood
   - 47m
   - 5 participants

4. Candidate Interview — Backend Engineer
   - 52m
   - 3 participants

5. Design Review
   - 34m
   - 5 participants

6. Founder 1:1
   - 41m
   - 2 participants

7. Sprint Planning
   - 56m
   - 7 participants

8. Customer Success Check-in
   - 29m
   - 4 participants

9. Pricing Review
   - 45m
   - 6 participants

10. Architecture Discussion
   - 1:01h
   - 8 participants

Use fictional people and companies.

## 38.1 Hero transcript

The hero meeting should contain at least several hundred transcript segments or enough realistic data to stress the UI.

Topics:
- launch timeline,
- Okta SSO,
- migration,
- security review,
- pricing,
- training,
- ownership,
- next steps.

Ensure AI/search demo queries have obvious supported answers.

## 38.2 Demo media

Use a rights-safe, generated, or self-recorded sample meeting video.

For seeded meetings where unique long recordings are unavailable:
- reuse one demo-safe recording for hero meeting only,
- other cards may be transcript-first with a short media asset or clearly marked demo recording.

The hero meeting should have playable media so transcript sync can be demonstrated.

Do not ship copyrighted third-party meeting recordings.

---

# 39. Search indexing strategy

On transcript completion:
1. update Postgres FTS on transcript segments,
2. generate embedding chunks,
3. index summary text via ordinary FTS or a combined search document.

Hybrid score can be simple:
- exact/title match boost,
- participant match boost,
- transcript FTS score,
- vector similarity.

Do not spend assessment time tuning an elaborate ranking model.

---

# 40. Security

## 40.1 Secrets

Never expose server secrets to browser bundles.

Private environment variables:
- database URLs,
- Supabase service key,
- Auth secret,
- Google client secret,
- OAuth encryption key,
- Recall API key/webhook secret,
- AI keys,
- Trigger secret,
- Sentry auth tokens.

Only `NEXT_PUBLIC_*` variables may reach client.

## 40.2 OAuth token encryption

`APP_ENCRYPTION_KEY`:
- 32-byte random key, base64 encoded.
- AES-256-GCM.
- unique random IV per encrypted value.
- store version + IV + auth tag + ciphertext in encoded string.

## 40.3 Webhooks

- verify signatures,
- rate limit invalid requests,
- idempotently process,
- never trust meeting IDs from webhook without mapping through provider bot ID/metadata.

## 40.4 Input validation

Zod on:
- route bodies,
- query parameters,
- provider normalized payloads where practical.

## 40.5 URL validation

Manual Meet URL:
- HTTPS only,
- hostname exactly `meet.google.com`,
- no javascript/data/file schemes.

## 40.6 Share tokens

- cryptographically random 32 bytes,
- hash at rest,
- revocable,
- optional expiry support.

## 40.7 Media

Private bucket only.
Signed URLs short-lived, e.g. 15–60 minutes.

## 40.8 Recording consent

The application must make recording visible and provide configurable consent messaging.

Add disclaimer in settings/terms:
- recording laws vary,
- user/host is responsible for legal consent requirements.

Do not silently record.

---

# 41. Privacy behavior

Provide account action:
- disconnect calendar.

On disconnect:
- revoke token where practical,
- mark connection disconnected,
- cancel future scheduled bots created solely from calendar auto-capture.

Do not automatically delete historical meetings.

No advertising/tracking SDK is required.

---

# 42. Reliability and reconciliation

Third-party webhooks can be delayed or missed.

Add periodic reconciliation job for active capture sessions:
- states: `bot_starting`, `waiting_for_admission`, `recording`, `ended`, `processing`.
- query provider for current session when local state is stale.
- do not hammer provider; e.g. every few minutes for active sessions.

If webhook and reconciliation disagree:
- favor provider terminal state if verified,
- preserve bot event history.

---

# 43. Error taxonomy

Use stable internal error codes:

```text
CALENDAR_REAUTH_REQUIRED
CALENDAR_SYNC_FAILED
MEETING_URL_INVALID
CAPTURE_CREATE_FAILED
CAPTURE_ADMISSION_DENIED
CAPTURE_PROVIDER_FAILED
RECORDING_INGEST_FAILED
TRANSCRIPT_INGEST_FAILED
AI_PROCESSING_FAILED
EMBEDDING_FAILED
MEDIA_UNAVAILABLE
SHARE_LINK_INVALID
SHARE_LINK_REVOKED
```

UI maps codes to friendly language.

Never show raw stack traces to users.

---

# 44. Logging

Structured log example:

```json
{
  "level": "info",
  "event": "capture.webhook.processed",
  "requestId": "req_...",
  "meetingId": "uuid",
  "captureSessionId": "uuid",
  "providerEventType": "bot.done"
}
```

Do not log:
- raw OAuth tokens,
- API keys,
- full transcript text in production logs,
- signed media URLs.

---

# 45. Sentry

Capture:
- route handler exceptions,
- background task exceptions,
- client rendering failures.

Tag events with:
- environment,
- route,
- meeting state where safe,
- provider.

Do not attach transcript content by default.

---

# 46. Performance

## 46.1 App

- Server Components by default.
- Client Components only for interactive sections.
- Lazy-load meeting transcript tab.
- Virtualize transcript.
- Paginate meeting library.
- Debounce global search ~250ms.
- Cache stable server data where safe.

## 46.2 Database

Required indexes:
- meetings user/start/status,
- transcript meeting/sequence/start,
- GIN FTS indexes,
- share token hash unique,
- capture provider bot ID unique,
- vector index appropriate to pgvector dataset size.

## 46.3 Media

Use direct signed object storage.
Do not base64 encode recordings.
Do not send media through React server components.

---

# 47. Accessibility

Minimum:
- keyboard-accessible controls,
- visible focus,
- semantic buttons/links,
- transcript timestamps are buttons,
- captions/transcript text readable at 200% zoom,
- status uses text not color alone,
- dialogs trap focus,
- player controls labeled,
- public share page keyboard usable.

---

# 48. Mobile/responsive behavior

The primary product is desktop-first because meetings are a desktop workflow.

Still support:
- mobile meeting library,
- responsive meeting page,
- player top,
- tab content below,
- sidebar becomes drawer.

Chrome extension is desktop Chrome only.

---

# 49. CI

`.github/workflows/ci.yml` on push/PR:

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Playwright E2E may run on main/PR if runtime allows.

Do not block deployment on flaky external Recall/Google live tests.

Provider integration tests should mock HTTP boundaries.

---

# 50. Testing strategy

## 50.1 Unit tests

Must cover:
- capture decision engine,
- lifecycle transition validation,
- share-token hashing/validation,
- transcript time lookup,
- highlight boundary validation,
- Google event normalization,
- provider event normalization,
- AI output validation/evidence filtering.

## 50.2 Integration tests

Must cover:
- webhook idempotency,
- recording-ready → ingest task scheduling,
- transcript-ready → processing task,
- share link access rules,
- calendar event update/reschedule behavior.

## 50.3 E2E

Playwright flows:

### E2E 1: Demo
- open `/`,
- click Explore Demo,
- open hero meeting,
- seek from transcript timestamp,
- switch summary section,
- open highlight.

### E2E 2: Authenticated seeded user
- sign in through test auth bypass only in test environment,
- meetings list,
- create/revoke share link,
- complete action item.

### E2E 3: Ask
- submit seeded deterministic ask request using mocked AI provider,
- citation click changes player time.

Do not require a real Google Meet to run CI.

---

# 51. Local development

Provide `.env.example`.

Start:
```bash
pnpm install
pnpm db:migrate
pnpm seed
pnpm dev
```

If local Postgres is not used, document Supabase dev project connection.

Provide mock adapters:
- `MockCaptureProvider`
- `MockAIProvider`

Feature env:
`USE_MOCK_INTEGRATIONS=true`

This enables full local app without spending provider credits.

Mock capture should simulate lifecycle events over a few seconds and attach seeded transcript/media.

Production must use Recall adapter.

---

# 52. Environment variables

`.env.example`:

```bash
# App
APP_URL=http://localhost:3000
NODE_ENV=development
AUTH_SECRET=
APP_ENCRYPTION_KEY=
USE_MOCK_INTEGRATIONS=false

# Database
DATABASE_URL=
DIRECT_DATABASE_URL=

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=meeting-media

# Google OAuth / Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/calendar/callback

# Recall
RECALL_API_KEY=
RECALL_WEBHOOK_SECRET=
RECALL_REGION=

# AI
AI_PROVIDER=openai
AI_API_KEY=
AI_CHAT_MODEL=
AI_EMBEDDING_MODEL=

# Trigger.dev
TRIGGER_SECRET_KEY=
TRIGGER_PROJECT_REF=

# Sentry
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_AUTH_TOKEN=
SENTRY_ORG=
SENTRY_PROJECT=

# Demo/test
DEMO_ENABLED=true
TEST_AUTH_BYPASS=false
```

If Auth.js Google login uses same Google client, share client credentials; callback URI configuration must include Auth.js callback and calendar callback.

Never commit `.env`.

---

# 53. Deployment architecture

## 53.1 Web

Deploy `apps/web` to Vercel.

## 53.2 Database/storage

Supabase production project:
- Postgres,
- pgvector,
- private Storage bucket.

## 53.3 Jobs

Trigger.dev production environment.

## 53.4 Provider configuration

Recall:
- production API key,
- webhook points to:
  `https://<domain>/api/webhooks/recall`

Google Cloud:
- OAuth consent configured,
- production redirect URIs,
- Calendar API enabled.

## 53.5 DNS

Use the provided Vercel domain if custom domain is not necessary.
The assessment needs a reliable public URL more than custom branding.

---

# 54. Production deployment checklist

Before submission:

- [ ] `/` opens logged out.
- [ ] Explore Demo works logged out.
- [ ] Google sign-in works.
- [ ] Google Calendar connection works.
- [ ] Upcoming Meet event sync works.
- [ ] Manual Meet URL works.
- [ ] Recall webhook verification works.
- [ ] Bot joins a real Google Meet.
- [ ] Admission waiting state is visible.
- [ ] Bot records after admission.
- [ ] Consent message is posted/pinned when configured.
- [ ] Meeting transitions to processing after end.
- [ ] Recording copies to private storage.
- [ ] Transcript ingests.
- [ ] Default summary generates.
- [ ] Action items/decisions generate.
- [ ] Meeting reaches ready.
- [ ] Player works.
- [ ] Transcript click seeks.
- [ ] Ask answer includes working timestamp citations.
- [ ] Highlights work.
- [ ] Meeting public share works logged out.
- [ ] Clip public share works logged out.
- [ ] Global search works.
- [ ] Seed data present.
- [ ] Hero one-hour/eight-person meeting present.
- [ ] Repository public.
- [ ] `.agent-logs/` committed incrementally.
- [ ] No secrets committed.
- [ ] README contains setup and architecture summary.
- [ ] Walkthrough URL can be added to submission separately.

---

# 55. README requirements

README should include:

1. product screenshot/GIF,
2. live link,
3. product description,
4. architecture summary,
5. tech stack,
6. setup instructions,
7. environment variables,
8. how meeting capture works,
9. explicit note that Recall.ai is used as meeting-bot infrastructure,
10. tradeoffs,
11. known limitations,
12. agent capture/logging note,
13. test commands.

Do not pretend the capture layer is self-hosted.

Using infrastructure is an intentional product judgment.

---

# 56. Build order

Claude Code should follow this order unless an implementation dependency forces a minor reorder.

## Phase 0 — repository compliance

1. Complete 8x agent capture setup from assessment.
2. Verify capture test.
3. Initialize repository/monorepo.
4. Commit `.agent-logs/`.
5. Add architecture.md.
6. Create `.env.example`.
7. Initial CI.

## Phase 1 — foundation

1. Next.js web app.
2. Tailwind/shadcn.
3. Drizzle schema/migrations.
4. Auth.js.
5. authenticated shell.
6. demo/public shell.
7. seed infrastructure.

## Phase 2 — demo-first UX

Before external integrations are complete:
1. seed 10 meetings,
2. build meetings library,
3. build hero meeting workspace,
4. player/transcript sync,
5. overview sections,
6. action item mutation,
7. highlight creation,
8. public share,
9. search UI,
10. Ask UI using mock AI.

This ensures the product is visually complete early.

## Phase 3 — Google Calendar

1. OAuth credentials storage/encryption.
2. connect/disconnect UI.
3. event normalization.
4. sync job.
5. upcoming calendar UI.
6. capture policy.
7. schedule/reschedule/cancel logic.

## Phase 4 — Recall bot

1. capture abstraction.
2. Recall adapter.
3. start/schedule/stop.
4. webhook verification.
5. webhook normalization.
6. lifecycle transitions.
7. live status polling.
8. real meeting smoke test.

## Phase 5 — ingestion

1. participant import.
2. transcript import.
3. recording streaming copy to Supabase Storage.
4. signed playback URLs.
5. state to processing.

## Phase 6 — AI

1. transcript chunking.
2. structured extraction.
3. evidence verification.
4. summary templates.
5. action items and required summary sections.
6. PostgreSQL full-text meeting/transcript search.
7. only after P0 is stable: embeddings and Ask-this-meeting (P2).

## Phase 7 — final polish; P1 Meet companion if P0 is stable

1. finish loading/empty/error states.
2. finish denied-admission UX.
3. responsive behavior and accessibility.
4. final E2E and public checks.
5. if and only if P0 is stable, implement the minimal Chrome Meet companion from Section 32.
6. verify `Add Notetaker`, `Highlight`, `Open Notes`, and `Stop` if the companion was built.
7. add Sentry/error monitoring if it does not delay submission.

Do not expand the companion beyond these controls.

---

# 57. Definition of done by feature

## Calendar

Done when:
- user connects Google Calendar,
- Meet events show up,
- updated/cancelled event sync is reflected,
- capture toggle affects scheduling.

## Bot

Done when:
- real Google Meet can receive visible bot,
- waiting/admitted/recording/failed states map correctly,
- stop action works,
- end event leads to processing.

## Recording

Done when:
- provider asset is copied to private storage,
- authenticated and shared players can stream it.

## Transcript

Done when:
- speakers/timestamps are correct enough to navigate,
- long transcript remains performant,
- clicking a segment seeks video,
- active segment follows playback.

## AI

P0 done when:
- general summary is generated,
- action items are generated,
- required summary template switching works,
- AI output does not invent unsupported owners/dates.

P2 done only if implemented:
- Ask answers cite real segment timestamps,
- insufficient evidence produces honest uncertainty.

## Search

Done when:
- query can find meetings by title/person/content,
- transcript result jumps to timestamp.

## Share

Done when:
- public link works in incognito/logged-out window,
- revocation works,
- clip link obeys time boundary.

---

# 58. Walkthrough-optimized product flow

Build the application so this five-minute walkthrough is smooth:

### 0:00–0:30
Landing page → dashboard → populated meetings.

### 0:30–1:15
Calendar page → show upcoming Google Meet → record toggle → explain auto-join.

### 1:15–1:45
Open a real Google Meet → bot requests entry → admit → show recording state in the web app. If the P1 Meet companion was built, briefly show its status/control surface without making the demo depend on it.

### 1:45–3:30
Open seeded one-hour eight-person hero meeting:
- player,
- transcript sync,
- click timestamp,
- overview,
- decisions/action items,
- switch summary template.

### 3:30–4:15
Ask:
`Why was the October launch at risk?`
Click timestamp citation.

### 4:15–4:40
Create/open highlight and copy public share link.

### 4:40–5:00
Global search for `SSO` or `pricing` and show cross-meeting result.

The product must be arranged so no awkward setup is required during the walkthrough.

---

# 59. Public demo behavior

`/demo` should resemble the real authenticated meeting library but be read-only.

Use an unobtrusive banner:
`Demo workspace — sign in to connect your calendar and record your own meetings.`

Buttons that require auth:
- Add Notetaker,
- create share link,
- edit action items,
- create highlight.

When clicked in demo:
- open sign-in modal/page rather than failing.

Ask can remain functional in demo if AI budget is acceptable; otherwise pre-seed example questions and allow a limited live request with rate limiting.

---

# 60. Rate limiting

Apply sensible limits to:
- public Ask requests,
- auth login callback abuse,
- manual bot create,
- search,
- share lookup.

Implementation may use Upstash Redis if already available, but do not add it solely for the assessment unless needed. A lightweight database-based rate limiter is acceptable for low traffic.

Webhook routes should not be throttled in a way that drops legitimate provider events; rely on signature verification and idempotency.

---

# 61. Recording timing and calendar edge cases

Handle:

## User joins late
Bot still joins at scheduled time according to auto-record rule unless cancelled.

## Event moved
Reschedule bot if provider supports; otherwise cancel and recreate safely.

## Event cancelled
Cancel pending bot.

## Meeting starts early
Manual `Add Notetaker` handles it.

## Meeting runs long
Do not stop at calendar end time automatically unless provider requires a max duration. Let bot remain until meeting ends or user stops it.

## Host never admits
Provider terminal/timeout event → `denied` or `failed` with useful UX.

## User leaves while others remain
For this assessment, do not forcibly remove bot based solely on owner's participant presence unless Recall/provider behavior makes it simple. User can stop from app/extension. This is safer than brittle presence inference.

---

# 62. Data retention

For assessment:
- retain recordings until manually deleted or provider/storage policy requires otherwise.
- no automatic deletion UI required.

However provider recording URLs are not treated as permanent. Copy to our storage.

---

# 63. Meeting deletion

Optional but straightforward:
- authenticated owner can delete meeting,
- delete/revoke share links,
- delete storage object,
- cascade domain rows,
- record audit log.

If implementing deletion creates risk close to deadline, it is lower priority than core sharing/search/AI.

---

# 64. AI provider failure behavior

If AI key missing or provider down:
- transcript and recording still work,
- meeting can show `Notes unavailable` with retry,
- do not mark capture failed.

If only embeddings fail:
- keyword search still works,
- Ask may use keyword retrieval fallback.

AI is a subsystem, not the meeting's source of truth.

---

# 65. AI cost controls

- cache generated summaries.
- do not regenerate same template unless user explicitly requests refresh.
- store embedding chunks.
- Ask retrieves only relevant chunks.
- do not send full hour-long transcript for each question.
- cap public demo Ask frequency.

---

# 66. Search fallback

If pgvector/model configuration is unavailable:
- use Postgres FTS only.
- product must remain usable.

Implement semantic search as enhancement over stable keyword search, not a hard dependency.

---

# 67. Data serialization

API timestamps: ISO 8601 UTC strings.
Durations/timeline: integer milliseconds.

Never mix seconds and milliseconds in domain models.

Create helpers:
- `formatDuration(ms)`
- `formatTimestamp(ms)`
- `parseTimeQueryParam(t)`.

---

# 68. Player deep linking

Meeting route supports:
`?t=1882`

On load:
- parse seconds,
- once metadata loaded, seek,
- highlight nearest transcript segment.

Search and AI citations should use this deep link behavior.

---

# 69. Transcript search within meeting

Transcript tab includes local search.

For loaded transcript:
- client-side text search is acceptable for a single meeting.
- navigate between matches.
- selecting match seeks player.

Global search remains server-side.

---

# 70. Action items

UI:
- checkbox,
- owner,
- optional due date,
- evidence timestamp chip.

When AI extracts owner:
- map to participant only if name confidently matches.
- otherwise store ownerName text only.

User can check/uncheck action item.
Do not build full task manager.

---

# 71. Decisions

Render separately from action items.

Decision row:
- statement,
- confirmed/tentative badge,
- one or more evidence timestamps.

Do not allow AI to label normal discussion as confirmed without support.

---

# 72. Topics/chapters

Use topics to create navigation above/below player.

Each topic can have:
- title,
- short summary,
- start timestamp.

Click topic seeks player.

AI should infer time range from first/last evidence segment.

---

# 73. Meeting header

Header includes:
- title,
- date/time,
- duration,
- attendee avatars/initials,
- status,
- Share button,
- overflow actions.

For live meeting:
- status visible before all other metadata.

---

# 74. Loading strategy

Meeting page:
- server-render meeting header,
- suspense/lazy load player URL,
- tabs load independently,
- transcript fetch may be paginated if extremely large, but one-hour text is usually manageable when virtualized.

Do not block entire page on AI summary.

---

# 75. State management

Prefer:
- server state: TanStack Query,
- local UI state: React state/context,
- no global Redux/Zustand unless genuinely needed.

Player time can live in a small meeting-player context.

---

# 76. Coding conventions

- strict TypeScript,
- no `any` except isolated provider adapter escape hatches with comments,
- domain enums centralized,
- no magic status strings across UI,
- all external responses normalized,
- Zod at boundaries,
- services return typed domain objects,
- route handlers remain thin,
- React components generally <300 lines,
- extract complex meeting workspace pieces.

Suggested component tree:

```text
MeetingWorkspace
├── MeetingHeader
├── MeetingStatusBanner
├── MeetingVideoPlayer
├── MeetingTabs
│   ├── OverviewTab
│   │   ├── SummaryCard
│   │   ├── TopicList
│   │   ├── DecisionList
│   │   ├── ActionItemList
│   │   └── HighlightList
│   ├── TranscriptTab
│   │   ├── TranscriptSearch
│   │   └── VirtualTranscript
│   └── AskTab
│       ├── AskThread
│       ├── AskCitation
│       └── AskComposer
└── HighlightDialog
```

---

# 77. Provider normalization principle

No UI or domain file should contain code like:

```ts
if (recallBot.status === "xyz_provider_specific_status") ...
```

Only adapter/normalizer knows provider statuses.

Internal statuses are authoritative.

This is required so a future capture provider can replace Recall.

---

# 78. Provider metadata

Store only provider metadata useful for:
- debugging,
- reconciliation,
- asset lookup.

Never make business logic depend on opaque JSON when normalized columns exist.

---

# 79. Future capture provider support

Do not implement now, but architecture must allow:

```text
RecallMeetCaptureProvider
SelfHostedMeetBotProvider
ChromeTabCaptureProvider
GoogleMeetMediaProvider
```

All should eventually produce the same internal outputs:
- lifecycle events,
- participants,
- recording,
- transcript.

---

# 80. Failure-safe demo strategy

The real bot is part of the product, but the walkthrough must not depend on a live one-hour processing cycle.

Keep:
- real short live meeting for capture proof,
- preprocessed seeded hero meeting for product-depth demonstration.

This is intentional.

---

# 81. Assessment-specific repository behavior

Because the assessment explicitly inspects agent use:

- `.agent-logs/` must exist from the beginning.
- commit logs throughout development.
- meaningful commit sequence preferred:
  - chore: initialize agent capture
  - feat: scaffold web app
  - feat: meeting workspace
  - feat: calendar sync
  - feat: recall capture
  - feat: transcript processing
  - feat: ai meeting intelligence
  - feat: sharing and search
  - chore: production polish

Do not rewrite history to make logs appear cleaner.

---

# 82. Secrets and public repository

Before every push:
- scan for `.env`,
- Google secrets,
- Recall keys,
- AI keys,
- Supabase service role key.

Use `.gitignore`.

Add a lightweight secret scanner in CI if convenient.

The repository must be safe to make public.

---

# 83. Suggested implementation interfaces

## Capture

```ts
interface CaptureProvider {
  schedule(input: ScheduleCaptureInput): Promise<CaptureSessionRef>;
  startNow(input: StartCaptureInput): Promise<CaptureSessionRef>;
  stop(providerSessionId: string): Promise<void>;
  cancel(providerSessionId: string): Promise<void>;
  get(providerSessionId: string): Promise<CaptureProviderSession>;
}
```

## AI

```ts
interface MeetingIntelligenceProvider {
  extractMeeting(input: MeetingExtractionInput): Promise<MeetingExtraction>;
  generateSummary(input: SummaryGenerationInput): Promise<TemplateSummary>;
  answerQuestion(input: AskMeetingInput): Promise<AskMeetingAnswer>;
  embed(texts: string[]): Promise<number[][]>;
}
```

## Storage

```ts
interface MediaStorage {
  putStream(input: {
    path: string;
    stream: ReadableStream | NodeJS.ReadableStream;
    contentType: string;
  }): Promise<StoredObject>;

  createSignedReadUrl(path: string, expiresInSeconds: number): Promise<string>;
  delete(path: string): Promise<void>;
}
```

## Calendar

```ts
interface CalendarProvider {
  syncEvents(input: CalendarSyncInput): Promise<CalendarSyncResult>;
  refreshAccessToken(...): Promise<...>;
}
```

---

# 84. Manual QA matrix

Before final handoff, manually test:

| Scenario | Expected |
|---|---|
| Logged-out landing | loads |
| Explore demo | opens seeded meetings |
| Hero meeting | media + transcript |
| Transcript click | seeks |
| Video playback | active transcript follows |
| Ask question | evidence citations |
| Citation click | seeks |
| Highlight | bounded clip |
| Share meeting | works incognito |
| Revoke share | incognito link stops |
| Google login | succeeds |
| Calendar connect | succeeds |
| Calendar sync | Meet event appears |
| Auto-record disabled | no bot scheduled |
| Per-meeting override enabled | bot scheduled |
| Manual Meet | bot starts |
| Bot waiting | UI reflects |
| Bot admitted | recording reflects |
| End call | processing begins |
| Recording ingest | playback available |
| Transcript ingest | segments visible |
| AI extraction | summary/actions/decisions |
| Search transcript | returns jump result |
| Bot denied | useful state |
| Calendar token invalid | reconnect banner |
| Provider webhook replay | no duplicates |

---

# 85. Known limitations to state honestly

README/walkthrough may mention:

- Google Meet only.
- Third-party bot admission depends on Google Meet host settings.
- Product uses Recall.ai for capture infrastructure.
- Chrome extension is intentionally only a lightweight Meet companion; the visible Recall-backed bot is the recording engine.
- Summary/Ask quality depends on transcript/provider quality.
- Consent requirements vary by jurisdiction.

These are acceptable and demonstrate judgment.

---

# 86. Final implementation directive

Build the product as though it will be manually explored by a product-minded engineer immediately after deployment.

The final result should prioritize, in this order:
1. **the literal assessment/Fathom flow working end to end,**
2. **real visible Google Meet bot capture,**
3. **recording playback synchronized with transcript,**
4. **summary templates + action items + highlights,**
5. **public meeting/clip sharing,**
6. **cross-meeting search,**
7. **evidence-linked Ask where it improves the experience,**
8. **graceful failure states.**

If schedule pressure appears, simplify secondary infrastructure before cutting any assessment-named flow.

Do not spend time adding unrelated integrations or enterprise scaffolding.

When an implementation detail is ambiguous:
- choose the simplest production-sensible path consistent with this architecture,
- preserve the defined domain contracts,
- do not ask for product preference,
- document any provider-specific adaptation in code comments/README,
- keep moving.

The target experience is:

```text
Google Calendar
      ↓
meeting is known automatically
      ↓
user joins Google Meet normally
      ↓
[P1: small Meet companion can show notetaker state/controls]
      ↓
real visible AI notetaker joins
      ↓
recording + speaker-aware transcript
      ↓
automatic processing
      ↓
recording playback synchronized with transcript
      ↓
summary templates + action items + highlights
      ↓
search + public sharing
      ↓
[P2: Ask with timestamp evidence]
```

That is the product. Do not add complexity merely because a full commercial Fathom product has more surfaces. Build the flows the assessment explicitly asks the evaluator to experience, and make those flows excellent.
