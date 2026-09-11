import type {
  CaptureProvider,
  ScheduleCaptureInput,
  StartCaptureInput,
  CaptureSession,
} from '@fathom/core/capture/provider'

const RECALL_BASE_URL = 'https://us-east-1.recall.ai/api/v1'

function getHeaders(): Record<string, string> {
  const key = process.env['RECALL_API_KEY']
  if (!key) throw new Error('RECALL_API_KEY not configured')
  return {
    Authorization: `Token ${key}`,
    'Content-Type': 'application/json',
  }
}

export class RecallCaptureProvider implements CaptureProvider {
  readonly name = 'recall'

  async schedule(input: ScheduleCaptureInput): Promise<CaptureSession> {
    const region = process.env['RECALL_REGION'] ?? 'us-east-1'
    const baseUrl = `https://${region}.recall.ai/api/v1`
    const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000'

    const res = await fetch(`${baseUrl}/bot`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        meeting_url: input.meetingUrl,
        bot_name: 'Fathom Notetaker',
        join_at: input.scheduledStart.toISOString(),
        webhook_url: `${appUrl}/api/webhooks/recall`,
        recording_config: {
          transcript: { provider: { meeting_captions: {} } },
        },
        metadata: { meetingId: input.meetingId },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Recall API error ${res.status}: ${err}`)
    }

    const bot = await res.json() as { id: string; status_changes?: Array<{ code: string }> }
    return { providerBotId: bot.id, status: 'scheduled' }
  }

  async startNow(input: StartCaptureInput): Promise<CaptureSession> {
    return this.schedule({
      meetingId: input.meetingId,
      meetingUrl: input.meetingUrl,
      scheduledStart: new Date(),
    })
  }

  async stop(providerBotId: string): Promise<void> {
    const region = process.env['RECALL_REGION'] ?? 'us-east-1'
    const baseUrl = `https://${region}.recall.ai/api/v1`
    await fetch(`${baseUrl}/bot/${providerBotId}/leave_call`, {
      method: 'POST',
      headers: getHeaders(),
    })
  }

  async cancel(providerBotId: string): Promise<void> {
    const region = process.env['RECALL_REGION'] ?? 'us-east-1'
    const baseUrl = `https://${region}.recall.ai/api/v1`
    await fetch(`${baseUrl}/bot/${providerBotId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    })
  }

  async getSession(providerBotId: string): Promise<CaptureSession | null> {
    const region = process.env['RECALL_REGION'] ?? 'us-east-1'
    const baseUrl = `https://${region}.recall.ai/api/v1`
    const res = await fetch(`${baseUrl}/bot/${providerBotId}`, {
      headers: getHeaders(),
    })
    if (!res.ok) return null

    const bot = await res.json() as {
      id: string
      status_changes: Array<{ code: string; created_at: string }>
      video_url?: string
    }

    const latestStatus = bot.status_changes?.[bot.status_changes.length - 1]?.code ?? 'unknown'
    return { providerBotId: bot.id, status: latestStatus, videoUrl: bot.video_url }
  }

  async getTranscript(providerBotId: string): Promise<Array<{
    speaker: string
    startMs: number
    endMs: number
    text: string
  }>> {
    const region = process.env['RECALL_REGION'] ?? 'us-east-1'
    const baseUrl = `https://${region}.recall.ai/api/v1`
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
