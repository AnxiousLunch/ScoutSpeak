export type ResearchStatus = 'verified' | 'partial' | 'unverified';
export interface ResearchStatusInput {
    okPages: number;
    citationsValid: boolean;
    observedSignalCited: boolean;
    validationFailed?: boolean;
}
export declare function researchStatus(input: ResearchStatusInput): ResearchStatus;
