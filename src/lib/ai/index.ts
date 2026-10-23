import type { ModelClient } from './types'
import { AiError } from './errors'
import { OpenAICompatibleClient } from './openai-compatible'

export function getModelClient(): ModelClient {
  const baseUrl = process.env.AI_BASE_URL
  const apiKey = process.env.AI_API_KEY
  const model = process.env.AI_MODEL
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? '20000')

  if (!baseUrl || !apiKey || !model) {
    throw new AiError(
      'config',
      'Missing AI environment variables. Set AI_BASE_URL, AI_API_KEY, and AI_MODEL.'
    )
  }

  return new OpenAICompatibleClient({ baseUrl, apiKey, model, timeoutMs })
}
