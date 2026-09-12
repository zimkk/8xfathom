import { getDb } from '@fathom/db'
import { meetings, transcriptSegments, meetingSummaries, actionItems, decisions, topics } from '@fathom/db/schema'
import { eq, asc } from 'drizzle-orm'

type TemplateKey = 'general' | 'sales' | 'one_on_one' | 'interview' | 'project'

export async function runSummaryGenerate(
  meetingId: string,
  templateKey: TemplateKey = 'general',
): Promise<{ success: boolean; error?: string }> {
  const db = getDb()

  const [meeting] = await db.select({ title: meetings.title }).from(meetings).where(eq(meetings.id, meetingId)).limit(1)
  if (!meeting) return { success: false, error: 'Meeting not found' }

  const segments = await db
    .select()
    .from(transcriptSegments)
    .where(eq(transcriptSegments.meetingId, meetingId))
    .orderBy(asc(transcriptSegments.sequence))

  if (segments.length === 0) {
    return { success: false, error: 'No transcript segments' }
  }

  const { OpenAIMeetingIntelligenceProvider } = await import('@fathom/integrations')
  const ai = new OpenAIMeetingIntelligenceProvider()

  const segmentsForAI = segments.map((s) => ({
    id: s.id,
    speakerName: s.speakerName ?? 'Unknown',
    startMs: s.startMs,
    endMs: s.endMs,
    text: s.text,
  }))

  const extracted = await ai.extractMeeting({ meetingId, title: meeting.title, segments: segmentsForAI, templateKey })

  const existing = await db
    .select({ id: meetingSummaries.id })
    .from(meetingSummaries)
    .where(eq(meetingSummaries.meetingId, meetingId))
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(meetingSummaries)
      .set({ overview: extracted.overview, structuredJson: extracted, updatedAt: new Date() })
      .where(eq(meetingSummaries.meetingId, meetingId))
  } else {
    await db.insert(meetingSummaries).values({
      meetingId,
      templateKey,
      version: 1,
      overview: extracted.overview,
      structuredJson: extracted,
      modelProvider: 'openai',
      modelName: process.env['AI_CHAT_MODEL'] ?? 'gpt-4o',
      promptVersion: 'v1',
    })
  }

  if (extracted.actionItems?.length > 0) {
    await db.delete(actionItems).where(eq(actionItems.meetingId, meetingId))
    await db.insert(actionItems).values(
      extracted.actionItems.map((item: { text: string; ownerName?: string | null; evidenceSegmentIds?: string[] }) => ({
        meetingId,
        text: item.text,
        ownerName: item.ownerName ?? null,
        evidenceSegmentIds: item.evidenceSegmentIds ?? [],
        source: 'ai' as const,
        status: 'open' as const,
      })),
    )
  }

  if (extracted.decisions?.length > 0) {
    await db.delete(decisions).where(eq(decisions.meetingId, meetingId))
    await db.insert(decisions).values(
      extracted.decisions.map((d: { text: string; status?: 'confirmed' | 'tentative'; evidenceSegmentIds?: string[] }) => ({
        meetingId,
        text: d.text,
        status: d.status ?? 'confirmed',
        evidenceSegmentIds: d.evidenceSegmentIds ?? [],
      })),
    )
  }

  if (extracted.topics?.length > 0) {
    await db.delete(topics).where(eq(topics.meetingId, meetingId))
    await db.insert(topics).values(
      extracted.topics.map(
        (
          t: { title: string; summary?: string; startMs?: number; endMs?: number; evidenceSegmentIds?: string[] },
          i: number,
        ) => ({
          meetingId,
          title: t.title,
          summary: t.summary ?? '',
          startMs: t.startMs ?? 0,
          endMs: t.endMs ?? 0,
          evidenceSegmentIds: t.evidenceSegmentIds ?? [],
          sortOrder: i,
        }),
      ),
    )
  }

  await db
    .update(meetings)
    .set({ status: 'ready', processingErrorCode: null, processingErrorMessage: null, updatedAt: new Date() })
    .where(eq(meetings.id, meetingId))

  return { success: true }
}
