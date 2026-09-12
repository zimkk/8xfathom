import type {
  MeetingIntelligenceProvider,
  MeetingExtractionInput,
  MeetingExtraction,
  SummaryGenerationInput,
  TemplateSummary,
  AskMeetingInput,
  AskMeetingAnswer,
} from '@fathom/core/ai'

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

  private buildTranscriptChunk(
    segments: Array<{ id: string; speakerName: string; startMs: number; endMs: number; text: string }>
  ): string {
    return segments.map((s) => {
      const totalSec = Math.round(s.startMs / 1000)
      const min = Math.floor(totalSec / 60)
      const sec = totalSec % 60
      const timestamp = `${min}:${sec.toString().padStart(2, '0')}`
      return `[seg:${s.id}][${timestamp}] ${s.speakerName}: ${s.text}`
    }).join('\n')
  }

  async extractMeeting(input: MeetingExtractionInput): Promise<MeetingExtraction> {
    const CHUNK_SIZE = 50
    const { segments } = input
    const validSegmentIds = new Set(segments.map((s) => s.id))

    // Chunk long transcripts and merge results
    const chunks: typeof segments[] = []
    if (segments.length <= CHUNK_SIZE) {
      chunks.push(segments)
    } else {
      for (let i = 0; i < segments.length; i += CHUNK_SIZE) {
        chunks.push(segments.slice(i, i + CHUNK_SIZE))
      }
    }

    const allResults: MeetingExtraction[] = []
    for (const chunk of chunks) {
      const transcriptText = this.buildTranscriptChunk(chunk)
      const prompt = `Analyze this meeting transcript and extract structured information.
Each segment is labeled [seg:ID] — include these IDs in evidenceSegmentIds arrays (min 1 per item).

Meeting title: ${input.title}

Transcript:
${transcriptText}

Return a JSON object with exactly this shape:
{
  "overview": "string",
  "keyPoints": [{"text": "string", "evidenceSegmentIds": ["seg-id"]}],
  "topics": [{"title": "string", "summary": "string", "evidenceSegmentIds": ["seg-id"]}],
  "decisions": [{"text": "string", "status": "confirmed"|"tentative", "evidenceSegmentIds": ["seg-id"]}],
  "actionItems": [{"text": "string", "ownerName": "string|null", "dueDate": "string|null", "evidenceSegmentIds": ["seg-id"]}],
  "openQuestions": [{"text": "string", "evidenceSegmentIds": ["seg-id"]}],
  "followUps": [{"text": "string", "evidenceSegmentIds": ["seg-id"]}]
}

Return only valid JSON.`

      const response = await this.chat([{ role: 'user', content: prompt }])
      try {
        allResults.push(JSON.parse(response) as MeetingExtraction)
      } catch {
        // Skip malformed chunks rather than failing entirely
      }
    }

    if (allResults.length === 0) throw new Error('Failed to parse any AI extraction response')

    // Merge chunk results
    const first = allResults[0]!
    const merged: MeetingExtraction = {
      overview: first.overview ?? '',
      keyPoints: allResults.flatMap((r) => r.keyPoints ?? []),
      topics: allResults.flatMap((r) => r.topics ?? []),
      decisions: allResults.flatMap((r) => r.decisions ?? []),
      actionItems: allResults.flatMap((r) => r.actionItems ?? []),
      openQuestions: allResults.flatMap((r) => r.openQuestions ?? []),
      followUps: allResults.flatMap((r) => r.followUps ?? []),
    }

    // Drop invalid evidence segment IDs
    const dropInvalidIds = <T extends { evidenceSegmentIds: string[] }>(items: T[]): T[] =>
      items.map((item) => ({
        ...item,
        evidenceSegmentIds: item.evidenceSegmentIds.filter((id) => validSegmentIds.has(id)),
      }))

    return {
      ...merged,
      keyPoints: dropInvalidIds(merged.keyPoints),
      topics: dropInvalidIds(merged.topics),
      decisions: dropInvalidIds(merged.decisions),
      actionItems: dropInvalidIds(merged.actionItems),
      openQuestions: dropInvalidIds(merged.openQuestions),
      followUps: dropInvalidIds(merged.followUps),
    }
  }

  async generateSummary(input: SummaryGenerationInput): Promise<TemplateSummary> {
    const templateInstructions: Record<string, string> = {
      general: 'Provide a balanced summary covering main discussion points, decisions, and action items.',
      sales: 'Focus on customer needs, objections, next steps, and deal progression.',
      one_on_one: 'Focus on personal development, goals, feedback, and follow-ups.',
      interview: 'Focus on candidate qualifications, responses, and hiring recommendation.',
      project: 'Focus on project status, blockers, milestones, and team assignments.',
    }

    const instruction = templateInstructions[input.templateKey] ?? templateInstructions['general']!
    const transcriptText = input.segments
      .map((s) => `${s.speakerName}: ${s.text}`)
      .join('\n')

    const response = await this.chat([{
      role: 'user',
      content: `${instruction}\n\nMeeting: ${input.title}\n\nTranscript:\n${transcriptText}\n\nReturn JSON: {"overview": "string", "sections": [{"title": "string", "content": "string"}]}`,
    }])

    try {
      const parsed = JSON.parse(response) as { overview?: string; sections?: Array<{ title: string; content: string }> }
      return {
        templateKey: input.templateKey,
        overview: parsed.overview ?? response,
        sections: parsed.sections ?? [{ title: 'Summary', content: response }],
        modelProvider: 'openai',
        modelName: this.model,
        promptVersion: 'v1',
      }
    } catch {
      return {
        templateKey: input.templateKey,
        overview: response,
        sections: [{ title: 'Summary', content: response }],
        modelProvider: 'openai',
        modelName: this.model,
        promptVersion: 'v1',
      }
    }
  }

  async answerQuestion(input: AskMeetingInput): Promise<AskMeetingAnswer> {
    const context = input.relevantSegments
      .map((s) => `[seg:${s.id}][${Math.round(s.startMs / 1000)}s] ${s.speakerName}: ${s.text}`)
      .join('\n')

    const response = await this.chat([
      {
        role: 'system',
        content: 'You are a meeting assistant. Answer questions based on the transcript. Be concise and cite specific moments with their segment IDs.',
      },
      {
        role: 'user',
        content: `Question: ${input.question}\n\nTranscript context:\n${context}\n\nAnswer with citations in this JSON format: { "answer": "string", "citations": [{ "segmentId": "string", "startMs": number, "speakerName": "string", "quotePreview": "string" }] }`,
      },
    ])

    try {
      return JSON.parse(response) as AskMeetingAnswer
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
