import type { MeetingIntelligenceProvider } from '@fathom/core'

let _provider: MeetingIntelligenceProvider | null = null

export function getAIProvider(): MeetingIntelligenceProvider {
  if (_provider) return _provider

  if (!process.env['AI_API_KEY']) {
    throw new Error('AI_API_KEY is not configured')
  }

  const providerType = process.env['AI_PROVIDER'] ?? 'openai'
  if (providerType === 'openai') {
    const { OpenAIMeetingIntelligenceProvider } = require('@fathom/integrations/ai')
    _provider = new OpenAIMeetingIntelligenceProvider()
    return _provider!
  }

  throw new Error(`Unsupported AI_PROVIDER: ${providerType}`)
}
