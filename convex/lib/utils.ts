import { Id } from "../_generated/dataModel";

// Helper to cast bot votes
export async function castBotVotes(ctx: any, gameId: Id<"games">, promptId: Id<"prompts">) {
    console.log(`[BOTS] Casting votes for prompt ${promptId}`);

    // Get all submissions to pick a winner (First one)
    const submissions = await ctx.db.query("submissions").withIndex("by_prompt", (q: any) => q.eq("promptId", promptId)).collect();
    if (submissions.length === 0) return;

    // Get all Bots in the game
    const players = await ctx.db.query("players").withIndex("by_game", (q: any) => q.eq("gameId", gameId)).collect();
    const bots = players.filter((p: any) => p.isBot);

    // Check who is battling (cannot vote)
    const battlerIds = submissions.map((s: any) => s.playerId);

    // Target submission to vote for (First one for now)
    const targetSubmission = submissions[0];

    for (const bot of bots) {
        if (battlerIds.includes(bot._id)) continue; // Battlers can't vote

        // Cast Vote checks
        const existing = await ctx.db.query("votes")
            .withIndex("by_prompt", (q: any) => q.eq("promptId", promptId))
            .filter((q: any) => q.eq(q.field("playerId"), bot._id))
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
    const currentVotes = await ctx.db.query("votes").withIndex("by_prompt", (q: any) => q.eq("promptId", promptId)).collect();
    // Re-query players to be safe, though we have 'players' above
    const totalPlayers = players.length;
    const expectedVotes = Math.max(1, totalPlayers - 2); // Assuming 2 battlers

    if (currentVotes.length >= expectedVotes) {
        console.log(`[BOTS] All votes in (including bots), moving to REVEAL`);
        await ctx.db.patch(gameId, { roundStatus: "REVEAL" });
    }
}
