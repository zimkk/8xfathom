'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Calendar,
  Home,
  LayoutGrid,
  Search,
  Settings,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/lib/utils'

interface SidebarUser {
  name?: string | null
  email?: string | null
  image?: string | null
}

interface SidebarProps {
  user: SidebarUser
  signOutUrl?: string
}

const navItems = [
  { href: '/app', label: 'Today', icon: Home, exact: true },
  { href: '/app/meetings', label: 'Meetings', icon: LayoutGrid },
  { href: '/app/calendar', label: 'Calendar', icon: Calendar },
  { href: '/app/search', label: 'Search', icon: Search },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex h-full w-[220px] flex-col border-r bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center px-4 border-b">
        <Link href="/app" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="" width={28} height={28} className="h-7 w-7" />
          <span className="font-semibold text-sm text-foreground">Fathom 8x</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t px-2 py-3 space-y-0.5">
        <Link
          href="/app/settings"
          className={cn(
            'flex items-center gap-2.5 rounded-[8px] px-3 py-2 text-sm font-medium transition-colors',
            isActive('/app/settings')
              ? 'bg-accent text-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </Link>

        {/* User */}
        <div className="flex items-center gap-2.5 rounded-[8px] px-3 py-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={user.image ?? undefined} />
            <AvatarFallback className="text-[10px]">
              {getInitials(user.name ?? user.email ?? 'U')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate text-foreground">
              {user.name ?? user.email}
            </p>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
