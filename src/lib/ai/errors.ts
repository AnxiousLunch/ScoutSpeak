export type AiErrorCode =
  | 'timeout'
  | 'rate_limit'
  | 'invalid_output'
  | 'provider_error'
  | 'config'

export class AiError extends Error {
  code: AiErrorCode

  constructor(code: AiErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'AiError'
    this.code = code
  }
}
