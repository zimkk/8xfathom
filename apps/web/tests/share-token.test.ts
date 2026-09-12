import { describe, it, expect } from 'vitest'
import { hashToken, generateToken } from '../lib/crypto/encryption'

describe('share token', () => {
  it('generateToken returns a non-empty string', () => {
    const token = generateToken()
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(0)
  })

  it('hashToken produces consistent SHA-256 hex', () => {
    const token = generateToken()
    const hash1 = hashToken(token)
    const hash2 = hashToken(token)
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64) // SHA-256 produces 32 bytes = 64 hex chars
  })

  it('different tokens produce different hashes', () => {
    const t1 = generateToken()
    const t2 = generateToken()
    expect(hashToken(t1)).not.toBe(hashToken(t2))
  })
})
