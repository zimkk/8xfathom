'use client'

import { useState } from 'react'
import { CheckSquare, Square, Clock, Tag, AlertCircle, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatTimestamp } from '@/lib/utils'
import { SUMMARY_TEMPLATE_LABELS } from '@fathom/core'
import type { SummaryTemplateKey } from '@fathom/core'

interface OverviewTabProps {
  meeting: { id: string; summaryTemplateDefault?: string }
  summary: {
    overview: string
    templateKey: string
    structuredJson: unknown
  } | null
  actionItems: Array<{
    id: string
    text: string
    ownerName: string | null
    dueDate: string | null
    status: string
    evidenceSegmentIds: string[]
  }>
  decisions: Array<{
    id: string
    text: string
    status: string
    evidenceSegmentIds: string[]
  }>
  topics: Array<{
    id: string
    title: string
    summary: string | null
    startMs: number | null
    endMs: number | null
    sortOrder: number
  }>
  highlights: Array<{
    id: string
    title: string
    startMs: number
    endMs: number
    type: string
  }>
  segments: Array<{
    id: string
    startMs: number
    text: string
  }>
  onSeek: (ms: number) => void
  isReadOnly?: boolean
}

const TEMPLATES: SummaryTemplateKey[] = ['general', 'sales', 'one_on_one', 'interview', 'project']

export function OverviewTab({
  meeting,
  summary,
  actionItems,
  decisions,
  topics,
  highlights,
  segments,
  onSeek,
  isReadOnly,
}: OverviewTabProps) {
  const initialTemplate = (summary?.templateKey as SummaryTemplateKey) ?? 'general'
  const [activeTemplate, setActiveTemplate] = useState<SummaryTemplateKey>(initialTemplate)
  const [summaryCache, setSummaryCache] = useState<Partial<Record<SummaryTemplateKey, OverviewTabProps['summary']>>>(
    summary ? { [initialTemplate]: summary } : {}
  )
  const [loadingTemplate, setLoadingTemplate] = useState<SummaryTemplateKey | null>(null)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(
    new Set(actionItems.filter((i) => i.status === 'done').map((i) => i.id))
  )

  const activeSummary = summaryCache[activeTemplate] ?? null

  async function handleSelectTemplate(key: SummaryTemplateKey) {
    if (key === activeTemplate) return
    if (summaryCache[key]) {
      setActiveTemplate(key)
      return
    }
    if (isReadOnly) return

    setLoadingTemplate(key)
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/summary/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateKey: key }),
      })
      if (res.ok) {
        const data = await res.json()
        setSummaryCache((prev) => ({ ...prev, [key]: { ...data.summary, templateKey: key } }))
        setActiveTemplate(key)
      }
    } finally {
      setLoadingTemplate(null)
    }
  }

  const segmentById = new Map(segments.map((s) => [s.id, s]))

  function toggleActionItem(id: string) {
    if (isReadOnly) return
    setCheckedItems((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      // Persist to API (fire and forget)
      fetch(`/api/meetings/${meeting.id}/action-items/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next.has(id) ? 'done' : 'open' }),
      }).catch(() => {})
      return next
    })
  }

  function getEvidenceTimestamp(segmentIds: string[]): number | null {
    const seg = segmentIds.map((id) => segmentById.get(id)).find(Boolean)
    return seg ? seg.startMs : null
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-6">
      {/* Template switcher */}
      <div className="flex gap-1 flex-wrap">
        {TEMPLATES.map((key) => (
          <button
            key={key}
            onClick={() => handleSelectTemplate(key)}
            disabled={loadingTemplate !== null || (isReadOnly && !summaryCache[key])}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              activeTemplate === key
                ? 'bg-primary text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {loadingTemplate === key ? 'Generating…' : SUMMARY_TEMPLATE_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Summary */}
      {activeSummary ? (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Summary
          </h2>
          <p className="text-sm text-foreground leading-relaxed">{activeSummary.overview}</p>
        </section>
      ) : (
        <section className="text-sm text-muted-foreground">
          {loadingTemplate ? 'Generating summary…' : meeting ? 'No summary available yet.' : 'Processing notes…'}
        </section>
      )}

      {/* Topics */}
      {topics.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Topics
          </h2>
          <div className="space-y-2">
            {topics.map((topic) => (
              <div
                key={topic.id}
                className="rounded-[8px] border p-3 cursor-pointer hover:border-primary/30 hover:bg-muted/30 transition-colors"
                onClick={() => topic.startMs && onSeek(topic.startMs)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{topic.title}</span>
                  {topic.startMs !== null && (
                    <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(topic.startMs)}
                    </span>
                  )}
                </div>
                {topic.summary && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{topic.summary}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Decisions */}
      {decisions.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Decisions
          </h2>
          <div className="space-y-2">
            {decisions.map((decision) => {
              const evidenceMs = getEvidenceTimestamp(decision.evidenceSegmentIds)
              return (
                <div
                  key={decision.id}
                  className={cn(
                    'rounded-[8px] border p-3 flex items-start gap-2',
                    evidenceMs !== null && 'cursor-pointer hover:border-primary/30 hover:bg-muted/30 transition-colors'
                  )}
                  onClick={() => evidenceMs !== null && onSeek(evidenceMs)}
                >
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">{decision.text}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant={decision.status === 'confirmed' ? 'success' : 'warning'}
                        className="text-[10px]"
                      >
                        {decision.status}
                      </Badge>
                      {evidenceMs !== null && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatTimestamp(evidenceMs)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Action Items */}
      {actionItems.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Action Items
          </h2>
          <div className="space-y-1">
            {actionItems.map((item) => {
              const checked = checkedItems.has(item.id)
              const evidenceMs = getEvidenceTimestamp(item.evidenceSegmentIds)
              return (
                <div key={item.id} className="flex items-start gap-2 py-2 group">
                  <button
                    onClick={() => toggleActionItem(item.id)}
                    className={cn(
                      'mt-0.5 shrink-0 transition-colors',
                      isReadOnly ? 'cursor-default opacity-50' : 'cursor-pointer'
                    )}
                    disabled={isReadOnly}
                  >
                    {checked ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className={cn('text-sm', checked && 'line-through text-muted-foreground')}>
                      {item.text}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {item.ownerName && (
                        <span className="text-[11px] text-muted-foreground">{item.ownerName}</span>
                      )}
                      {item.dueDate && (
                        <span className="text-[11px] text-muted-foreground">Due {item.dueDate}</span>
                      )}
                      {evidenceMs !== null && (
                        <button
                          onClick={() => onSeek(evidenceMs)}
                          className="text-[11px] text-primary hover:underline"
                        >
                          {formatTimestamp(evidenceMs)}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Highlights
          </h2>
          <div className="space-y-2">
            {highlights.map((hl) => (
              <div
                key={hl.id}
                className="flex items-center gap-2 rounded-[8px] border p-3 cursor-pointer hover:border-primary/30 hover:bg-muted/30 transition-colors"
                onClick={() => onSeek(hl.startMs)}
              >
                <Tag className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="text-sm flex-1 min-w-0 truncate">{hl.title}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatTimestamp(hl.startMs)}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
