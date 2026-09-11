'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn, formatTimestamp, getInitials, getAvatarColor } from '@/lib/utils'

interface TranscriptSegment {
  id: string
  speakerName: string
  startMs: number
  endMs: number
  text: string
  sequence: number
}

interface TranscriptTabProps {
  segments: TranscriptSegment[]
  currentTimeMs: number
  onSeek: (ms: number) => void
}

function binarySearchCurrentSegment(segments: TranscriptSegment[], timeMs: number): number {
  if (segments.length === 0) return -1
  let lo = 0
  let hi = segments.length - 1
  let result = -1

  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const seg = segments[mid]!
    if (seg.startMs <= timeMs) {
      result = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  if (result === -1) return -1
  const seg = segments[result]!
  if (timeMs <= seg.endMs) return result
  return -1
}

export function TranscriptTab({ segments, currentTimeMs, onSeek }: TranscriptTabProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [autoFollow, setAutoFollow] = useState(true)
  const [activeIndex, setActiveIndex] = useState(-1)
  const userScrolling = useRef(false)
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const filteredSegments = useMemo(() => {
    if (!query.trim()) return segments
    const lower = query.toLowerCase()
    return segments.filter(
      (s) =>
        s.text.toLowerCase().includes(lower) || s.speakerName.toLowerCase().includes(lower)
    )
  }, [segments, query])

  const rowVirtualizer = useVirtualizer({
    count: filteredSegments.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  })

  // Update active segment from playback time
  useEffect(() => {
    if (!query.trim()) {
      const idx = binarySearchCurrentSegment(segments, currentTimeMs)
      setActiveIndex(idx)
    }
  }, [currentTimeMs, segments, query])

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeIndex >= 0 && autoFollow && !userScrolling.current && !query) {
      rowVirtualizer.scrollToIndex(activeIndex, { align: 'center', behavior: 'smooth' })
    }
  }, [activeIndex, autoFollow, query, rowVirtualizer])

  const handleScroll = useCallback(() => {
    userScrolling.current = true
    clearTimeout(scrollTimer.current)
    scrollTimer.current = setTimeout(() => {
      userScrolling.current = false
    }, 2000)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="flex-shrink-0 px-4 py-3 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcript…"
            className="pl-8 h-8 text-xs"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {query && filteredSegments.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {filteredSegments.length} matches
          </p>
        )}
      </div>

      {/* Auto-follow toggle */}
      {!query && (
        <div className="flex-shrink-0 px-4 py-1.5 border-b flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {activeIndex >= 0 ? `Segment ${activeIndex + 1} of ${segments.length}` : ''}
          </span>
          <button
            onClick={() => setAutoFollow((v) => !v)}
            className={cn(
              'text-[11px] font-medium',
              autoFollow ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {autoFollow ? 'Following' : 'Follow playback'}
          </button>
        </div>
      )}

      {/* Virtualized transcript */}
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const segment = filteredSegments[virtualItem.index]!
            const originalIndex = segments.indexOf(segment)
            const isActive = !query && originalIndex === activeIndex
            const highlightQuery = query.trim().toLowerCase()

            function highlightText(text: string) {
              if (!highlightQuery) return text
              const idx = text.toLowerCase().indexOf(highlightQuery)
              if (idx === -1) return text
              return (
                <>
                  {text.slice(0, idx)}
                  <mark className="bg-yellow-200 rounded-sm px-0.5">
                    {text.slice(idx, idx + highlightQuery.length)}
                  </mark>
                  {text.slice(idx + highlightQuery.length)}
                </>
              )
            }

            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <button
                  className={cn(
                    'w-full text-left px-4 py-3 flex gap-3 hover:bg-muted/50 transition-colors',
                    isActive && 'bg-primary/5 border-l-2 border-primary'
                  )}
                  onClick={() => onSeek(segment.startMs)}
                >
                  <div
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white',
                      getAvatarColor(segment.speakerName)
                    )}
                  >
                    {getInitials(segment.speakerName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-foreground">
                        {segment.speakerName}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatTimestamp(segment.startMs)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        'text-xs leading-relaxed',
                        isActive ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {highlightText(segment.text)}
                    </p>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
