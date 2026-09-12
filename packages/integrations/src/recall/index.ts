import type {
  CaptureProvider,
  CaptureSessionRef,
  CaptureProviderSession,
  ScheduleCaptureInput,
  StartCaptureInput,
  StopCaptureInput,
  CancelCaptureInput,
} from '@fathom/core/capture'

function getHeaders(): Record<string, string> {
  const key = process.env['RECALL_API_KEY']
  if (!key) throw new Error('RECALL_API_KEY not configured')
  return {
    Authorization: `Token ${key}`,
    'Content-Type': 'application/json',
  }
}

function getBaseUrl(): string {
  const region = process.env['RECALL_REGION'] ?? 'us-east-1'
  return `https://${region}.recall.ai/api/v1`
}

export class RecallCaptureProvider implements CaptureProvider {
  readonly name = 'recall'

  async schedule(input: ScheduleCaptureInput): Promise<CaptureSessionRef> {
    const baseUrl = getBaseUrl()
    const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000'

    const res = await fetch(`${baseUrl}/bot`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        meeting_url: input.meetingUrl,
        bot_name: input.botDisplayName ?? 'Fathom Notetaker',
        join_at: input.startAt.toISOString(),
        webhook_url: `${appUrl}/api/webhooks/recall`,
        recording_config: {
          transcript: { provider: { meeting_captions: {} } },
        },
        // Real-time transcript segments delivered via webhook during the call
        real_time_transcription: {
          destination_url: `${appUrl}/api/webhooks/recall`,
          partial_results: false,
        },
        metadata: { meetingId: input.meetingId, ...input.metadata },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Recall API error ${res.status}: ${err}`)
    }

    const bot = await res.json() as { id: string }
    return { providerSessionId: bot.id, providerBotId: bot.id }
  }

  async startNow(input: StartCaptureInput): Promise<CaptureSessionRef> {
    return this.schedule({
      ...input,
      startAt: new Date(),
    })
  }

  async stop(input: StopCaptureInput): Promise<void> {
    const baseUrl = getBaseUrl()
    await fetch(`${baseUrl}/bot/${input.providerSessionId}/leave_call`, {
      method: 'POST',
      headers: getHeaders(),
    })
  }

  async cancel(input: CancelCaptureInput): Promise<void> {
    const baseUrl = getBaseUrl()
    await fetch(`${baseUrl}/bot/${input.providerSessionId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
  }

  async getSession(providerSessionId: string): Promise<CaptureProviderSession> {
    const baseUrl = getBaseUrl()
    const res = await fetch(`${baseUrl}/bot/${providerSessionId}`, {
      headers: getHeaders(),
    })
    if (!res.ok) {
      throw new Error(`Recall getSession error ${res.status}`)
    }

    const bot = await res.json() as {
      id: string
      status_changes: Array<{ code: string; created_at: string }>
      video_url?: string
      transcript_url?: string
    }

    const statusMap: Record<string, CaptureProviderSession['status']> = {
      joining_call: 'joining',
      waiting_for_admission: 'waiting',
      in_call_not_recording: 'joining',
      in_call_recording: 'recording',
      call_ended: 'done',
      done: 'done',
      analysis_in_progress: 'done',
      analysis_done: 'done',
      error: 'failed',
      recording_permission_denied: 'denied',
      timeout_waiting_for_meeting_start: 'failed',
      timeout_waiting_for_admission: 'denied',
    }

    const rawStatus = bot.status_changes?.[bot.status_changes.length - 1]?.code ?? 'created'
    const status = statusMap[rawStatus] ?? 'created'

    return {
      providerSessionId: bot.id,
      providerBotId: bot.id,
      status,
      recordingUrl: bot.video_url,
      transcriptAvailable: !!bot.transcript_url,
    }
  }

  async getTranscript(providerBotId: string): Promise<Array<{
    speaker: string
    startMs: number
    endMs: number
    text: string
  }>> {
    const baseUrl = getBaseUrl()
    const res = await fetch(`${baseUrl}/bot/${providerBotId}/transcript`, {
      headers: getHeaders(),
    })
    if (!res.ok) return []

    const data = await res.json() as Array<{
      speaker: string
      words: Array<{ start_time: number; end_time: number; text: string }>
    }>

    return data.map((segment) => {
      const words = segment.words ?? []
      const startMs = Math.round((words[0]?.start_time ?? 0) * 1000)
      const endMs = Math.round((words[words.length - 1]?.end_time ?? 0) * 1000)
      return {
        speaker: segment.speaker,
        startMs,
        endMs,
        text: words.map((w) => w.text).join(' '),
      }
    })
  }
}

export function getRecallProvider(): RecallCaptureProvider {
  return new RecallCaptureProvider()
}
