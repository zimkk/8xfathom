import { describe, it, expect } from 'vitest'
import { evaluateCaptureDecision } from './types.js'

describe('evaluateCaptureDecision', () => {
  it('returns false when cancelled', () => {
    const result = evaluateCaptureDecision({
      defaultMode: 'all', classification: 'internal',
      override: 'inherit', meetingUrl: 'https://meet.google.com/abc', isCancelled: true,
    })
    expect(result.shouldCapture).toBe(false)
    expect(result.reason).toBe('cancelled')
  })

  it('returns false when no meet url', () => {
    const result = evaluateCaptureDecision({
      defaultMode: 'all', classification: 'internal',
      override: 'inherit', meetingUrl: null, isCancelled: false,
    })
    expect(result.shouldCapture).toBe(false)
    expect(result.reason).toBe('no_meet_url')
  })

  it('manual_override_enabled wins over rule_none', () => {
    const result = evaluateCaptureDecision({
      defaultMode: 'none', classification: 'internal',
      override: 'enabled', meetingUrl: 'https://meet.google.com/abc', isCancelled: false,
    })
    expect(result.shouldCapture).toBe(true)
    expect(result.reason).toBe('manual_override_enabled')
  })

  it('manual_override_disabled wins over rule_all', () => {
    const result = evaluateCaptureDecision({
      defaultMode: 'all', classification: 'external',
      override: 'disabled', meetingUrl: 'https://meet.google.com/abc', isCancelled: false,
    })
    expect(result.shouldCapture).toBe(false)
    expect(result.reason).toBe('manual_override_disabled')
  })

  it('rule_all captures all meetings', () => {
    const result = evaluateCaptureDecision({
      defaultMode: 'all', classification: 'internal',
      override: 'inherit', meetingUrl: 'https://meet.google.com/abc', isCancelled: false,
    })
    expect(result.shouldCapture).toBe(true)
    expect(result.reason).toBe('rule_all')
  })

  it('rule_external only captures external meetings', () => {
    const internal = evaluateCaptureDecision({
      defaultMode: 'external_only', classification: 'internal',
      override: 'inherit', meetingUrl: 'https://meet.google.com/abc', isCancelled: false,
    })
    expect(internal.shouldCapture).toBe(false)

    const external = evaluateCaptureDecision({
      defaultMode: 'external_only', classification: 'external',
      override: 'inherit', meetingUrl: 'https://meet.google.com/abc', isCancelled: false,
    })
    expect(external.shouldCapture).toBe(true)
    expect(external.reason).toBe('rule_external')
  })

  it('rule_none never captures', () => {
    const result = evaluateCaptureDecision({
      defaultMode: 'none', classification: 'external',
      override: 'inherit', meetingUrl: 'https://meet.google.com/abc', isCancelled: false,
    })
    expect(result.shouldCapture).toBe(false)
    expect(result.reason).toBe('rule_none')
  })
})
