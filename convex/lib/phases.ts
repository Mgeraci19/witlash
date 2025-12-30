import { Id, Doc } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
import { PROMPTS } from "./constants";
import { api } from "../_generated/api";
import { PromptManager } from "./promptUtils";

export async function setupPhase1(ctx: MutationCtx, gameId: Id<"games">, players: Doc<"players">[]) {
    console.log(`[GAME] Setting up Phase 1 (Series Matchups) for ${players.length} players`);

    // 1. Shuffle players
    const shuffledPlayers = players.sort(() => Math.random() - 0.5);

    // Get Available Prompts Logic
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    const promptManager = new PromptManager(game.usedPromptIndices || []);
    const getPrompts = (count: number) => promptManager.pick(count);

    // Pairing Logic
    for (let i = 0; i < shuffledPlayers.length; i += 2) {
        // Handle Odd Player (Should not happen if we enforce even, but safety check)
        if (i + 1 >= shuffledPlayers.length) {
            console.warn("Odd number of players in Phase 1 setup!");
            const p1 = shuffledPlayers[i];
            const p2 = shuffledPlayers[0]; // Pair with first player
            const promptsTexts = getPrompts(3);
            for (const text of promptsTexts) {
                const promptId = await ctx.db.insert("prompts", { gameId, text, assignedTo: [p1._id, p2._id] });
                if (p1.isBot) {
                    const delay = 200 + Math.random() * 300;
                    await ctx.scheduler.runAfter(delay, api.bots.autoAnswer, { gameId, playerId: p1._id, promptId });
                }
            }
            break;
        }

        const p1 = shuffledPlayers[i];
        const p2 = shuffledPlayers[i + 1];
        const promptsTexts = getPrompts(3);

        for (const text of promptsTexts) {
            const promptId = await ctx.db.insert("prompts", { gameId, text, assignedTo: [p1._id, p2._id] });
            if (p1.isBot) {
                const delay = 200 + Math.random() * 300;
                await ctx.scheduler.runAfter(delay, api.bots.autoAnswer, { gameId, playerId: p1._id, promptId });
            }
            if (p2.isBot) {
                const delay = 300 + Math.random() * 300; // slightly offset from p1
                await ctx.scheduler.runAfter(delay, api.bots.autoAnswer, { gameId, playerId: p2._id, promptId });
            }
        }
    }

    // Update used indices
    await ctx.db.patch(gameId, { usedPromptIndices: promptManager.getUsedIndices() });
}

// Bot Helper
export function hasHumanCornerMan(captainId: Id<"players">, allPlayers: Doc<"players">[]) {
    return allPlayers.some(p => p.role === "CORNER_MAN" && p.teamId === captainId && !p.isBot);
}


// Removed local autoAnswer, moved to bots.ts


export async function setupPhase2(ctx: MutationCtx, gameId: Id<"games">, players: Doc<"players">[]) {
    console.log(`[GAME] Setting up Phase 2 (The Cull) for ${players.length} players`);

    // 1. Identify Captains (Players who own a Corner Man)
    // These players get a BYE for this round.
    const cornerMen = players.filter(p => p.role === "CORNER_MAN" && p.teamId);
    const captainIds = new Set(cornerMen.map(p => p.teamId));

    // 2. Filter Survivors for Matchmaking (Not KO'd AND Not a Captain)
    const survivors = players.filter(p => !p.knockedOut && !captainIds.has(p._id));
    console.log(`[GAME] Survivors for Pairing: ${survivors.length} (Captains skipped: ${captainIds.size})`);

    // if (survivors.length < 2) { ... handle in nextRound ... }

    // 2. Sort by HP (Predatory Pairing: Low vs Low)
    // Ascending HP
    survivors.sort((a, b) => (a.hp ?? 100) - (b.hp ?? 100));

    // Get Available Prompts Logic
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    const promptManager = new PromptManager(game.usedPromptIndices || []);

    const getPrompts = (count: number) => promptManager.pick(count);

    // Pairing Logic
    for (let i = 0; i < survivors.length; i += 2) {
        if (i + 1 >= survivors.length) {
            console.log(`[GAME] Odd survivor ${survivors[i].name} gets a Bye.`);
            // No prompts assigned
            break;
        }

        const p1 = survivors[i];
        const p2 = survivors[i + 1];
        console.log(`[GAME] Pairing ${p1.name} (${p1.hp}) vs ${p2.name} (${p2.hp})`);

        const promptsTexts = getPrompts(3);

        for (const text of promptsTexts) {
            const promptId = await ctx.db.insert("prompts", { gameId, text, assignedTo: [p1._id, p2._id] });
            if (p1.isBot && !hasHumanCornerMan(p1._id, players)) {
                const delay = 200 + Math.random() * 300;
                await ctx.scheduler.runAfter(delay, api.bots.autoAnswer, { gameId, playerId: p1._id, promptId });
            }
            if (p2.isBot && !hasHumanCornerMan(p2._id, players)) {
                const delay = 300 + Math.random() * 300;
                await ctx.scheduler.runAfter(delay, api.bots.autoAnswer, { gameId, playerId: p2._id, promptId });
            }
        }
    }

    await ctx.db.patch(gameId, { usedPromptIndices: promptManager.getUsedIndices() });
}

export async function resolvePhase2(ctx: MutationCtx, gameId: Id<"games">) {
    console.log(`[GAME] Resolving Phase 2 (Executions)`);
    // "One Must Fall" Logic: Active players who fought and have lower HP than opponent die.

    // We can infer pairings from the Prompts, or just sort survivors again.
    // simpler: Get all players. Any who was NOT knockedOut before R2 but is now effectively "Loser" needs processing.
    // Wait, the rule is "If after 3 fights, both > 0 HP, Lower One is executed".
    // If someone was KO'd by damage mid-round, they are already KO'd.

    const players = await ctx.db.query("players").withIndex("by_game", (q) => q.eq("gameId", gameId)).collect();
    const survivors = players.filter((p) => !p.knockedOut);

    // We need to re-identify the Pairs to compare them.
    // We can look at prompts from Round 2.
    // Or just group by who fought whom.

    const r2Prompts = await ctx.db.query("prompts").withIndex("by_game", (q) => q.eq("gameId", gameId)).collect();

    // Map of PlayerID -> OpponentID
    const pairings = new Map<string, string>();
    for (const p of r2Prompts) {
        if (p.assignedTo && p.assignedTo.length === 2) {
            const [p1, p2] = p.assignedTo;
            pairings.set(p1, p2);
            pairings.set(p2, p1);
        }
    }

    const processed = new Set<string>();

    for (const p of survivors) {
        if (processed.has(p._id)) continue;
        const opponentId = pairings.get(p._id);

        if (opponentId) {
            const opponent = players.find((pl) => pl._id === opponentId);

            // If opponent is already KO'd naturally, P wins.
            if (!opponent || opponent.knockedOut) {
                // P Survives.
            } else {
                // Both Alive. Compare HP.
                const pHP = p.hp ?? 100;
                const oHP = opponent.hp ?? 100;

                if (pHP < oHP) {
                    // P Dies.
                    console.log(`[CULL] Executing ${p.name} (${pHP} HP) vs ${opponent.name} (${oHP} HP)`);
                    await ctx.db.patch(p._id, { knockedOut: true, hp: 0, role: "CORNER_MAN", teamId: opponent._id });
                } else if (oHP < pHP) {
                    // Opponent Dies.
                    console.log(`[CULL] Executing ${opponent.name} (${oHP} HP) vs ${p.name} (${pHP} HP)`);
                    await ctx.db.patch(opponent._id, { knockedOut: true, hp: 0, role: "CORNER_MAN", teamId: p._id });
                } else {
                    // Tie? Coin flip or Sudden Death?
                    // For MVP, random kill.
                    if (Math.random() > 0.5) {
                        await ctx.db.patch(p._id, { knockedOut: true, hp: 0, role: "CORNER_MAN", teamId: opponent._id });
                    } else {
                        await ctx.db.patch(opponent._id, { knockedOut: true, hp: 0, role: "CORNER_MAN", teamId: p._id });
                    }
                }
            }
            processed.add(p._id);
            if (opponent) processed.add(opponent._id);
        } else {
            // Bye case? They survived.
        }
    }
}

export async function setupPhase3(ctx: MutationCtx, gameId: Id<"games">, players: Doc<"players">[]) {
    console.log(`[GAME] Setting up Phase 3: The Gauntlet`);

    // Active Teams = Players who are NOT Knocked Out. (Corner men are attached to them via teamId, but prompts go to Fighter)
    const activeFighters = players.filter((p) => !p.knockedOut);
    console.log(`[GAME] Active Fighters for Gauntlet: ${activeFighters.length}`);

    if (activeFighters.length < 2) {
        // Should trigger Game Over probably?
        return;
    }

    // Matchmaking: "Fewest Fights" priority.
    // For MVP, we can just create a Round-Robin or Random set of 3 prompts each.
    // Random Pairs for 3 rounds.

    // Reuse prompt picker
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    const promptManager = new PromptManager(game.usedPromptIndices || []);

    const getPrompt = () => promptManager.pick(1)[0];

    // Schedule 3 fights per fighter.
    // We shuffle fighters and pair them up.
    // If odd, we rotate?
    // Simplest approach: Random Pairings for Slot 1, Slot 2, Slot 3.

    for (let round = 0; round < 3; round++) {
        // Shuffle
        const shuffled = [...activeFighters].sort(() => Math.random() - 0.5);

        for (let i = 0; i < shuffled.length; i += 2) {
            const p1 = shuffled[i];
            let p2 = i + 1 < shuffled.length ? shuffled[i + 1] : shuffled[0]; // Wrap around if odd

            // avoid self-match if odd and length=1 (not possible as we checked length < 2)
            if (p1._id === p2._id && shuffled.length > 1) {
                // Should not happen with wrap around unless length=1
                p2 = shuffled[1];
            }

            const text = getPrompt();

            const promptId = await ctx.db.insert("prompts", { gameId, text, assignedTo: [p1._id, p2._id] });

            if (p1.isBot && !hasHumanCornerMan(p1._id, players)) {
                const delay = 200 + Math.random() * 300;
                await ctx.scheduler.runAfter(delay, api.bots.autoAnswer, { gameId, playerId: p1._id, promptId });
            }
            if (p2.isBot && !hasHumanCornerMan(p2._id, players)) {
                const delay = 300 + Math.random() * 300;
                await ctx.scheduler.runAfter(delay, api.bots.autoAnswer, { gameId, playerId: p2._id, promptId });
            }
        }
    }

    await ctx.db.patch(gameId, { usedPromptIndices: promptManager.getUsedIndices() });
}

export async function setupPhase4(ctx: MutationCtx, gameId: Id<"games">, players: Doc<"players">[]) {
    console.log(`[GAME] Setting up Phase 4: The Final Showdown`);

    // 1. Identify the Final 2 Fighters
    const activeFighters = players.filter((p) => !p.knockedOut);
    console.log(`[GAME] Finalists: ${activeFighters.map((p) => p.name).join(", ")}`);

    if (activeFighters.length !== 2) {
        console.warn(`[GAME] Phase 4 Error: Expected 2 fighters, found ${activeFighters.length}`);
        // If < 2, we might have a winner already or error. If > 2, something went wrong in Phase 3.
        // For robustness, we could take top 2 by HP?
    }

    // 2. Reset HP to 100 for Finalists
    // If more than 2 survivors, pick top 2 by HP
    activeFighters.sort((a, b) => (b.hp ?? 0) - (a.hp ?? 0));
    const finalists = activeFighters.slice(0, 2);

    for (const fighter of finalists) {
        await ctx.db.patch(fighter._id, { hp: 100 });
    }

    const p1 = finalists[0];
    const p2 = finalists[1];

    if (!p1 || !p2) return; // safety

    // 3. Create Prompts (3 rounds for now, as per MVP plan)
    // "Players in round 4 continually have to answer prompts... First 3 prompts are created as normal."
    // "If both players are still alive after this then just assign the highest HP player as the winner."
    // TODO: We will come back to this functionality (infinite prompts until death).

    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    const promptManager = new PromptManager(game.usedPromptIndices || []);

    const getPrompt = () => promptManager.pick(1)[0];

    // Generate just 1 prompt to start (Sudden Death style)
    const text = getPrompt();
    const promptId = await ctx.db.insert("prompts", { gameId, text, assignedTo: [p1._id, p2._id] });
    if (p1.isBot && !hasHumanCornerMan(p1._id, players)) {
        const delay = 200 + Math.random() * 300;
        await ctx.scheduler.runAfter(delay, api.bots.autoAnswer, { gameId, playerId: p1._id, promptId });
    }
    if (p2.isBot && !hasHumanCornerMan(p2._id, players)) {
        const delay = 300 + Math.random() * 300;
        await ctx.scheduler.runAfter(delay, api.bots.autoAnswer, { gameId, playerId: p2._id, promptId });
    }

    await ctx.db.patch(gameId, { usedPromptIndices: promptManager.getUsedIndices() });
}

export async function createSuddenDeathPrompt(ctx: MutationCtx, gameId: Id<"games">, p1: Doc<"players">, p2: Doc<"players">, players: Doc<"players">[]) {
    console.log(`[GAME] Creating new Sudden Death prompt, cleaning up old data...`);

    // Clean up ALL old prompts, submissions, votes, AND suggestions from previous Sudden Death rounds
    const oldPrompts = await ctx.db.query("prompts").withIndex("by_game", (q) => q.eq("gameId", gameId)).collect();

    // Delete in reverse order: votes -> submissions -> suggestions -> prompts (to avoid orphans)
    for (const oldPrompt of oldPrompts) {
        // Delete votes for this prompt
        const oldVotes = await ctx.db.query("votes").withIndex("by_prompt", (q) => q.eq("promptId", oldPrompt._id)).collect();
        for (const vote of oldVotes) {
            await ctx.db.delete(vote._id);
        }
        console.log(`[CLEANUP] Deleted ${oldVotes.length} old votes for prompt ${oldPrompt._id}`);

        // Delete submissions for this prompt
        const oldSubs = await ctx.db.query("submissions").withIndex("by_prompt", (q) => q.eq("promptId", oldPrompt._id)).collect();
        for (const sub of oldSubs) {
            await ctx.db.delete(sub._id);
        }
        console.log(`[CLEANUP] Deleted ${oldSubs.length} old submissions for prompt ${oldPrompt._id}`);

        // Delete suggestions for this prompt
        const oldSuggestions = await ctx.db.query("suggestions")
            .filter((q) => q.eq(q.field("promptId"), oldPrompt._id))
            .collect();
        for (const suggestion of oldSuggestions) {
            await ctx.db.delete(suggestion._id);
        }
        console.log(`[CLEANUP] Deleted ${oldSuggestions.length} old suggestions for prompt ${oldPrompt._id}`);

        // Delete the prompt itself
        await ctx.db.delete(oldPrompt._id);
    }

    console.log(`[CLEANUP] Cleanup complete! Creating new prompt...`);

    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");

    const promptManager = new PromptManager(game.usedPromptIndices || []);
    const [text] = promptManager.pick(1);

    const promptId = await ctx.db.insert("prompts", { gameId, text, assignedTo: [p1._id, p2._id] });
    console.log(`[GAME] New Sudden Death prompt created: ${promptId}`);

    // Update game state FIRST before scheduling any bot actions
    await ctx.db.patch(gameId, {
        currentPromptId: promptId,
        status: "PROMPTS",
        roundStatus: undefined, // Reset round status
        usedPromptIndices: promptManager.getUsedIndices()
    });

    // Auto-answer logic needs to verify Human Corner Man
    if (p1.isBot && !hasHumanCornerMan(p1._id, players)) {
        const delay = 200 + Math.random() * 300;
        await ctx.scheduler.runAfter(delay, api.bots.autoAnswer, { gameId, playerId: p1._id, promptId });
    }
    if (p2.isBot && !hasHumanCornerMan(p2._id, players)) {
        const delay = 300 + Math.random() * 300;
        await ctx.scheduler.runAfter(delay, api.bots.autoAnswer, { gameId, playerId: p2._id, promptId });
    }

    // Schedule bots to send suggestions to their human captains
    const suggestionDelay = 500 + Math.random() * 500;
    await ctx.scheduler.runAfter(suggestionDelay, api.bots.sendSuggestions, { gameId });
}
