import { Id, Doc } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
import { api } from "../_generated/api";
import { PromptManager } from "./promptUtils";

/**
 * NEW GAME STRUCTURE (3 Rounds):
 *
 * Round 1: MAIN ROUND
 * - 5 prompts per matchup
 * - Random pairs
 * - Special bar mechanic (+1.0 per win, triggers at 3.0 = KO)
 * - HP damage at 0.5x for seeding
 * - Losers become corner men
 *
 * THE CUT (after Round 1):
 * - Top 4 by HP advance to semi-finals
 * - Remaining players assigned as corner men
 *
 * Round 2: SEMI-FINALS
 * - 4 prompts per match (3 jabs + 1 haymaker)
 * - 4 fighters in 2 matches
 * - Special bar mechanic (+1.0 per win, triggers at 3.0 = KO)
 * - No HP damage
 * - Winners advance to Final
 *
 * Round 3: FINAL
 * - 200 HP each (reset)
 * - Infinite prompts until KO
 * - Attack type selection (jab/haymaker/flyingKick)
 * - Special bar: 3 consecutive wins = auto KO (resets on non-win)
 */

/**
 * Guard function to verify players are valid for pairing
 * Throws an error if either player is KO'd or not a FIGHTER role
 */
function assertValidPairing(p1: Doc<"players">, p2: Doc<"players">) {
    if (p1.knockedOut) {
        console.error(`[PAIRING ERROR] Player ${p1.name} (${p1._id}) is KO'd but being paired!`);
        throw new Error(`Cannot pair KO'd player: ${p1.name}`);
    }
    if (p2.knockedOut) {
        console.error(`[PAIRING ERROR] Player ${p2.name} (${p2._id}) is KO'd but being paired!`);
        throw new Error(`Cannot pair KO'd player: ${p2.name}`);
    }
    if (p1.role !== "FIGHTER" && p1.role !== "PLAYER") {
        console.error(`[PAIRING ERROR] Player ${p1.name} (${p1._id}) has role ${p1.role}, not FIGHTER!`);
        throw new Error(`Cannot pair non-FIGHTER role: ${p1.name} (${p1.role})`);
    }
    if (p2.role !== "FIGHTER" && p2.role !== "PLAYER") {
        console.error(`[PAIRING ERROR] Player ${p2.name} (${p2._id}) has role ${p2.role}, not FIGHTER!`);
        throw new Error(`Cannot pair non-FIGHTER role: ${p2.name} (${p2.role})`);
    }
}

// Bot Helper
export function hasHumanCornerMan(captainId: Id<"players">, allPlayers: Doc<"players">[]) {
    return allPlayers.some(p => p.role === "CORNER_MAN" && p.teamId === captainId && !p.isBot);
}

/**
 * ROUND 1: MAIN ROUND
 * - 5 prompts per matchup
 * - Random pairs
 * - All players start as FIGHTER with 100 HP
 */
export async function setupMainRound(ctx: MutationCtx, gameId: Id<"games">, players: Doc<"players">[]) {
    console.log(`[GAME] Setting up Main Round for ${players.length} players`);

    const PROMPTS_PER_MATCHUP = 5;

    // Initialize all players as fighters with 100 HP and reset special bar
    for (const player of players) {
        await ctx.db.patch(player._id, {
            role: "FIGHTER",
            hp: 100,
            maxHp: 100,
            knockedOut: false,
            specialBar: 0,
            winStreak: 0
        });
    }

    // Shuffle players for random pairing
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);

    // Get prompt manager
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    const promptManager = new PromptManager(game.usedPromptIndices || []);

    // Create matchups (pair sequential players)
    for (let i = 0; i < shuffledPlayers.length; i += 2) {
        if (i + 1 >= shuffledPlayers.length) {
            // Odd player - pair with first player for extra match
            console.warn(`[GAME] Odd number of players, ${shuffledPlayers[i].name} gets extra match with ${shuffledPlayers[0].name}`);
            const p1 = shuffledPlayers[i];
            const p2 = shuffledPlayers[0];
            const promptsTexts = promptManager.pick(PROMPTS_PER_MATCHUP);

            for (const text of promptsTexts) {
                const promptId = await ctx.db.insert("prompts", { gameId, text, assignedTo: [p1._id, p2._id] });
                await scheduleBotsToAnswer(ctx, gameId, p1, p2, promptId, players);
            }
            break;
        }

        const p1 = shuffledPlayers[i];
        const p2 = shuffledPlayers[i + 1];
        const promptsTexts = promptManager.pick(PROMPTS_PER_MATCHUP);

        console.log(`[MAIN ROUND] Pairing: ${p1.name} vs ${p2.name} (${PROMPTS_PER_MATCHUP} prompts)`);

        for (const text of promptsTexts) {
            const promptId = await ctx.db.insert("prompts", { gameId, text, assignedTo: [p1._id, p2._id] });
            await scheduleBotsToAnswer(ctx, gameId, p1, p2, promptId, players);
        }
    }

    // Update used prompt indices
    await ctx.db.patch(gameId, { usedPromptIndices: promptManager.getUsedIndices() });
}

/**
 * THE CUT: After Main Round
 * - Rank all fighters by HP (descending)
 * - Top 4 advance to semi-finals
 * - Remaining fighters become corner men (randomly assigned to top 4)
 */
export async function performTheCut(ctx: MutationCtx, gameId: Id<"games">): Promise<{
    semifinalists: Doc<"players">[];
    eliminated: Doc<"players">[];
}> {
    console.log(`[THE CUT] Determining semi-finalists...`);

    const players = await ctx.db.query("players")
        .withIndex("by_game", q => q.eq("gameId", gameId))
        .collect();

    // Get all fighters (not already KO'd corner men)
    const fighters = players.filter(p => p.role === "FIGHTER" && !p.knockedOut);

    // Sort by HP descending (highest HP = best seeding)
    fighters.sort((a, b) => (b.hp ?? 100) - (a.hp ?? 100));

    console.log(`[THE CUT] Fighter rankings:`);
    fighters.forEach((f, i) => console.log(`  ${i + 1}. ${f.name}: ${f.hp} HP`));

    // Top 4 advance
    const semifinalists = fighters.slice(0, 4);
    const eliminated = fighters.slice(4);

    console.log(`[THE CUT] Semi-finalists: ${semifinalists.map(p => p.name).join(", ")}`);
    console.log(`[THE CUT] Eliminated: ${eliminated.map(p => p.name).join(", ")}`);

    // Assign eliminated players as corner men to semifinalists who don't have one
    // Get existing corner men assignments
    const existingCornerMen = players.filter(p => p.role === "CORNER_MAN");
    const captainsWithCornerMen = new Set(existingCornerMen.map(p => p.teamId));

    // Find semifinalists who need corner men
    const semifinalistsNeedingCornerMen = semifinalists.filter(s => !captainsWithCornerMen.has(s._id));

    // Assign eliminated players to semifinalists (max 3 per team)
    let eliminatedIndex = 0;
    for (const semifinalist of semifinalistsNeedingCornerMen) {
        if (eliminatedIndex >= eliminated.length) break;

        // Count existing corner men for this semifinalist
        const existingCount = existingCornerMen.filter(c => c.teamId === semifinalist._id).length;
        const slotsAvailable = 3 - existingCount;

        for (let slot = 0; slot < slotsAvailable && eliminatedIndex < eliminated.length; slot++) {
            const cornerMan = eliminated[eliminatedIndex];
            await ctx.db.patch(cornerMan._id, {
                role: "CORNER_MAN",
                teamId: semifinalist._id,
                knockedOut: true,
                becameCornerManInRound: 1
            });
            console.log(`[THE CUT] ${cornerMan.name} → Corner man for ${semifinalist.name}`);
            eliminatedIndex++;
        }
    }

    // Any remaining eliminated players get assigned randomly
    while (eliminatedIndex < eliminated.length) {
        // Find semifinalist with fewest corner men
        const semifinalistCornerCounts = semifinalists.map(s => ({
            semifinalist: s,
            count: players.filter(p => p.role === "CORNER_MAN" && p.teamId === s._id).length
        }));
        semifinalistCornerCounts.sort((a, b) => a.count - b.count);

        const target = semifinalistCornerCounts[0];
        if (target.count >= 3) {
            console.log(`[THE CUT] All semifinalists have max corner men, ${eliminated[eliminatedIndex].name} unassigned`);
            eliminatedIndex++;
            continue;
        }

        const cornerMan = eliminated[eliminatedIndex];
        await ctx.db.patch(cornerMan._id, {
            role: "CORNER_MAN",
            teamId: target.semifinalist._id,
            knockedOut: true,
            becameCornerManInRound: 1
        });
        console.log(`[THE CUT] ${cornerMan.name} → Corner man for ${target.semifinalist.name} (random)`);
        eliminatedIndex++;
    }

    // Reset special bars for semifinalists
    for (const semifinalist of semifinalists) {
        await ctx.db.patch(semifinalist._id, { specialBar: 0 });
    }

    return { semifinalists, eliminated };
}

/**
 * ROUND 2: SEMI-FINALS
 * - 4 prompts per match (3 jabs + 1 haymaker)
 * - 4 fighters in 2 matches
 * - No HP damage (special bar only)
 */
export async function setupSemiFinals(ctx: MutationCtx, gameId: Id<"games">, semifinalists: Doc<"players">[]) {
    console.log(`[SEMI-FINALS] Setting up for ${semifinalists.length} fighters`);

    // Handle edge cases with fewer than 4 semifinalists
    if (semifinalists.length < 2) {
        console.error(`[SEMI-FINALS] Not enough fighters (${semifinalists.length}), cannot setup semi-finals`);
        return;
    }

    if (semifinalists.length === 2) {
        console.log(`[SEMI-FINALS] Only 2 fighters - they will face each other directly`);
        // With only 2 fighters, create a single match
    }

    if (semifinalists.length === 3) {
        console.log(`[SEMI-FINALS] Only 3 fighters - #1 seed gets a bye, #2 vs #3`);
        // #1 seed advances automatically, #2 vs #3 fight for the other spot
    }

    const PROMPTS_PER_MATCH = 4; // 3 jabs + 1 haymaker

    // Get prompt manager
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    const promptManager = new PromptManager(game.usedPromptIndices || []);

    // Get all players for corner man lookup
    const allPlayers = await ctx.db.query("players")
        .withIndex("by_game", q => q.eq("gameId", gameId))
        .collect();

    // Create matches based on number of semifinalists
    const matches: Array<{ p1: Doc<"players">; p2: Doc<"players"> }> = [];

    if (semifinalists.length >= 4) {
        // Standard bracket: #1 vs #4, #2 vs #3
        matches.push({ p1: semifinalists[0], p2: semifinalists[3] });
        matches.push({ p1: semifinalists[1], p2: semifinalists[2] });
    } else if (semifinalists.length === 3) {
        // #1 gets bye, #2 vs #3
        matches.push({ p1: semifinalists[1], p2: semifinalists[2] });
    } else if (semifinalists.length === 2) {
        // Direct matchup
        matches.push({ p1: semifinalists[0], p2: semifinalists[1] });
    }

    for (const match of matches) {
        const { p1, p2 } = match;

        if (!p1 || !p2) {
            console.error(`[SEMI-FINALS] Invalid match - missing player`);
            continue;
        }

        assertValidPairing(p1, p2);

        console.log(`[SEMI-FINALS] Match: ${p1.name} (${p1.hp} HP) vs ${p2.name} (${p2.hp} HP)`);

        const promptsTexts = promptManager.pick(PROMPTS_PER_MATCH);

        // Create prompts with types: prompts 1-3 are "jab", prompt 4 is "haymaker" (bragging round)
        for (let i = 0; i < promptsTexts.length; i++) {
            const text = promptsTexts[i];
            const promptType = i < 3 ? "jab" : "haymaker"; // First 3 are jabs, 4th is haymaker
            console.log(`[SEMI-FINALS] Creating prompt ${i + 1}/${PROMPTS_PER_MATCH} (${promptType}): "${text.substring(0, 30)}..."`);
            const promptId = await ctx.db.insert("prompts", {
                gameId,
                text,
                assignedTo: [p1._id, p2._id],
                promptType: promptType as "jab" | "haymaker"
            });
            await scheduleBotsToAnswer(ctx, gameId, p1, p2, promptId, allPlayers);
        }
    }

    // Update used prompt indices
    await ctx.db.patch(gameId, { usedPromptIndices: promptManager.getUsedIndices() });
}

/**
 * ROUND 3: FINAL
 * - 200 HP each (reset)
 * - Creates initial prompt
 * - Infinite prompts until KO (handled by createFinalPrompt)
 */
export async function setupFinal(ctx: MutationCtx, gameId: Id<"games">, finalists: Doc<"players">[]) {
    console.log(`[FINAL] Setting up Final Showdown`);

    if (finalists.length !== 2) {
        console.error(`[FINAL] Expected 2 finalists, got ${finalists.length}`);
        // Take top 2 by HP
        finalists = finalists.slice(0, 2);
    }

    const p1 = finalists[0];
    const p2 = finalists[1];

    if (!p1 || !p2) {
        console.error(`[FINAL] Not enough finalists!`);
        return;
    }

    assertValidPairing(p1, p2);

    // Reset HP to 200 for final and clear special bar
    for (const finalist of finalists) {
        await ctx.db.patch(finalist._id, {
            hp: 200,
            maxHp: 200,
            specialBar: 0,
            winStreak: 0
        });
    }

    console.log(`[FINAL] ${p1.name} vs ${p2.name} - Both reset to 200 HP`);

    // Get all players for corner man lookup
    const allPlayers = await ctx.db.query("players")
        .withIndex("by_game", q => q.eq("gameId", gameId))
        .collect();

    // Create initial prompt
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");
    const promptManager = new PromptManager(game.usedPromptIndices || []);

    const [text] = promptManager.pick(1);
    const promptId = await ctx.db.insert("prompts", { gameId, text, assignedTo: [p1._id, p2._id] });

    await ctx.db.patch(gameId, { usedPromptIndices: promptManager.getUsedIndices() });

    await scheduleBotsToAnswer(ctx, gameId, p1, p2, promptId, allPlayers);
}

/**
 * Create new Final prompt for sudden death
 * Called when both finalists survive a round
 */
export async function createFinalPrompt(ctx: MutationCtx, gameId: Id<"games">, p1: Doc<"players">, p2: Doc<"players">, players: Doc<"players">[]) {
    console.log(`[FINAL] Creating new sudden death prompt...`);

    assertValidPairing(p1, p2);

    // Clean up old prompts, submissions, votes, and suggestions
    const oldPrompts = await ctx.db.query("prompts").withIndex("by_game", (q) => q.eq("gameId", gameId)).collect();

    for (const oldPrompt of oldPrompts) {
        // Delete votes
        const oldVotes = await ctx.db.query("votes").withIndex("by_prompt", (q) => q.eq("promptId", oldPrompt._id)).collect();
        for (const vote of oldVotes) {
            await ctx.db.delete(vote._id);
        }

        // Delete submissions
        const oldSubs = await ctx.db.query("submissions").withIndex("by_prompt", (q) => q.eq("promptId", oldPrompt._id)).collect();
        for (const sub of oldSubs) {
            await ctx.db.delete(sub._id);
        }

        // Delete suggestions
        const oldSuggestions = await ctx.db.query("suggestions")
            .filter((q) => q.eq(q.field("promptId"), oldPrompt._id))
            .collect();
        for (const suggestion of oldSuggestions) {
            await ctx.db.delete(suggestion._id);
        }

        // Delete prompt
        await ctx.db.delete(oldPrompt._id);
    }

    console.log(`[FINAL] Cleanup complete, creating new prompt...`);

    // Create new prompt
    const game = await ctx.db.get(gameId);
    if (!game) throw new Error("Game not found");

    const promptManager = new PromptManager(game.usedPromptIndices || []);
    const [text] = promptManager.pick(1);

    const promptId = await ctx.db.insert("prompts", { gameId, text, assignedTo: [p1._id, p2._id] });
    console.log(`[FINAL] New prompt created: ${promptId}`);

    // Update game state
    await ctx.db.patch(gameId, {
        currentPromptId: promptId,
        status: "PROMPTS",
        roundStatus: undefined,
        usedPromptIndices: promptManager.getUsedIndices()
    });

    // Schedule bots to answer
    await scheduleBotsToAnswer(ctx, gameId, p1, p2, promptId, players);

    // Schedule bots to send suggestions
    const suggestionDelay = 500 + Math.random() * 500;
    await ctx.scheduler.runAfter(suggestionDelay, api.bots.sendSuggestions, { gameId });
}

/**
 * Helper: Schedule bots to auto-answer
 */
async function scheduleBotsToAnswer(
    ctx: MutationCtx,
    gameId: Id<"games">,
    p1: Doc<"players">,
    p2: Doc<"players">,
    promptId: Id<"prompts">,
    allPlayers: Doc<"players">[]
) {
    if (p1.isBot && !hasHumanCornerMan(p1._id, allPlayers)) {
        const delay = 200 + Math.random() * 300;
        await ctx.scheduler.runAfter(delay, api.bots.autoAnswer, { gameId, playerId: p1._id, promptId });
    }
    if (p2.isBot && !hasHumanCornerMan(p2._id, allPlayers)) {
        const delay = 300 + Math.random() * 300;
        await ctx.scheduler.runAfter(delay, api.bots.autoAnswer, { gameId, playerId: p2._id, promptId });
    }
}

