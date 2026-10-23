import { describe, it, expect, vi } from 'vitest'
import { OpenAICompatibleClient } from './openai-compatible'

const baseUrl = 'https://api.example.com'
const apiKey = 'test-key'
const model = 'test-model'

function mockFetch(response: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => response,
  } as Response)
}

describe('OpenAICompatibleClient generateText', () => {
  it('trims to the last complete sentence when finish_reason is length', async () => {
    global.fetch = mockFetch({
      choices: [
        {
          message: { content: 'This is a full sentence. This one is cut off mid' },
          finish_reason: 'length',
        },
      ],
    })

    const client = new OpenAICompatibleClient({ baseUrl, apiKey, model, timeoutMs: 5000 })
    const result = await client.generateText({
      system: 'You are helpful.',
      user: 'Say something.',
      maxTokens: 10,
    })

    expect(result).toBe('This is a full sentence.')
  })

  it('keeps trailing quote with sentence punctuation when trimming', async () => {
    global.fetch = mockFetch({
      choices: [
        {
          message: { content: 'She said, "Hello." Then she left quickly in the' },
          finish_reason: 'length',
        },
      ],
    })

    const client = new OpenAICompatibleClient({ baseUrl, apiKey, model, timeoutMs: 5000 })
    const result = await client.generateText({
      system: 'You are helpful.',
      user: 'Say something.',
      maxTokens: 10,
    })

    expect(result).toBe('She said, "Hello."')
  })

  it('returns the content unchanged when no complete sentence exists', async () => {
    global.fetch = mockFetch({
      choices: [
        {
          message: { content: 'cut off mid sentence with no ending punctuation' },
          finish_reason: 'length',
        },
      ],
    })

    const client = new OpenAICompatibleClient({ baseUrl, apiKey, model, timeoutMs: 5000 })
    const result = await client.generateText({
      system: 'You are helpful.',
      user: 'Say something.',
      maxTokens: 10,
    })

    expect(result).toBe('cut off mid sentence with no ending punctuation')
  })

  it('does not trim when finish_reason is not length', async () => {
    global.fetch = mockFetch({
      choices: [
        {
          message: { content: 'This is a full sentence. This one is cut off mid' },
          finish_reason: 'stop',
        },
      ],
    })

    const client = new OpenAICompatibleClient({ baseUrl, apiKey, model, timeoutMs: 5000 })
    const result = await client.generateText({
      system: 'You are helpful.',
      user: 'Say something.',
      maxTokens: 10,
    })

    expect(result).toBe('This is a full sentence. This one is cut off mid')
  })
})
