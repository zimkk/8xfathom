import { z } from 'zod'
import type { SummaryTemplateKey } from '../domain/types.js'

export const MeetingExtractionSchema = z.object({
  overview: z.string(),
  keyPoints: z.array(
    z.object({
      text: z.string(),
      evidenceSegmentIds: z.array(z.string()).min(1),
    })
  ),
  topics: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      evidenceSegmentIds: z.array(z.string()).min(1),
    })
  ),
  decisions: z.array(
    z.object({
      text: z.string(),
      status: z.enum(['confirmed', 'tentative']),
      evidenceSegmentIds: z.array(z.string()).min(1),
    })
  ),
  actionItems: z.array(
    z.object({
      text: z.string(),
      ownerName: z.string().nullable(),
      dueDate: z.string().nullable(),
      evidenceSegmentIds: z.array(z.string()).min(1),
    })
  ),
  openQuestions: z.array(
    z.object({
      text: z.string(),
      evidenceSegmentIds: z.array(z.string()).min(1),
    })
  ),
  followUps: z.array(
    z.object({
      text: z.string(),
      evidenceSegmentIds: z.array(z.string()).min(1),
    })
  ),
})

export type MeetingExtraction = z.infer<typeof MeetingExtractionSchema>

export interface TranscriptSegmentForAI {
  id: string
  speakerName: string
  startMs: number
  endMs: number
  text: string
}

export interface MeetingExtractionInput {
  meetingId: string
  title: string
  segments: TranscriptSegmentForAI[]
  templateKey?: SummaryTemplateKey
}

export interface TemplateSummarySection {
  title: string
  content: string
  evidenceSegmentIds?: string[]
}

export interface TemplateSummary {
  templateKey: SummaryTemplateKey
  overview: string
  sections: TemplateSummarySection[]
  modelProvider: string
  modelName: string
  promptVersion: string
}

export interface SummaryGenerationInput {
  meetingId: string
  title: string
  segments: TranscriptSegmentForAI[]
  templateKey: SummaryTemplateKey
  existingExtraction?: MeetingExtraction
}

export interface AskCitation {
  segmentId: string
  startMs: number
  speakerName: string
  quotePreview: string
}

export interface AskMeetingAnswer {
  answer: string
  citations: AskCitation[]
}

export interface AskMeetingInput {
  meetingId: string
  question: string
  relevantSegments: TranscriptSegmentForAI[]
}

export interface MeetingIntelligenceProvider {
  extractMeeting(input: MeetingExtractionInput): Promise<MeetingExtraction>
  generateSummary(input: SummaryGenerationInput): Promise<TemplateSummary>
  answerQuestion(input: AskMeetingInput): Promise<AskMeetingAnswer>
  embed(texts: string[]): Promise<number[][]>
}
