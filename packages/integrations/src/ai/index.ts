import type { MeetingIntelligenceProvider } from '@fathom/core/ai/provider'

export class OpenAIMeetingIntelligenceProvider implements MeetingIntelligenceProvider {
  private model: string
  private embeddingModel: string

  constructor() {
    this.model = process.env['AI_CHAT_MODEL'] ?? 'gpt-4o'
    this.embeddingModel = process.env['AI_EMBEDDING_MODEL'] ?? 'text-embedding-3-small'
  }

  private async chat(messages: Array<{ role: string; content: string }>): Promise<string> {
    const apiKey = process.env['AI_API_KEY']
    if (!apiKey) throw new Error('AI_API_KEY not configured')

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.3,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI API error ${res.status}: ${err}`)
    }

    const data = await res.json() as { choices: Array<{ message: { content: string } }> }
    return data.choices[0]?.message.content ?? ''
  }

  async extractMeeting(input: {
    transcript: Array<{ speaker: string; startMs: number; endMs: number; text: string }>
    templateKey?: string
  }) {
    const transcriptText = input.transcript
      .map((s) => `[${Math.round(s.startMs / 1000)}s] ${s.speaker}: ${s.text}`)
      .join('\n')

    const prompt = `Analyze this meeting transcript and extract structured information.

Transcript:
${transcriptText}

Return a JSON object with:
- title: string (concise meeting title)
- summary: string (2-3 sentence overview)
- keyPoints: string[] (up to 8 key points)
- decisions: Array<{text: string, status: "confirmed"|"tentative"}>
- actionItems: Array<{text: string, ownerName: string|null, dueDateText: string|null}>
- topics: Array<{title: string, startMs: number, endMs: number}>
- highlights: Array<{text: string, startMs: number, endMs: number, speakerName: string}>

Return only valid JSON.`

    const response = await this.chat([{ role: 'user', content: prompt }])
    try {
      return JSON.parse(response)
    } catch {
      throw new Error('Failed to parse AI extraction response')
    }
  }

  async generateSummary(input: {
    transcript: Array<{ speaker: string; startMs: number; endMs: number; text: string }>
    templateKey: string
  }): Promise<string> {
    const templateInstructions: Record<string, string> = {
      general: 'Provide a balanced summary covering main discussion points, decisions, and action items.',
      sales: 'Focus on customer needs, objections, next steps, and deal progression.',
      one_on_one: 'Focus on personal development, goals, feedback, and follow-ups.',
      interview: 'Focus on candidate qualifications, responses, and hiring recommendation.',
      project: 'Focus on project status, blockers, milestones, and team assignments.',
    }

    const instruction = templateInstructions[input.templateKey] ?? templateInstructions['general']!
    const transcriptText = input.transcript
      .map((s) => `${s.speaker}: ${s.text}`)
      .join('\n')

    const response = await this.chat([{
      role: 'user',
      content: `${instruction}\n\nTranscript:\n${transcriptText}\n\nProvide the summary:`,
    }])

    return response
  }

  async answerQuestion(input: {
    meetingId: string
    question: string
    relevantSegments: Array<{ id: string; speakerName: string | null; startMs: number; endMs: number; text: string }>
  }) {
    const context = input.relevantSegments
      .map((s) => `[${Math.round(s.startMs / 1000)}s] ${s.speakerName ?? 'Unknown'}: ${s.text}`)
      .join('\n')

    const response = await this.chat([
      {
        role: 'system',
        content: 'You are a meeting assistant. Answer questions based on the transcript. Be concise and cite specific moments.',
      },
      {
        role: 'user',
        content: `Question: ${input.question}\n\nTranscript context:\n${context}\n\nAnswer with citations in this JSON format: { "answer": string, "citations": [{ "segmentId": string, "speakerName": string, "startMs": number, "quote": string }] }`,
      },
    ])

    try {
      return JSON.parse(response)
    } catch {
      return { answer: response, citations: [] }
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const apiKey = process.env['AI_API_KEY']
    if (!apiKey) throw new Error('AI_API_KEY not configured')

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: texts,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`OpenAI Embeddings error ${res.status}: ${err}`)
    }

    const data = await res.json() as { data: Array<{ embedding: number[] }> }
    return data.data.map((d) => d.embedding)
  }
}

export function getOpenAIProvider(): OpenAIMeetingIntelligenceProvider {
  return new OpenAIMeetingIntelligenceProvider()
}
