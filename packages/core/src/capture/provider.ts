export interface ScheduleCaptureInput {
  meetingId: string
  meetingUrl: string
  title: string
  startAt: Date
  botDisplayName: string
  metadata: Record<string, string>
  consent: {
    enabled: boolean
    message: string
  }
}

export interface StartCaptureInput {
  meetingId: string
  meetingUrl: string
  title: string
  botDisplayName: string
  metadata: Record<string, string>
  consent: {
    enabled: boolean
    message: string
  }
}

export interface StopCaptureInput {
  providerSessionId: string
}

export interface CancelCaptureInput {
  providerSessionId: string
}

export interface CaptureSessionRef {
  providerSessionId: string
  providerBotId: string
  scheduledFor?: Date
}

export type CaptureProviderStatus =
  | 'created'
  | 'scheduled'
  | 'joining'
  | 'waiting'
  | 'recording'
  | 'done'
  | 'denied'
  | 'failed'
  | 'cancelled'

export interface CaptureProviderSession {
  providerSessionId: string
  providerBotId: string
  status: CaptureProviderStatus
  joinedAt?: Date
  recordingStartedAt?: Date
  recordingEndedAt?: Date
  leftAt?: Date
  failureCode?: string
  failureMessage?: string
  participantCount?: number
  elapsedMs?: number
  recordingUrl?: string
  transcriptAvailable?: boolean
}

export interface CaptureProvider {
  schedule(input: ScheduleCaptureInput): Promise<CaptureSessionRef>
  startNow(input: StartCaptureInput): Promise<CaptureSessionRef>
  stop(input: StopCaptureInput): Promise<void>
  cancel(input: CancelCaptureInput): Promise<void>
  getSession(providerSessionId: string): Promise<CaptureProviderSession>
}

export type InternalCaptureEventType =
  | 'capture.bot.created'
  | 'capture.bot.joining'
  | 'capture.bot.waiting'
  | 'capture.bot.recording'
  | 'capture.participant.joined'
  | 'capture.participant.left'
  | 'capture.transcript.segment'
  | 'capture.bot.done'
  | 'capture.recording.ready'
  | 'capture.transcript.ready'
  | 'capture.bot.denied'
  | 'capture.bot.failed'

export interface NormalizedCaptureEvent {
  type: InternalCaptureEventType
  providerBotId: string
  occurredAt: Date
  payload: Record<string, unknown>
}
