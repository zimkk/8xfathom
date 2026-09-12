export type MeetingStatus =
  | 'scheduled'
  | 'bot_queued'
  | 'bot_starting'
  | 'waiting_for_admission'
  | 'recording'
  | 'ended'
  | 'processing'
  | 'ready'
  | 'denied'
  | 'failed'
  | 'cancelled'

export type CaptureSessionStatus =
  | 'created'
  | 'scheduled'
  | 'joining'
  | 'waiting'
  | 'recording'
  | 'done'
  | 'denied'
  | 'failed'
  | 'cancelled'

export type CalendarConnectionStatus = 'connected' | 'needs_reauth' | 'disconnected' | 'error'

export type MeetingPlatform = 'google_meet'

export type MeetingSource = 'calendar' | 'manual' | 'seed'

export type MeetingVisibility = 'private' | 'demo'

export type TranscriptStatus = 'pending' | 'partial' | 'complete' | 'failed'

export type CaptureOverride = 'inherit' | 'enabled' | 'disabled'

export type CaptureMode = 'all' | 'external_only' | 'internal_only' | 'none'

export type MeetingClassification = 'internal' | 'external' | 'ambiguous'

export type ActionItemStatus = 'open' | 'done'

export type ActionItemSource = 'ai' | 'user'

export type DecisionStatus = 'confirmed' | 'tentative'

export type HighlightType = 'highlight' | 'decision' | 'action' | 'moment'

export type HighlightSource = 'user' | 'ai' | 'extension'

export type ShareLinkKind = 'meeting' | 'clip'

export type ShareLinkStatus = 'active' | 'revoked'

export type CalendarProvider = 'google'

export type MeetingCalendarEventStatus = 'confirmed' | 'tentative' | 'cancelled'

export type MeetingPlatformType = 'google_meet' | 'unknown'

export type AskMessageRole = 'user' | 'assistant'

export type WebhookEventStatus = 'received' | 'processed' | 'ignored' | 'failed'

export type SummaryTemplateKey =
  | 'general'
  | 'sales'
  | 'one_on_one'
  | 'interview'
  | 'project'

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'Notetaker scheduled',
  bot_queued: 'Preparing notetaker',
  bot_starting: 'Joining Google Meet',
  waiting_for_admission: 'Waiting for host approval',
  recording: 'Recording',
  ended: 'Meeting ended',
  processing: 'Preparing notes',
  ready: 'Notes ready',
  denied: 'Notetaker was not admitted',
  failed: 'Notetaker encountered an issue',
  cancelled: 'Recording cancelled',
}

export const TERMINAL_MEETING_STATUSES: MeetingStatus[] = [
  'ready',
  'denied',
  'failed',
  'cancelled',
]

export const ACTIVE_CAPTURE_STATUSES: MeetingStatus[] = [
  'bot_queued',
  'bot_starting',
  'waiting_for_admission',
  'recording',
]

export const SUMMARY_TEMPLATE_LABELS: Record<SummaryTemplateKey, string> = {
  general: 'General',
  sales: 'Sales',
  one_on_one: '1:1',
  interview: 'Interview',
  project: 'Project',
}

export interface CaptureDecision {
  shouldCapture: boolean
  reason:
    | 'manual_override_enabled'
    | 'manual_override_disabled'
    | 'rule_all'
    | 'rule_external'
    | 'rule_internal'
    | 'rule_none'
    | 'no_meet_url'
    | 'cancelled'
}

export interface CaptureDecisionInput {
  defaultMode: CaptureMode
  classification: MeetingClassification
  override: CaptureOverride
  meetingUrl: string | null
  isCancelled: boolean
}

function emailDomain(email: string): string {
  return email.trim().toLowerCase().split('@')[1] ?? ''
}

/**
 * internal: every attendee shares the signed-in user's email domain.
 * external: at least one attendee is on a different domain.
 * ambiguous: no attendee emails were available to compare (e.g. calendar sync
 * didn't record any, or the event has no other attendees).
 */
export function classifyMeeting(attendeeEmails: string[], userEmail: string): MeetingClassification {
  const userDomain = emailDomain(userEmail)
  const otherDomains = attendeeEmails
    .filter((email) => emailDomain(email) !== userDomain)
    .map(emailDomain)

  if (attendeeEmails.length === 0 || !userDomain) return 'ambiguous'
  return otherDomains.length > 0 ? 'external' : 'internal'
}

export function evaluateCaptureDecision(input: CaptureDecisionInput): CaptureDecision {
  if (input.isCancelled) {
    return { shouldCapture: false, reason: 'cancelled' }
  }
  if (!input.meetingUrl) {
    return { shouldCapture: false, reason: 'no_meet_url' }
  }
  if (input.override === 'enabled') {
    return { shouldCapture: true, reason: 'manual_override_enabled' }
  }
  if (input.override === 'disabled') {
    return { shouldCapture: false, reason: 'manual_override_disabled' }
  }
  switch (input.defaultMode) {
    case 'all':
      return { shouldCapture: true, reason: 'rule_all' }
    case 'none':
      return { shouldCapture: false, reason: 'rule_none' }
    case 'external_only':
      return {
        shouldCapture: input.classification === 'external',
        reason: 'rule_external',
      }
    case 'internal_only':
      return {
        shouldCapture: input.classification !== 'external',
        reason: 'rule_internal',
      }
  }
}

export const VALID_MEETING_TRANSITIONS: Record<MeetingStatus, MeetingStatus[]> = {
  scheduled: ['bot_queued', 'cancelled'],
  bot_queued: ['bot_starting', 'failed', 'cancelled'],
  bot_starting: ['waiting_for_admission', 'recording', 'failed', 'cancelled'],
  waiting_for_admission: ['recording', 'denied', 'failed'],
  recording: ['ended', 'failed'],
  ended: ['processing'],
  processing: ['ready', 'failed'],
  ready: [],
  denied: [],
  failed: [],
  cancelled: [],
}

export function isValidMeetingTransition(
  from: MeetingStatus,
  to: MeetingStatus
): boolean {
  return VALID_MEETING_TRANSITIONS[from]?.includes(to) ?? false
}

export const ERROR_CODES = {
  CALENDAR_REAUTH_REQUIRED: 'CALENDAR_REAUTH_REQUIRED',
  CALENDAR_SYNC_FAILED: 'CALENDAR_SYNC_FAILED',
  MEETING_URL_INVALID: 'MEETING_URL_INVALID',
  CAPTURE_CREATE_FAILED: 'CAPTURE_CREATE_FAILED',
  CAPTURE_ADMISSION_DENIED: 'CAPTURE_ADMISSION_DENIED',
  CAPTURE_PROVIDER_FAILED: 'CAPTURE_PROVIDER_FAILED',
  RECORDING_INGEST_FAILED: 'RECORDING_INGEST_FAILED',
  TRANSCRIPT_INGEST_FAILED: 'TRANSCRIPT_INGEST_FAILED',
  AI_PROCESSING_FAILED: 'AI_PROCESSING_FAILED',
  EMBEDDING_FAILED: 'EMBEDDING_FAILED',
  MEDIA_UNAVAILABLE: 'MEDIA_UNAVAILABLE',
  SHARE_LINK_INVALID: 'SHARE_LINK_INVALID',
  SHARE_LINK_REVOKED: 'SHARE_LINK_REVOKED',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  CALENDAR_REAUTH_REQUIRED: 'Your Google Calendar connection needs to be renewed.',
  CALENDAR_SYNC_FAILED: 'Could not sync your calendar. Please try again.',
  MEETING_URL_INVALID: 'The Google Meet URL is not valid.',
  CAPTURE_CREATE_FAILED: 'Could not schedule the notetaker for this meeting.',
  CAPTURE_ADMISSION_DENIED: 'The notetaker was not admitted to the meeting.',
  CAPTURE_PROVIDER_FAILED: 'The notetaker encountered an unexpected issue.',
  RECORDING_INGEST_FAILED: 'Could not retrieve the recording.',
  TRANSCRIPT_INGEST_FAILED: 'Could not process the transcript.',
  AI_PROCESSING_FAILED: 'Could not generate notes for this meeting.',
  EMBEDDING_FAILED: 'Could not index meeting content for search.',
  MEDIA_UNAVAILABLE: 'The recording is not available.',
  SHARE_LINK_INVALID: 'This share link is not valid.',
  SHARE_LINK_REVOKED: 'This share link has been revoked.',
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function formatTimestamp(ms: number): string {
  return formatDuration(ms)
}

export function parseTimeQueryParam(t: string | null | undefined): number | null {
  if (!t) return null
  const seconds = parseFloat(t)
  if (isNaN(seconds) || seconds < 0) return null
  return seconds
}

export function validateGoogleMeetUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'meet.google.com' &&
      parsed.pathname.length > 1
    )
  } catch {
    return false
  }
}
