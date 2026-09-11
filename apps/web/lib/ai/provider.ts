import type { MeetingIntelligenceProvider, MeetingExtractionInput, SummaryGenerationInput, TemplateSummary, AskMeetingInput, AskMeetingAnswer } from '@fathom/core'

class MockMeetingIntelligenceProvider implements MeetingIntelligenceProvider {
  async extractMeeting(_input: MeetingExtractionInput) {
    return {
      overview: 'This is a mock meeting summary.',
      keyPoints: [{ text: 'Point 1', evidenceSegmentIds: [] }, { text: 'Point 2', evidenceSegmentIds: [] }],
      topics: [],
      decisions: [],
      actionItems: [],
      openQuestions: [],
      followUps: [],
    }
  }

  async generateSummary(input: SummaryGenerationInput): Promise<TemplateSummary> {
    return {
      templateKey: input.templateKey,
      overview: 'Mock summary generated for local development.',
      sections: [],
      modelProvider: 'mock',
      modelName: 'mock-model',
      promptVersion: 'v1',
    }
  }

  async answerQuestion(input: AskMeetingInput): Promise<AskMeetingAnswer> {
    return {
      answer: `Mock answer to: "${input.question}". Configure AI_API_KEY and AI_PROVIDER for real AI responses.`,
      citations: [],
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => Array.from({ length: 1536 }, () => Math.random()))
  }
}

let _provider: MeetingIntelligenceProvider | null = null

export function getAIProvider(): MeetingIntelligenceProvider {
  if (_provider) return _provider

  if (process.env['USE_MOCK_INTEGRATIONS'] === 'true' || !process.env['AI_API_KEY']) {
    _provider = new MockMeetingIntelligenceProvider()
    return _provider
  }

  const providerType = process.env['AI_PROVIDER'] ?? 'openai'
  if (providerType === 'openai') {
    const { OpenAIMeetingIntelligenceProvider } = require('@fathom/integrations/ai')
    _provider = new OpenAIMeetingIntelligenceProvider()
    return _provider!
  }

  throw new Error(`Unsupported AI_PROVIDER: ${providerType}`)
}
