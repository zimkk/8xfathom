export async function register() {
  if (process.env['NEXT_PUBLIC_SENTRY_DSN']) {
    try {
      const { init } = await import('@sentry/nextjs')
      init({
        dsn: process.env['NEXT_PUBLIC_SENTRY_DSN'],
        environment: process.env['NODE_ENV'],
        tracesSampleRate: 0.1,
      })
    } catch {
      // Sentry not available — skip initialization
    }
  }
}
