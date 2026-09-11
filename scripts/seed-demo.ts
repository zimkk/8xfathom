#!/usr/bin/env npx tsx
/**
 * Demo seed script — populates the database with realistic seeded meetings
 * including the hero one-hour 8-person meeting.
 *
 * Usage: pnpm seed:demo
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq } from 'drizzle-orm'
import * as schema from '../packages/db/src/schema/index.js'
import { HERO_PARTICIPANTS, HERO_TRANSCRIPT, HERO_SUMMARY, SEED_MEETINGS } from './seed-data.js'

const DATABASE_URL = process.env['DATABASE_URL']
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required')
  process.exit(1)
}

const client = postgres(DATABASE_URL)
const db = drizzle(client, { schema })

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(10, 0, 0, 0)
  return d
}

function daysFromNow(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(14, 0, 0, 0)
  return d
}

async function seedHeroMeeting() {
  console.log('Seeding hero meeting: Acme × Northstar Enterprise Implementation Planning...')

  const heroStartsAt = daysAgo(3)
  const heroEndsAt = new Date(heroStartsAt.getTime() + 63 * 60 * 1000 + 24 * 1000)

  // Create the meeting
  const [meeting] = await db
    .insert(schema.meetings)
    .values({
      source: 'seed',
      title: 'Acme × Northstar — Enterprise Implementation Planning',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      startsAt: heroStartsAt,
      endsAt: heroEndsAt,
      actualStartedAt: heroStartsAt,
      actualEndedAt: heroEndsAt,
      durationMs: 63 * 60 * 1000 + 24 * 1000,
      platform: 'google_meet',
      status: 'ready',
      captureEnabled: true,
      captureOverride: 'inherit',
      visibility: 'demo',
      transcriptStatus: 'complete',
    })
    .returning()

  if (!meeting) throw new Error('Failed to create hero meeting')
  console.log(`  Created meeting: ${meeting.id}`)

  // Participants
  const participantRecords = await Promise.all(
    HERO_PARTICIPANTS.map((p, i) =>
      db
        .insert(schema.meetingParticipants)
        .values({
          meetingId: meeting.id,
          displayName: p.name,
          email: p.email,
          isHost: p.isHost ?? false,
          firstJoinedAt: heroStartsAt,
          lastLeftAt: heroEndsAt,
          speakingMs: Math.floor(Math.random() * 600000 + 120000),
        })
        .returning()
        .then((r) => r[0]!)
    )
  )
  console.log(`  Created ${participantRecords.length} participants`)

  const participantByName = new Map(
    participantRecords.map((p) => [p.displayName, p])
  )

  // Transcript segments
  const segmentRecords = await Promise.all(
    HERO_TRANSCRIPT.map((seg, i) => {
      const participant = participantByName.get(seg.speaker)
      return db
        .insert(schema.transcriptSegments)
        .values({
          meetingId: meeting.id,
          participantId: participant?.id,
          speakerName: seg.speaker,
          startMs: seg.startMs,
          endMs: seg.endMs,
          text: seg.text,
          confidence: 0.95 + Math.random() * 0.05,
          source: 'seed',
          sequence: i + 1,
        })
        .returning()
        .then((r) => r[0]!)
    })
  )
  console.log(`  Created ${segmentRecords.length} transcript segments`)

  const segmentBySeq = new Map(segmentRecords.map((s) => [s.sequence, s]))
  const getSegIdsByMs = (startMs: number, endMs: number): string[] => {
    return segmentRecords
      .filter((s) => s.startMs >= startMs && s.endMs <= endMs + 30000)
      .slice(0, 3)
      .map((s) => s.id)
  }

  // Summary
  const [summary] = await db
    .insert(schema.meetingSummaries)
    .values({
      meetingId: meeting.id,
      templateKey: 'general',
      version: 1,
      overview: HERO_SUMMARY.overview,
      structuredJson: {
        overview: HERO_SUMMARY.overview,
        keyPoints: HERO_SUMMARY.keyPoints.map((text, i) => ({
          text,
          evidenceSegmentIds: getSegIdsByMs(i * 80000, i * 80000 + 40000),
        })),
        openQuestions: [],
        followUps: [],
      },
      modelProvider: 'seed',
      modelName: 'seed-data',
      promptVersion: 'v1',
    })
    .returning()
  console.log(`  Created summary: ${summary?.id}`)

  // Decisions
  for (const decision of HERO_SUMMARY.decisions) {
    const evidenceIds = getSegIdsByMs(300000, 600000)
    await db.insert(schema.decisions).values({
      meetingId: meeting.id,
      text: decision.text,
      status: decision.status,
      evidenceSegmentIds: evidenceIds,
    })
  }
  console.log(`  Created ${HERO_SUMMARY.decisions.length} decisions`)

  // Action items
  for (const item of HERO_SUMMARY.actionItems) {
    const evidenceIds = getSegIdsByMs(100000, 700000)
    await db.insert(schema.actionItems).values({
      meetingId: meeting.id,
      text: item.text,
      ownerName: item.owner,
      dueDate: item.dueDate,
      status: 'open',
      evidenceSegmentIds: evidenceIds.slice(0, 2),
      source: 'ai',
    })
  }
  console.log(`  Created ${HERO_SUMMARY.actionItems.length} action items`)

  // Topics
  for (let i = 0; i < HERO_SUMMARY.topics.length; i++) {
    const topic = HERO_SUMMARY.topics[i]!
    const evidenceIds = getSegIdsByMs(topic.startMs, topic.endMs)
    await db.insert(schema.topics).values({
      meetingId: meeting.id,
      title: topic.title,
      summary: topic.summary,
      startMs: topic.startMs,
      endMs: topic.endMs,
      evidenceSegmentIds: evidenceIds,
      sortOrder: i,
    })
  }
  console.log(`  Created ${HERO_SUMMARY.topics.length} topics`)

  // Highlights
  for (const hl of HERO_SUMMARY.highlights) {
    await db.insert(schema.highlights).values({
      meetingId: meeting.id,
      title: hl.title,
      startMs: hl.startMs,
      endMs: hl.endMs,
      type: 'highlight',
      source: 'ai',
    })
  }
  console.log(`  Created ${HERO_SUMMARY.highlights.length} highlights`)

  console.log(`  ✓ Hero meeting seeded: ${meeting.id}`)
  return meeting
}

async function seedAdditionalMeeting(
  data: (typeof SEED_MEETINGS)[0],
  daysOffset: number
) {
  const startsAt = daysAgo(daysOffset)
  const endsAt = new Date(startsAt.getTime() + data.durationMs)

  const [meeting] = await db
    .insert(schema.meetings)
    .values({
      source: 'seed',
      title: data.title,
      meetingUrl: `https://meet.google.com/${Math.random().toString(36).slice(2, 11)}`,
      startsAt,
      endsAt,
      actualStartedAt: startsAt,
      actualEndedAt: endsAt,
      durationMs: data.durationMs,
      platform: 'google_meet',
      status: 'ready',
      captureEnabled: true,
      captureOverride: 'inherit',
      visibility: 'demo',
      transcriptStatus: 'complete',
    })
    .returning()

  if (!meeting) throw new Error(`Failed to create meeting: ${data.title}`)

  // Participants
  await Promise.all(
    data.participants.map((p) =>
      db.insert(schema.meetingParticipants).values({
        meetingId: meeting.id,
        displayName: p.name,
        email: p.email,
        isHost: p.isHost ?? false,
        firstJoinedAt: startsAt,
        lastLeftAt: endsAt,
        speakingMs: Math.floor(data.durationMs / data.participants.length),
      })
    )
  )

  // Summary
  await db.insert(schema.meetingSummaries).values({
    meetingId: meeting.id,
    templateKey: 'general',
    version: 1,
    overview: data.summary,
    structuredJson: {
      overview: data.summary,
      keyPoints: [],
      openQuestions: [],
      followUps: [],
    },
    modelProvider: 'seed',
    modelName: 'seed-data',
    promptVersion: 'v1',
  })

  // Action items
  for (const item of data.actionItems) {
    await db.insert(schema.actionItems).values({
      meetingId: meeting.id,
      text: item.text,
      ownerName: item.owner,
      status: 'open',
      evidenceSegmentIds: [],
      source: 'ai',
    })
  }

  // Add a few transcript segments for demo
  const numSegments = 20
  const segDuration = Math.floor(data.durationMs / numSegments)
  for (let i = 0; i < numSegments; i++) {
    const participant = data.participants[i % data.participants.length]!
    await db.insert(schema.transcriptSegments).values({
      meetingId: meeting.id,
      speakerName: participant.name,
      startMs: i * segDuration,
      endMs: (i + 1) * segDuration - 1000,
      text: `[Transcript segment ${i + 1} — demo data for ${data.title}]`,
      confidence: 0.95,
      source: 'seed',
      sequence: i + 1,
    })
  }

  console.log(`  ✓ Seeded: ${data.title}`)
  return meeting
}

async function main() {
  console.log('🌱 Starting demo seed...\n')

  try {
    // Check if already seeded
    const existing = await db
      .select({ id: schema.meetings.id })
      .from(schema.meetings)
      .where(eq(schema.meetings.visibility, 'demo'))
      .limit(1)

    if (existing.length > 0) {
      console.log('Demo data already exists. Skipping seed.')
      console.log('To re-seed, delete existing demo meetings first.')
      process.exit(0)
    }

    // Seed hero meeting
    await seedHeroMeeting()

    // Seed remaining 9 meetings
    const offsets = [7, 10, 14, 18, 21, 25, 28, 32, 35]
    for (let i = 0; i < SEED_MEETINGS.length && i < offsets.length; i++) {
      const meeting = SEED_MEETINGS[i]
      const offset = offsets[i]
      if (meeting && offset !== undefined) {
        await seedAdditionalMeeting(meeting, offset)
      }
    }

    console.log('\n✅ Demo seed complete!')
    console.log('  10 meetings created with transcripts, summaries, and action items')
  } catch (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
