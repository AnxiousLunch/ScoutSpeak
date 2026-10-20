import type { ModelClient } from './types.js';
import type { EnrichmentResult } from './schema.js';
import type { FitResult } from './fit.js';
import type { PageInput, ProfileInput } from './prompt.js';
import { type ResearchStatus } from './status.js';
export interface LeadInput {
    company_name?: string | null;
    website_url?: string | null;
}
export interface EnrichLeadInput {
    model: ModelClient;
    profile: ProfileInput;
    lead: LeadInput;
    pages: PageInput[];
}
export interface EnrichLeadOutput {
    result: EnrichmentResult | null;
    fit: FitResult | null;
    status: ResearchStatus;
}
export declare function enrichLead(input: EnrichLeadInput): Promise<EnrichLeadOutput>;
