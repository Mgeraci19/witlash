import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { setupPhase1 } from "./lib/phases";
import { api } from "./_generated/api";
import { generateSessionToken, validatePlayerName, validateVipPlayer } from "./lib/auth";

// Cleanup games older than 24 hours
async function cleanupOldGames(ctx: any) {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const oldGames = await ctx.db
        .query("games")
        .filter((q: any) => q.lt(q.field("_creationTime"), oneDayAgo))
        .collect();

    for (const game of oldGames) {
        // Delete all related records
        const players = await ctx.db.query("players").withIndex("by_game", (q: any) => q.eq("gameId", game._id)).collect();
        const prompts = await ctx.db.query("prompts").withIndex("by_game", (q: any) => q.eq("gameId", game._id)).collect();
        const messages = await ctx.db.query("messages").withIndex("by_game", (q: any) => q.eq("gameId", game._id)).collect();
        const suggestions = await ctx.db.query("suggestions").withIndex("by_game", (q: any) => q.eq("gameId", game._id)).collect();

        // Delete submissions and votes for each prompt
        for (const prompt of prompts) {
            const submissions = await ctx.db.query("submissions").withIndex("by_prompt", (q: any) => q.eq("promptId", prompt._id)).collect();
            const votes = await ctx.db.query("votes").withIndex("by_prompt", (q: any) => q.eq("promptId", prompt._id)).collect();
            for (const sub of submissions) await ctx.db.delete(sub._id);
            for (const vote of votes) await ctx.db.delete(vote._id);
            await ctx.db.delete(prompt._id);
        }

        for (const player of players) await ctx.db.delete(player._id);
        for (const msg of messages) await ctx.db.delete(msg._id);
        for (const sug of suggestions) await ctx.db.delete(sug._id);
        await ctx.db.delete(game._id);
    }

    if (oldGames.length > 0) {
        console.log(`[CLEANUP] Deleted ${oldGames.length} old games`);
    }
}

export const create = mutation({
    args: {},
    handler: async (ctx) => {
        // Cleanup old games before creating new one
        await cleanupOldGames(ctx);

        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        const hostToken = generateSessionToken();
        // Check collision (omitted for brevity, MVP)
        const gameId = await ctx.db.insert("games", {
            roomCode,
            status: "LOBBY",
            currentRound: 1,
            maxRounds: 4,
            hostToken,
        });
        return { gameId, roomCode, hostToken };
    },
});

export const join = mutation({
    args: { roomCode: v.string(), playerName: v.string() },
    handler: async (ctx, args) => {
        const game = await ctx.db
            .query("games")
            .withIndex("by_room_code", (q) => q.eq("roomCode", args.roomCode))
            .first();

        if (!game) throw new Error("Room not found");
        if (game.status !== "LOBBY") throw new Error("Game already started");

        const existingPlayers = await ctx.db
            .query("players")
            .withIndex("by_game", (q) => q.eq("gameId", game._id))
            .collect();

        // Validate and sanitize player name
        const validatedName = validatePlayerName(args.playerName);
        const normalizedName = validatedName.toLowerCase();
        if (existingPlayers.some(p => p.name.toLowerCase() === normalizedName)) {
            throw new Error("Name taken");
        }

        // Generate session token for authentication
        const sessionToken = generateSessionToken();

        const playerId = await ctx.db.insert("players", {
            gameId: game._id,
            name: validatedName,
            score: 0,
            isVip: existingPlayers.length === 0,
            sessionToken,
            hp: 100,
            maxHp: 100,
            knockedOut: false,
            role: "FIGHTER",
            isBot: false
        });

        return { playerId, gameId: game._id, sessionToken };
    },
});

export const startGame = mutation({
    args: {
        gameId: v.id("games"),
        playerId: v.id("players"),
        sessionToken: v.string()
    },
    handler: async (ctx, args) => {
        // Validate that the player is VIP
        await validateVipPlayer(ctx, args.playerId, args.sessionToken);

        const game = await ctx.db.get(args.gameId);
        if (!game || game.status !== "LOBBY") throw new Error("Cannot start");

        let players = await ctx.db
            .query("players")
            .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
            .collect();

        // Bot Filling Logic
        let currentCount = players.length;
        const MIN_PLAYERS = 6;
        let targetCount = Math.max(currentCount, MIN_PLAYERS);
        if (targetCount % 2 !== 0) targetCount++;

        const neededBots = targetCount - currentCount;
        if (neededBots > 0) {
            console.log(`[LOBBY] Adding ${neededBots} bots`);
            const botNames = ["Robot", "Cyborg", "Android", "Mecha", "Drone", "Golem", "Automaton", "Synth"];
            for (let i = 0; i < neededBots; i++) {
                const name = `${botNames[i % botNames.length]}-${Math.floor(Math.random() * 1000)}`;
                await ctx.db.insert("players", {
                    gameId: args.gameId,
                    name: name,
                    score: 0,
                    isVip: false,
                    sessionToken: generateSessionToken(), // Bots get tokens too (unused but required)
                    hp: 100,
                    maxHp: 100,
                    knockedOut: false,
                    role: "FIGHTER",
                    isBot: true
                });
            }
        }

        // Refetch players including bots
        const allPlayers = await ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", args.gameId)).collect();

        // Start Phase 1
        await setupPhase1(ctx, args.gameId, allPlayers);

        await ctx.db.patch(args.gameId, {
            status: "PROMPTS",
            currentPromptId: undefined,
            roundStatus: undefined
        });

        // Schedule bots to send suggestions to their human captains
        const suggestionDelay = 500 + Math.random() * 500;
        await ctx.scheduler.runAfter(suggestionDelay, api.bots.sendSuggestions, { gameId: args.gameId });
    },
});
