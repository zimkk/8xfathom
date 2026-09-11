import Link from 'next/link'
import { User, Calendar, Settings, Mic } from 'lucide-react'

const navItems = [
  { href: '/app/settings/account', label: 'Account', icon: User },
  { href: '/app/settings/calendar', label: 'Calendar', icon: Calendar },
  { href: '/app/settings/capture', label: 'Capture', icon: Mic },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-52 shrink-0 border-r bg-muted/30 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4 px-2">
          Settings
        </h2>
        <nav className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-8 max-w-2xl">{children}</main>
    </div>
  )
}
