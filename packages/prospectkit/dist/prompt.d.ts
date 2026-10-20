export interface ProfileInput {
    business_name?: string | null;
    services?: string | null;
    value_proposition?: string | null;
    target_industry?: string | null;
    target_geography?: string | null;
    constraints?: string | null;
}
export interface PageInput {
    tag: string;
    url: string;
    title: string;
    excerpt: string;
}
export declare function buildEnrichmentPrompt(profile: ProfileInput, numberedConstraints: string[], pages: PageInput[]): {
    system: string;
    user: string;
};
