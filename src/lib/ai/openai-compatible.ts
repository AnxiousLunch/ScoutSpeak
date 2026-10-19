import type { ModelClient, GenerateJSONOpts, GenerateTextOpts } from './types'
import { AiError } from './errors'

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface OpenAIResponse {
  choices?: Array<{
    message?: {
      content?: string | null
    }
    finish_reason?: string
  }>
  error?: { message?: string }
}

export class OpenAICompatibleClient implements ModelClient {
  private baseUrl: string
  private apiKey: string
  private model: string
  private timeoutMs: number

  constructor(opts: {
    baseUrl: string
    apiKey: string
    model: string
    timeoutMs: number
  }) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.apiKey = opts.apiKey
    this.model = opts.model
    this.timeoutMs = opts.timeoutMs
  }

  async generateText(opts: GenerateTextOpts): Promise<string> {
    const res = await this.chat({
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
      maxTokens: opts.maxTokens,
    })
    return this.extractContent(res)
  }

  async generateJSON<T>(opts: GenerateJSONOpts<T>): Promise<T> {
    const system = `${opts.system}\nReturn ONLY valid JSON. Do not wrap the response in markdown code fences.`
    let lastRaw = ''
    let lastError = ''

    for (let attempt = 0; attempt < 2; attempt++) {
      const messages: OpenAIMessage[] = [{ role: 'system', content: system }]
      if (attempt === 0) {
        messages.push({ role: 'user', content: opts.user })
      } else {
        messages.push(
          { role: 'user', content: opts.user },
          { role: 'assistant', content: lastRaw },
          {
            role: 'user',
            content: `That output is invalid. Validation error: ${lastError}. Return ONLY corrected JSON with no markdown fences.`,
          }
        )
      }

      const res = await this.chat({ messages, maxTokens: opts.maxTokens })
      const content = this.extractContent(res)
      lastRaw = content

      let parsed: unknown
      try {
        parsed = parseJSON(content)
      } catch (e) {
        lastError = e instanceof AiError ? e.message : String(e)
        continue
      }

      const validated = opts.schema.safeParse(parsed)
      if (validated.success) {
        return validated.data
      }

      lastError = validated.error.message
    }

    throw new AiError(
      'invalid_output',
      `Output failed schema validation: ${lastError}`
    )
  }

  private async chat(body: {
    messages: OpenAIMessage[]
    maxTokens?: number
  }): Promise<OpenAIResponse> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: body.messages,
          max_tokens: body.maxTokens,
        }),
        signal: controller.signal,
      })

      let bodyJson: OpenAIResponse
      try {
        bodyJson = (await res.json()) as OpenAIResponse
      } catch {
        bodyJson = {}
      }

      if (!res.ok) {
        const message = bodyJson.error?.message ?? `HTTP ${res.status}`
        if (res.status === 429) {
          throw new AiError('rate_limit', message)
        }
        throw new AiError('provider_error', message)
      }

      return bodyJson
    } catch (e) {
      if (e instanceof AiError) {
        throw e
      }
      if (e instanceof Error && e.name === 'AbortError') {
        throw new AiError('timeout', 'AI request timed out')
      }
      throw new AiError(
        'provider_error',
        e instanceof Error ? e.message : String(e)
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  private extractContent(res: OpenAIResponse): string {
    const content = res.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.length === 0) {
      throw new AiError('provider_error', 'Provider returned empty content')
    }
    return content
  }
}

function parseJSON(raw: string): unknown {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    throw new AiError('invalid_output', `Failed to parse JSON: ${reason}`)
  }
}
