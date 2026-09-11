// Design token exports
export const COLORS = {
  primary: 'hsl(243, 75%, 59%)',
  primaryForeground: 'hsl(0, 0%, 100%)',
  muted: 'hsl(240, 4.8%, 95.9%)',
  mutedForeground: 'hsl(240, 3.7%, 46.1%)',
  border: 'hsl(240, 5.9%, 90%)',
  background: 'hsl(0, 0%, 99%)',
  foreground: 'hsl(240, 10%, 3.9%)',
} as const

export const BORDER_RADIUS = {
  control: '8px',
  card: '12px',
  panel: '14px',
} as const

export const ANIMATION = {
  pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
} as const

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ')
}
