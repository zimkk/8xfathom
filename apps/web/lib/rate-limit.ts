const ipRequestCounts = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(ip: string, key: string, limit: number, windowMs: number): boolean {
  const fullKey = `${key}:${ip}`
  const now = Date.now()
  const entry = ipRequestCounts.get(fullKey)

  if (!entry || now > entry.resetAt) {
    ipRequestCounts.set(fullKey, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false
  entry.count++
  return true
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  )
}
