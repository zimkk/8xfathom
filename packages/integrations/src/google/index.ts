
export interface GoogleCalendarEvent {
  id: string
  summary: string
  description?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  hangoutLink?: string
  conferenceData?: {
    entryPoints?: Array<{ entryPointType: string; uri: string }>
  }
  attendees?: Array<{ email: string; displayName?: string; responseStatus: string }>
  organizer?: { email: string; displayName?: string }
  status?: 'confirmed' | 'tentative' | 'cancelled'
}

export interface ListUpcomingEventsOptions {
  calendarId?: string
  /** Upper bound of the sync window (ISO). Defaults to 30 days out. */
  timeMax?: string
  /** Safety cap on total events fetched across pages. */
  maxTotal?: number
}

export interface GoogleCalendarProvider {
  listUpcomingEvents(accessToken: string, options?: ListUpcomingEventsOptions): Promise<GoogleCalendarEvent[]>
  refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }>
}

export class GoogleCalendarClient implements GoogleCalendarProvider {
  private clientId: string
  private clientSecret: string

  constructor() {
    this.clientId = process.env['GOOGLE_CLIENT_ID'] ?? ''
    this.clientSecret = process.env['GOOGLE_CLIENT_SECRET'] ?? ''
  }

  async listUpcomingEvents(accessToken: string, options: ListUpcomingEventsOptions = {}): Promise<GoogleCalendarEvent[]> {
    const calendarId = options.calendarId ?? 'primary'
    const timeMin = new Date().toISOString()
    const timeMax = options.timeMax ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const maxTotal = options.maxTotal ?? 500

    // Page through the entire window. Without this, a user with more than one page of upcoming
    // Meet events would have the overflow treated as "not seen" and wrongly cancelled downstream.
    const all: GoogleCalendarEvent[] = []
    let pageToken: string | undefined
    do {
      const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
      url.searchParams.set('timeMin', timeMin)
      url.searchParams.set('timeMax', timeMax)
      url.searchParams.set('maxResults', '250') // Google's per-page max
      url.searchParams.set('singleEvents', 'true')
      url.searchParams.set('orderBy', 'startTime')
      if (pageToken) url.searchParams.set('pageToken', pageToken)

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!res.ok) {
        throw new Error(`Google Calendar API error ${res.status}`)
      }

      const data = await res.json() as { items?: GoogleCalendarEvent[]; nextPageToken?: string }
      all.push(...(data.items ?? []))
      pageToken = data.nextPageToken
    } while (pageToken && all.length < maxTotal)

    return all.filter((e) => {
      // Only return events with Google Meet links
      const hasHangout = !!e.hangoutLink
      const hasConference = e.conferenceData?.entryPoints?.some((ep) => ep.entryPointType === 'video')
      return hasHangout || hasConference
    })
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Token refresh failed ${res.status}: ${err}`)
    }

    const data = await res.json() as { access_token: string; expires_in: number }
    const expiresAt = new Date(Date.now() + data.expires_in * 1000)
    return { accessToken: data.access_token, expiresAt }
  }

  getAuthUrl(state: string): string {
    const redirectUri = process.env['GOOGLE_REDIRECT_URI'] ?? ''
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', this.clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    // `openid email` is required for the userinfo/email lookup in the callback; calendar.readonly
    // is the actual data scope. access_type=offline + prompt=consent force a refresh token.
    url.searchParams.set('scope', 'openid email https://www.googleapis.com/auth/calendar.readonly')
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('state', state)
    return url.toString()
  }

  async exchangeCode(code: string): Promise<{
    accessToken: string
    refreshToken: string | null
    expiresAt: Date
    scope: string
  }> {
    const redirectUri = process.env['GOOGLE_REDIRECT_URI'] ?? ''
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Code exchange failed ${res.status}: ${err}`)
    }

    const data = await res.json() as {
      access_token: string
      refresh_token: string
      expires_in: number
      scope: string
    }
    return {
      accessToken: data.access_token,
      // Google only issues a refresh_token on the first-ever consent for a
      // given scope; a repeat grant (e.g. already consented via the unified
      // login flow) can come back without one.
      refreshToken: data.refresh_token ?? null,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    }
  }
}

export function getGoogleCalendarClient(): GoogleCalendarClient {
  return new GoogleCalendarClient()
}
