import { z } from 'zod';
export declare function makeEnrichmentSchema(allowedTags: Set<string>): z.ZodEffects<z.ZodObject<Omit<{
    summary: z.ZodObject<{
        text: z.ZodString;
        evidence: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        text: string;
        evidence: string[];
    }, {
        text: string;
        evidence: string[];
    }>;
    observed_signal: z.ZodObject<{
        text: z.ZodString;
        evidence: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        text: string;
        evidence: string[];
    }, {
        text: string;
        evidence: string[];
    }>;
    inferred_need: z.ZodNullable<z.ZodObject<{
        text: z.ZodString;
        is_inference: z.ZodLiteral<true>;
        evidence: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        text: string;
        evidence: string[];
        is_inference: true;
    }, {
        text: string;
        evidence: string[];
        is_inference: true;
    }>>;
    opener: z.ZodEffects<z.ZodString, string, string>;
    missing_fields: z.ZodArray<z.ZodString, "many">;
    violated_constraints: z.ZodArray<z.ZodNumber, "many">;
    ratings: z.ZodObject<{
        offer_match: z.ZodNullable<z.ZodNumber>;
        evidence_strength: z.ZodNullable<z.ZodNumber>;
        constraint_fit: z.ZodNullable<z.ZodNumber>;
        stated_need: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        offer_match: number | null;
        evidence_strength: number | null;
        constraint_fit: number | null;
        stated_need: number | null;
    }, {
        offer_match: number | null;
        evidence_strength: number | null;
        constraint_fit: number | null;
        stated_need: number | null;
    }>;
    rating_reasons: z.ZodRecord<z.ZodString, z.ZodString>;
}, "summary" | "observed_signal" | "inferred_need"> & {
    summary: z.ZodObject<{
        text: z.ZodString;
        evidence: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
    }, "strip", z.ZodTypeAny, {
        text: string;
        evidence: string[];
    }, {
        text: string;
        evidence: string[];
    }>;
    observed_signal: z.ZodObject<{
        text: z.ZodString;
        evidence: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
    }, "strip", z.ZodTypeAny, {
        text: string;
        evidence: string[];
    }, {
        text: string;
        evidence: string[];
    }>;
    inferred_need: z.ZodNullable<z.ZodObject<{
        text: z.ZodString;
        is_inference: z.ZodLiteral<true>;
        evidence: z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">;
    }, "strip", z.ZodTypeAny, {
        text: string;
        evidence: string[];
        is_inference: true;
    }, {
        text: string;
        evidence: string[];
        is_inference: true;
    }>>;
}, "strip", z.ZodTypeAny, {
    summary: {
        text: string;
        evidence: string[];
    };
    observed_signal: {
        text: string;
        evidence: string[];
    };
    inferred_need: {
        text: string;
        evidence: string[];
        is_inference: true;
    } | null;
    opener: string;
    missing_fields: string[];
    violated_constraints: number[];
    ratings: {
        offer_match: number | null;
        evidence_strength: number | null;
        constraint_fit: number | null;
        stated_need: number | null;
    };
    rating_reasons: Record<string, string>;
}, {
    summary: {
        text: string;
        evidence: string[];
    };
    observed_signal: {
        text: string;
        evidence: string[];
    };
    inferred_need: {
        text: string;
        evidence: string[];
        is_inference: true;
    } | null;
    opener: string;
    missing_fields: string[];
    violated_constraints: number[];
    ratings: {
        offer_match: number | null;
        evidence_strength: number | null;
        constraint_fit: number | null;
        stated_need: number | null;
    };
    rating_reasons: Record<string, string>;
}>, {
    summary: {
        text: string;
        evidence: string[];
    };
    observed_signal: {
        text: string;
        evidence: string[];
    };
    inferred_need: {
        text: string;
        evidence: string[];
        is_inference: true;
    } | null;
    opener: string;
    missing_fields: string[];
    violated_constraints: number[];
    ratings: {
        offer_match: number | null;
        evidence_strength: number | null;
        constraint_fit: number | null;
        stated_need: number | null;
    };
    rating_reasons: Record<string, string>;
}, {
    summary: {
        text: string;
        evidence: string[];
    };
    observed_signal: {
        text: string;
        evidence: string[];
    };
    inferred_need: {
        text: string;
        evidence: string[];
        is_inference: true;
    } | null;
    opener: string;
    missing_fields: string[];
    violated_constraints: number[];
    ratings: {
        offer_match: number | null;
        evidence_strength: number | null;
        constraint_fit: number | null;
        stated_need: number | null;
    };
    rating_reasons: Record<string, string>;
}>;
