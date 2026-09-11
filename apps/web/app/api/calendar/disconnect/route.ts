import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { calendarConnections } from '@fathom/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  await db
    .update(calendarConnections)
    .set({ status: 'disconnected', updatedAt: new Date() })
    .where(
      and(
        eq(calendarConnections.userId, session.user.id),
        eq(calendarConnections.provider, 'google')
      )
    )

  return NextResponse.json({ ok: true })
}
