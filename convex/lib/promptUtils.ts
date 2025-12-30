import { PROMPTS } from "./constants";

export function getPromptText(availableIndices: number[], newUsedIndices: number[]) {
    if (availableIndices.length === 0) {
        // Reset if empty, but be careful not to create infinite loop in caller if newUsedIndices covers everything.
        // For simple logic, just refilling logic needs to be handled by caller or passed back.
        // Simpler: Just pick random from ALL prompts if exhausted? 
        // Or re-map indices.
        // Let's assume caller handles refill if empty, or we do it here?
        // To avoid modifying array references in complex ways, let's just pick a random index from PROMPTS 
        // if available is empty, disregarding 'used' to prevent crash.
        const randIdx = Math.floor(Math.random() * PROMPTS.length);
        return PROMPTS[randIdx];
    }
    const randIdx = Math.floor(Math.random() * availableIndices.length);
    const pIdx = availableIndices[randIdx];
    availableIndices.splice(randIdx, 1);
    if (!newUsedIndices.includes(pIdx)) newUsedIndices.push(pIdx);
    return PROMPTS[pIdx];
}

export function getAvailableIndices(usedPromptIndices: number[]) {
    const usedIndices = new Set(usedPromptIndices || []);
    let availableIndices = PROMPTS.map((_, i) => i).filter(i => !usedIndices.has(i));
    return { availableIndices, usedIndices: [...usedIndices] };
}
