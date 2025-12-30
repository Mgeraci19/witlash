import { Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// Helper to cast bot votes
export async function castBotVotes(ctx: MutationCtx, gameId: Id<"games">, promptId: Id<"prompts">) {
    console.log(`[BOTS] Casting votes for prompt ${promptId}`);

    // Get all submissions to pick a winner (First one)
    const submissions = await ctx.db.query("submissions").withIndex("by_prompt", (q) => q.eq("promptId", promptId)).collect();
    if (submissions.length === 0) return;

    // Get all Bots in the game
    const players = await ctx.db.query("players").withIndex("by_game", (q) => q.eq("gameId", gameId)).collect();
    const bots = players.filter((p) => p.isBot);

    // Check who is battling (cannot vote)
    const battlerIds = submissions.map((s) => s.playerId);

    // Target submission to vote for (First one for now)
    const targetSubmission = submissions[0];

    for (const bot of bots) {
        if (battlerIds.includes(bot._id)) continue; // Battlers can't vote

        // Cast Vote checks
        const existing = await ctx.db.query("votes")
            .withIndex("by_prompt", (q) => q.eq("promptId", promptId))
            .filter((q) => q.eq(q.field("playerId"), bot._id))
            .first();

        if (!existing) {
            await ctx.db.insert("votes", {
                promptId,
                playerId: bot._id,
                submissionId: targetSubmission._id
            });
        }
    }
    // Check if we can advance round status
    const currentVotes = await ctx.db.query("votes").withIndex("by_prompt", (q) => q.eq("promptId", promptId)).collect();
    // Re-query players to be safe, though we have 'players' above
    const totalPlayers = players.length;
    const expectedVotes = Math.max(1, totalPlayers - 2); // Assuming 2 battlers

    if (currentVotes.length >= expectedVotes) {
        console.log(`[BOTS] All votes in (including bots), moving to REVEAL`);
        await ctx.db.patch(gameId, { roundStatus: "REVEAL" });
    }
}
