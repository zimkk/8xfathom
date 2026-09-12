import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { userCapturePreferences } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'

const PatchSchema = z.object({
  defaultMode: z.enum(['all', 'external_only', 'internal_only', 'none']).optional(),
  botDisplayName: z.string().min(1).max(100).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getDb()
  const [prefs] = await db
    .select()
    .from(userCapturePreferences)
    .where(eq(userCapturePreferences.userId, session.user.id))
    .limit(1)

  return NextResponse.json({
    preferences: prefs ?? { defaultMode: 'all', botDisplayName: 'AI Notetaker' },
  })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const db = getDb()
  const [prefs] = await db
    .insert(userCapturePreferences)
    .values({
      userId: session.user.id,
      defaultMode: parsed.data.defaultMode ?? 'all',
      botDisplayName: parsed.data.botDisplayName ?? 'AI Notetaker',
    })
    .onConflictDoUpdate({
      target: userCapturePreferences.userId,
      set: { ...parsed.data, updatedAt: new Date() },
    })
    .returning()

  return NextResponse.json({ preferences: prefs })
}
