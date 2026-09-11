export type SearchMatchType = 'title' | 'participant' | 'transcript' | 'semantic' | 'summary'

export interface SearchResult {
  meeting: {
    id: string
    title: string
    startsAt: string | null
    durationMs: number | null
  }
  matchType: SearchMatchType
  snippet: string
  startMs?: number
  speakerName?: string
  score: number
}

export interface SearchResponse {
  results: SearchResult[]
  query: string
  total: number
}
