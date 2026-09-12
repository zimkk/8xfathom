import { getDb } from '@fathom/db'
import {
  meetings,
  meetingParticipants,
  transcriptSegments,
  meetingSummaries,
  actionItems,
  decisions,
  topics,
  highlights,
  shareLinks,
  captureSessions,
} from '@fathom/db/schema'
import { eq, desc, and, or, inArray } from 'drizzle-orm'
import type { MeetingStatus } from '@fathom/core'

export interface MeetingWithParticipants {
  id: string
  title: string
  startsAt: Date | null
  endsAt: Date | null
  durationMs: number | null
  status: string
  transcriptStatus: string
  visibility: string
  source: string
  meetingUrl: string | null
  recordingStoragePath: string | null
  participants: Array<{
    id: string
    displayName: string
    email: string | null
    isHost: boolean
  }>
  _count?: {
    actionItems: number
    highlights: number
  }
}

export async function getMeetingsForUser(userId: string, limit = 20) {
  const db = getDb()
  const rows = await db
    .select()
    .from(meetings)
    .where(eq(meetings.userId, userId))
    .orderBy(desc(meetings.startsAt))
    .limit(limit)

  return rows
}

export async function getDemoMeetings(limit = 20) {
  const db = getDb()
  const rows = await db
    .select()
    .from(meetings)
    .where(eq(meetings.visibility, 'demo'))
    .orderBy(desc(meetings.startsAt))
    .limit(limit)

  return rows
}

export async function getMeetingById(meetingId: string, userId?: string) {
  const db = getDb()
  // Unauthenticated callers can only see demo meetings — never private ones
  const conditions = userId
    ? and(eq(meetings.id, meetingId), or(eq(meetings.userId, userId), eq(meetings.visibility, 'demo')))
    : and(eq(meetings.id, meetingId), eq(meetings.visibility, 'demo'))

  const [meeting] = await db.select().from(meetings).where(conditions).limit(1)
  return meeting ?? null
}

export async function getMeetingParticipants(meetingId: string) {
  const db = getDb()
  return db
    .select()
    .from(meetingParticipants)
    .where(eq(meetingParticipants.meetingId, meetingId))
    .orderBy(desc(meetingParticipants.isHost)) // hosts first
}

export async function getTranscriptSegments(meetingId: string) {
  const db = getDb()
  return db
    .select()
    .from(transcriptSegments)
    .where(eq(transcriptSegments.meetingId, meetingId))
    .orderBy(transcriptSegments.sequence)
}

export async function getMeetingSummary(meetingId: string, templateKey = 'general') {
  const db = getDb()
  const [summary] = await db
    .select()
    .from(meetingSummaries)
    .where(
      and(
        eq(meetingSummaries.meetingId, meetingId),
        eq(meetingSummaries.templateKey, templateKey)
      )
    )
    .orderBy(desc(meetingSummaries.version))
    .limit(1)
  return summary ?? null
}

export async function getMeetingActionItems(meetingId: string) {
  const db = getDb()
  return db
    .select()
    .from(actionItems)
    .where(eq(actionItems.meetingId, meetingId))
    .orderBy(actionItems.createdAt)
}

export async function getMeetingDecisions(meetingId: string) {
  const db = getDb()
  return db.select().from(decisions).where(eq(decisions.meetingId, meetingId))
}

export async function getMeetingTopics(meetingId: string) {
  const db = getDb()
  return db
    .select()
    .from(topics)
    .where(eq(topics.meetingId, meetingId))
    .orderBy(topics.sortOrder)
}

export async function getMeetingHighlights(meetingId: string) {
  const db = getDb()
  return db
    .select()
    .from(highlights)
    .where(eq(highlights.meetingId, meetingId))
    .orderBy(highlights.startMs)
}

export async function getActiveCaptureSession(meetingId: string) {
  const db = getDb()
  const [session] = await db
    .select()
    .from(captureSessions)
    .where(eq(captureSessions.meetingId, meetingId))
    .orderBy(desc(captureSessions.createdAt))
    .limit(1)
  return session ?? null
}

export async function updateActionItemStatus(
  actionItemId: string,
  status: 'open' | 'done',
  userId: string
) {
  const db = getDb()
  const [item] = await db.update(actionItems).set({ status, updatedAt: new Date() }).where(eq(actionItems.id, actionItemId)).returning()
  return item ?? null
}

export async function createHighlight(data: {
  meetingId: string
  userId: string
  title: string
  description?: string
  startMs: number
  endMs: number
  type: 'highlight' | 'decision' | 'action' | 'moment'
  source: 'user' | 'ai' | 'extension'
}) {
  const db = getDb()
  const [highlight] = await db.insert(highlights).values(data).returning()
  return highlight!
}
