export type SttErrorCode =
  | 'not_configured'
  | 'timeout'
  | 'provider_error'
  | 'payload_too_large'

export class SttError extends Error {
  code: SttErrorCode

  constructor(code: SttErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'SttError'
    this.code = code
  }
}
