import type { SummaryInput, StoredMessage } from './types.js';
export declare function maybeUpdateSummary(input: SummaryInput): Promise<string | null>;
export declare function buildMessageWindow(messages: StoredMessage[], runningSummary?: string | null): string;
//# sourceMappingURL=summary.d.ts.map