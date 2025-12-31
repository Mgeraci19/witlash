import { PROMPTS } from "./constants";

export class PromptManager {
    private availableIndices: number[];
    private usedIndices: Set<number>;

    constructor(initialUsedIndices: number[]) {
        this.usedIndices = new Set(initialUsedIndices || []);
        this.availableIndices = PROMPTS.map((_, i) => i).filter(i => !this.usedIndices.has(i));
    }

    /**
     * Pick 'count' random prompts.
     * Automatically refills available prompts if exhausted.
     */
    public pick(count: number = 1): string[] {
        const results: string[] = [];
        for (let i = 0; i < count; i++) {
            if (this.availableIndices.length === 0) {
                // Refill from all prompts
                this.availableIndices = PROMPTS.map((_, k) => k);
            }
            // Pick random
            const randIdx = Math.floor(Math.random() * this.availableIndices.length);
            const promptIdx = this.availableIndices[randIdx];

            // Remove from available
            this.availableIndices.splice(randIdx, 1);

            // Add to used
            this.usedIndices.add(promptIdx);

            results.push(PROMPTS[promptIdx]);
        }
        return results;
    }

    /**
     * Get the updated list of used indices to save to DB.
     */
    public getUsedIndices(): number[] {
        return Array.from(this.usedIndices);
    }
}
