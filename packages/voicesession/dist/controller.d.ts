import type { NextTurnInput, NextTurnOutput, OpeningTurnInput, OpeningTurnOutput, SystemPromptInput } from './types.js';
export declare function buildSystemPrompt(input: SystemPromptInput): string;
export declare function openingTurn(input: OpeningTurnInput): Promise<OpeningTurnOutput>;
export declare function nextTurn(input: NextTurnInput): Promise<NextTurnOutput>;
//# sourceMappingURL=controller.d.ts.map