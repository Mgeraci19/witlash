import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { setupPhase1 } from "./lib/phases";
import { api } from "./_generated/api";

export const create = mutation({
    args: {},
    handler: async (ctx) => {
        const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        // Check collision (omitted for brevity, MVP)
        const gameId = await ctx.db.insert("games", {
            roomCode,
            status: "LOBBY",
            currentRound: 1,
            maxRounds: 4,
        });
        return { gameId, roomCode };
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

        const existingPlayers = await ctx.db
            .query("players")
            .withIndex("by_game", (q) => q.eq("gameId", game._id))
            .collect();

        if (!args.playerName.trim()) throw new Error("Name required");
        const normalizedName = args.playerName.trim().toLowerCase();
        if (existingPlayers.some(p => p.name.toLowerCase() === normalizedName)) {
            throw new Error("Name taken");
        }

        const playerId = await ctx.db.insert("players", {
            gameId: game._id,
            name: args.playerName,
            score: 0,
            isVip: existingPlayers.length === 0,
            hp: 100,
            maxHp: 100,
            knockedOut: false,
            role: "FIGHTER",
            isBot: false
        });

        return { playerId, gameId: game._id };
    },
});

export const startGame = mutation({
    args: { gameId: v.id("games") },
    handler: async (ctx, args) => {
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
