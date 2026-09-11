'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Search, Clock, FileText } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { formatDuration, formatTimestamp } from '@/lib/utils'

interface SearchResult {
  meeting: {
    id: string
    title: string
    startsAt: string | null
    durationMs: number | null
  }
  matchType: string
  snippet: string
  startMs?: number
  speakerName?: string
  score: number
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([])
        return
      }
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=30`)
        const data = await res.json()
        setResults(data.results ?? [])
        setSearched(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    []
  )

  let debounceTimer: ReturnType<typeof setTimeout>
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => handleSearch(val), 250)
  }

  function getMeetingHref(result: SearchResult) {
    const base = `/app/meetings/${result.meeting.id}`
    if (result.startMs !== undefined) {
      return `${base}?t=${Math.floor(result.startMs / 1000)}`
    }
    return base
  }

  function getMatchTypeLabel(type: string) {
    const labels: Record<string, string> = {
      title: 'Title match',
      transcript: 'Transcript',
      participant: 'Participant',
      summary: 'Summary',
    }
    return labels[type] ?? type
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Search</h1>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={handleChange}
          placeholder="Search across all meetings, transcripts, and notes…"
          className="pl-10 h-11 text-sm"
          autoFocus
        />
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">Searching…</div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No results found for "{query}"</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-3">
            {results.length} results for "{query}"
          </p>
          {results.map((result, i) => (
            <Link key={i} href={getMeetingHref(result)}>
              <div className="rounded-[10px] border bg-white p-4 hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                        {getMatchTypeLabel(result.matchType)}
                      </span>
                      {result.speakerName && (
                        <span className="text-xs text-muted-foreground">{result.speakerName}</span>
                      )}
                      {result.startMs !== undefined && (
                        <span className="text-xs text-primary font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTimestamp(result.startMs)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground leading-relaxed">{result.snippet}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 font-medium">
                      {result.meeting.title}
                    </p>
                  </div>
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!searched && (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Search across meeting titles, transcripts, and summaries.</p>
          <p className="text-xs mt-1">Try "SSO", "pricing", or any participant name.</p>
        </div>
      )}
    </div>
  )
}
