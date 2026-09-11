'use client'

import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, formatTimestamp } from '@/lib/utils'

interface Citation {
  segmentId: string
  startMs: number
  speakerName: string
  quotePreview: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
}

interface Segment {
  id: string
  startMs: number
  text: string
  speakerName: string
}

interface AskTabProps {
  meetingId: string
  segments: Segment[]
  onSeek: (ms: number) => void
  isDemo?: boolean
}

const DEMO_QUESTIONS = [
  "Why was the October launch at risk?",
  "What was decided about the Okta SSO integration?",
  "What are the action items for David Kim?",
  "When is the pricing review approval needed by?",
]

const DEMO_ANSWERS: Record<string, { answer: string; citations: Citation[] }> = {
  "Why was the October launch at risk?": {
    answer: "The October 15th launch was at risk primarily due to two dependencies. First, the Okta SSO integration required metadata from Northstar's three business unit Okta tenants by October 1st — Ahmed noted this was the critical path and everything else depended on it. Second, a third-party security penetration test was required before go-live, with findings expected by early October. Any critical security findings would need remediation time before the launch could proceed.",
    citations: [
      { segmentId: 'seg3', startMs: 25000, speakerName: 'Ahmed Khan', quotePreview: "The SSO piece is really the critical path here..." },
      { segmentId: 'seg19', startMs: 292000, speakerName: 'Priya Patel', quotePreview: "if any critical vulnerabilities are found, we won't be able to proceed with go-live..." },
    ],
  },
  "What was decided about the Okta SSO integration?": {
    answer: "The team decided on SAML SSO only for phase 1, with SCIM provisioning deferred to Q2 next year. Because Northstar has three separate business unit Okta tenants, the integration requires multi-tenant support routing by email domain — which Ahmed confirmed Acme's team has implemented before. The hard deadline was set: Northstar's IT team must deliver the Okta metadata XML from all three tenants by October 1st to give the engineering team the required 2 weeks before October 15th.",
    citations: [
      { segmentId: 'seg5', startMs: 53000, speakerName: 'Jordan Lee', quotePreview: "We scoped for SAML SSO in phase one. SCIM provisioning is in the roadmap for Q2 next year..." },
      { segmentId: 'seg7', startMs: 85000, speakerName: 'Ahmed Khan', quotePreview: "...we need the metadata XML from each tenant at least two weeks before the go-live." },
    ],
  },
}

export function AskTab({ meetingId, segments, onSeek, isDemo }: AskTabProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(question?: string) {
    const q = question ?? input.trim()
    if (!q) return

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: q,
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      // Use demo answers if available
      if (isDemo && DEMO_ANSWERS[q]) {
        await new Promise((r) => setTimeout(r, 800))
        const demo = DEMO_ANSWERS[q]!
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: demo.answer,
            citations: demo.citations,
          },
        ])
      } else {
        const res = await fetch(`/api/meetings/${meetingId}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q }),
        })

        if (res.ok) {
          const data = await res.json()
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: 'assistant',
              content: data.answer,
              citations: data.citations ?? [],
            },
          ])
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              role: 'assistant',
              content: 'Sorry, I could not find an answer to that question in this meeting.',
            },
          ])
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground text-center">
              Ask anything about this meeting
            </p>
            <div className="space-y-2">
              {DEMO_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSubmit(q)}
                  className="w-full text-left text-xs px-3 py-2.5 rounded-[8px] border hover:bg-muted/50 hover:border-primary/30 transition-colors text-muted-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn('space-y-2', msg.role === 'user' ? 'text-right' : 'text-left')}
          >
            <div
              className={cn(
                'inline-block rounded-[12px] px-3 py-2.5 text-sm max-w-[90%]',
                msg.role === 'user'
                  ? 'bg-primary text-white ml-auto'
                  : 'bg-muted text-foreground'
              )}
            >
              {msg.content}
            </div>

            {/* Citations */}
            {msg.citations && msg.citations.length > 0 && (
              <div className="space-y-1.5">
                {msg.citations.map((citation, i) => (
                  <button
                    key={i}
                    onClick={() => onSeek(citation.startMs)}
                    className="flex items-start gap-2 w-full text-left rounded-[8px] border p-2.5 hover:bg-muted/50 hover:border-primary/30 transition-colors"
                  >
                    <span className="text-[10px] font-medium text-primary shrink-0 mt-0.5">
                      {formatTimestamp(citation.startMs)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px] font-medium text-foreground block">
                        {citation.speakerName}
                      </span>
                      <span className="text-[11px] text-muted-foreground line-clamp-2">
                        "{citation.quotePreview}"
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Searching transcript…</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this meeting…"
            className="flex-1 text-sm"
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
