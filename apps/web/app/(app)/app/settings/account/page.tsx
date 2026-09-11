import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getDb } from '@fathom/db'
import { users } from '@fathom/db/schema'
import { eq } from 'drizzle-orm'

export default async function AccountSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const db = getDb()
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Account</h1>
      <p className="text-sm text-muted-foreground mb-8">Manage your profile and account settings.</p>

      <div className="space-y-6">
        <section className="border rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4">Profile</h2>
          <div className="flex items-center gap-4 mb-4">
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                {(user?.name ?? 'U')[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-medium">{user?.name ?? 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Profile information is synced from your Google account.
          </p>
        </section>

        <section className="border rounded-xl p-5 border-red-200 bg-red-50/30">
          <h2 className="text-sm font-semibold text-red-700 mb-2">Danger Zone</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Deleting your account removes all meetings, transcripts, and settings permanently.
          </p>
          <button
            disabled
            className="text-sm text-red-600 border border-red-300 px-3 py-1.5 rounded-lg opacity-50 cursor-not-allowed"
          >
            Delete Account
          </button>
        </section>
      </div>
    </div>
  )
}
