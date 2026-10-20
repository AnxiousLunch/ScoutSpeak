export type ResearchStatus = 'verified' | 'partial' | 'unverified'

export interface ResearchStatusInput {
  okPages: number
  citationsValid: boolean
  observedSignalCited: boolean
  validationFailed?: boolean
}

export function researchStatus(input: ResearchStatusInput): ResearchStatus {
  if (input.validationFailed) return 'unverified'
  if (!input.citationsValid || !input.observedSignalCited) return 'unverified'
  if (input.okPages >= 2) return 'verified'
  if (input.okPages >= 1) return 'partial'
  return 'unverified'
}
