export type FetchBlockedCode =
  | 'invalid_scheme'
  | 'userinfo'
  | 'nonstandard_port'
  | 'dns_blocked'
  | 'redirect_limit'
  | 'timeout'
  | 'oversize'
  | 'non_html'
  | 'not_found'
  | 'blocked'
  | 'rate_limit'
  | 'server_error'
  | 'fetch_error'

export class FetchBlockedError extends Error {
  code: FetchBlockedCode

  constructor(code: FetchBlockedCode, message?: string) {
    super(message ?? code)
    this.name = 'FetchBlockedError'
    this.code = code
  }
}
