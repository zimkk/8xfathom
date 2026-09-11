import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials, getAvatarColor, cn } from '@/lib/utils'

interface Participant {
  id: string
  displayName: string
  email: string | null
  avatarUrl?: string | null
}

interface ParticipantAvatarsProps {
  participants: Participant[]
  max?: number
  size?: 'sm' | 'md'
}

export function ParticipantAvatars({ participants, max = 4, size = 'sm' }: ParticipantAvatarsProps) {
  const shown = participants.slice(0, max)
  const overflow = participants.length - max

  const sizeClass = size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs'

  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((p) => (
        <Avatar
          key={p.id}
          className={cn(sizeClass, 'ring-2 ring-white')}
          title={p.displayName}
        >
          <AvatarImage src={p.avatarUrl ?? undefined} />
          <AvatarFallback className={cn(getAvatarColor(p.displayName), 'text-white font-medium')}>
            {getInitials(p.displayName)}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            sizeClass,
            'rounded-full bg-muted ring-2 ring-white flex items-center justify-center text-[9px] font-medium text-muted-foreground'
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  )
}
