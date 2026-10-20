import type { ZodType } from 'zod'

export interface GenerateJSONOpts<T> {
  system: string
  user: string
  schema: ZodType<T>
  maxTokens?: number
}

export interface GenerateTextOpts {
  system: string
  user: string
  maxTokens?: number
}

export interface ModelClient {
  generateJSON<T>(opts: GenerateJSONOpts<T>): Promise<T>
  generateText(opts: GenerateTextOpts): Promise<string>
}
