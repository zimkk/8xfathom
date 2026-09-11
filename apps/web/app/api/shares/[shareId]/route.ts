import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getDb } from '@fathom/db'
import { shareLinks } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'
import { hashToken } from '@/lib/crypto/encryption'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { shareId: rawToken } = await params
  const db = getDb()
  const tokenHash = hashToken(rawToken)

  const [link] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.tokenHash, tokenHash))
    .limit(1)

  if (!link) {
    return NextResponse.json({ error: 'Share link not found' }, { status: 404 })
  }

  if (link.status !== 'active') {
    return NextResponse.json({ error: 'Share link has been revoked' }, { status: 410 })
  }

  if (link.expiresAt && new Date() > link.expiresAt) {
    return NextResponse.json({ error: 'Share link has expired' }, { status: 410 })
  }

  return NextResponse.json({ shareLink: link })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { shareId } = await params
  const db = getDb()

  const [link] = await db
    .update(shareLinks)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(eq(shareLinks.id, shareId))
    .returning()

  return NextResponse.json({ shareLink: link })
}
