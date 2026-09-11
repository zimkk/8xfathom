
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
}

export interface GoogleCalendarProvider {
  listUpcomingEvents(accessToken: string, calendarId?: string, maxResults?: number): Promise<GoogleCalendarEvent[]>
  refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresAt: Date }>
}

export class GoogleCalendarClient implements GoogleCalendarProvider {
  private clientId: string
  private clientSecret: string

  constructor() {
    this.clientId = process.env['GOOGLE_CLIENT_ID'] ?? ''
    this.clientSecret = process.env['GOOGLE_CLIENT_SECRET'] ?? ''
  }

  async listUpcomingEvents(accessToken: string, calendarId = 'primary', maxResults = 25): Promise<GoogleCalendarEvent[]> {
    const now = new Date().toISOString()
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`)
    url.searchParams.set('timeMin', now)
    url.searchParams.set('maxResults', String(maxResults))
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      throw new Error(`Google Calendar API error ${res.status}`)
    }

    const data = await res.json() as { items: GoogleCalendarEvent[] }
    return (data.items ?? []).filter((e) => {
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
    url.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.readonly')
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('state', state)
    return url.toString()
  }

  async exchangeCode(code: string): Promise<{
    accessToken: string
    refreshToken: string
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
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scope: data.scope,
    }
  }
}

export function getGoogleCalendarClient(): GoogleCalendarClient {
  return new GoogleCalendarClient()
}

// Mock for local dev
export class MockGoogleCalendarClient implements GoogleCalendarProvider {
  async listUpcomingEvents(): Promise<GoogleCalendarEvent[]> {
    const now = new Date()
    return [
      {
        id: 'mock-event-1',
        summary: 'Weekly Team Sync',
        start: { dateTime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString() },
        end: { dateTime: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString() },
        hangoutLink: 'https://meet.google.com/mock-abc-def',
        attendees: [
          { email: 'alice@example.com', displayName: 'Alice', responseStatus: 'accepted' },
          { email: 'bob@example.com', displayName: 'Bob', responseStatus: 'accepted' },
        ],
      },
    ]
  }

  async refreshAccessToken(): Promise<{ accessToken: string; expiresAt: Date }> {
    return {
      accessToken: 'mock-access-token',
      expiresAt: new Date(Date.now() + 3600 * 1000),
    }
  }
}
