import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

describe("lobby.create", () => {
  test("creates a game with LOBBY status", async () => {
    const t = convexTest(schema);
    const result = await t.mutation(api.lobby.create, {});

    expect(result.gameId).toBeDefined();
    expect(result.roomCode).toHaveLength(4);
    expect(result.hostToken).toBeDefined();

    // Verify game was created correctly
    const game = await t.run(async (ctx) => {
      return await ctx.db.get(result.gameId);
    });

    expect(game).not.toBeNull();
    expect(game?.status).toBe("LOBBY");
    expect(game?.currentRound).toBe(1);
    expect(game?.maxRounds).toBe(4);
  });

  test("generates uppercase room codes", async () => {
    const t = convexTest(schema);
    const result = await t.mutation(api.lobby.create, {});

    expect(result.roomCode).toMatch(/^[A-Z0-9]+$/);
  });
});

describe("lobby.join", () => {
  test("allows player to join existing game", async () => {
    const t = convexTest(schema);

    // Create game first
    const { roomCode, gameId } = await t.mutation(api.lobby.create, {});

    // Join the game
    const result = await t.mutation(api.lobby.join, {
      roomCode,
      playerName: "TestPlayer",
    });

    expect(result.playerId).toBeDefined();
    expect(result.gameId).toBe(gameId);
    expect(result.sessionToken).toBeDefined();

    // Verify player was created correctly
    const player = await t.run(async (ctx) => {
      return await ctx.db.get(result.playerId);
    });

    expect(player?.name).toBe("TestPlayer");
    expect(player?.score).toBe(0);
    expect(player?.hp).toBe(100);
    expect(player?.isVip).toBe(true); // First player is VIP
    expect(player?.isBot).toBe(false);
  });

  test("first player becomes VIP", async () => {
    const t = convexTest(schema);
    const { roomCode } = await t.mutation(api.lobby.create, {});

    const result = await t.mutation(api.lobby.join, {
      roomCode,
      playerName: "FirstPlayer",
    });

    const player = await t.run(async (ctx) => {
      return await ctx.db.get(result.playerId);
    });

    expect(player?.isVip).toBe(true);
  });

  test("second player is not VIP", async () => {
    const t = convexTest(schema);
    const { roomCode } = await t.mutation(api.lobby.create, {});

    // First player joins
    await t.mutation(api.lobby.join, {
      roomCode,
      playerName: "FirstPlayer",
    });

    // Second player joins
    const result = await t.mutation(api.lobby.join, {
      roomCode,
      playerName: "SecondPlayer",
    });

    const player = await t.run(async (ctx) => {
      return await ctx.db.get(result.playerId);
    });

    expect(player?.isVip).toBe(false);
  });

  test("throws error for non-existent room", async () => {
    const t = convexTest(schema);

    await expect(
      t.mutation(api.lobby.join, {
        roomCode: "XXXX",
        playerName: "TestPlayer",
      })
    ).rejects.toThrow("Room not found");
  });

  test("throws error for duplicate player name", async () => {
    const t = convexTest(schema);
    const { roomCode } = await t.mutation(api.lobby.create, {});

    await t.mutation(api.lobby.join, {
      roomCode,
      playerName: "TestPlayer",
    });

    await expect(
      t.mutation(api.lobby.join, {
        roomCode,
        playerName: "TestPlayer",
      })
    ).rejects.toThrow("Name taken");
  });

  test("throws error for duplicate name (case insensitive)", async () => {
    const t = convexTest(schema);
    const { roomCode } = await t.mutation(api.lobby.create, {});

    await t.mutation(api.lobby.join, {
      roomCode,
      playerName: "TestPlayer",
    });

    await expect(
      t.mutation(api.lobby.join, {
        roomCode,
        playerName: "TESTPLAYER",
      })
    ).rejects.toThrow("Name taken");
  });

  test("throws error when game already started", async () => {
    const t = convexTest(schema);
    const { roomCode, gameId } = await t.mutation(api.lobby.create, {});

    // Manually set game status to started
    await t.run(async (ctx) => {
      await ctx.db.patch(gameId, { status: "PROMPTS" });
    });

    await expect(
      t.mutation(api.lobby.join, {
        roomCode,
        playerName: "LatePlayer",
      })
    ).rejects.toThrow("Game already started");
  });

  test("trims and validates player name", async () => {
    const t = convexTest(schema);
    const { roomCode } = await t.mutation(api.lobby.create, {});

    const result = await t.mutation(api.lobby.join, {
      roomCode,
      playerName: "  ValidName  ",
    });

    const player = await t.run(async (ctx) => {
      return await ctx.db.get(result.playerId);
    });

    expect(player?.name).toBe("ValidName");
  });
});

describe("lobby.startGame", () => {
  test("VIP can start the game", async () => {
    const t = convexTest(schema);
    const { roomCode, gameId } = await t.mutation(api.lobby.create, {});

    // Join as VIP
    const { playerId, sessionToken } = await t.mutation(api.lobby.join, {
      roomCode,
      playerName: "VIPPlayer",
    });

    // Start the game
    await t.mutation(api.lobby.startGame, {
      gameId,
      playerId,
      sessionToken,
    });

    // Verify game status changed
    const game = await t.run(async (ctx) => {
      return await ctx.db.get(gameId);
    });

    expect(game?.status).toBe("PROMPTS");
  });

  test("adds bots to reach minimum player count", async () => {
    const t = convexTest(schema);
    const { roomCode, gameId } = await t.mutation(api.lobby.create, {});

    // Only one player joins
    const { playerId, sessionToken } = await t.mutation(api.lobby.join, {
      roomCode,
      playerName: "OnlyPlayer",
    });

    await t.mutation(api.lobby.startGame, {
      gameId,
      playerId,
      sessionToken,
    });

    // Check that bots were added (minimum 6 players)
    const players = await t.run(async (ctx) => {
      return await ctx.db
        .query("players")
        .withIndex("by_game", (q) => q.eq("gameId", gameId))
        .collect();
    });

    expect(players.length).toBeGreaterThanOrEqual(6);
    expect(players.length % 2).toBe(0); // Must be even

    const bots = players.filter((p) => p.isBot);
    expect(bots.length).toBeGreaterThanOrEqual(5);
  });

  test("non-VIP cannot start game", async () => {
    const t = convexTest(schema);
    const { roomCode, gameId } = await t.mutation(api.lobby.create, {});

    // First player (VIP)
    await t.mutation(api.lobby.join, {
      roomCode,
      playerName: "VIPPlayer",
    });

    // Second player (not VIP)
    const { playerId, sessionToken } = await t.mutation(api.lobby.join, {
      roomCode,
      playerName: "RegularPlayer",
    });

    await expect(
      t.mutation(api.lobby.startGame, {
        gameId,
        playerId,
        sessionToken,
      })
    ).rejects.toThrow("Only VIP can perform this action");
  });

  test("invalid session token is rejected", async () => {
    const t = convexTest(schema);
    const { roomCode, gameId } = await t.mutation(api.lobby.create, {});

    const { playerId } = await t.mutation(api.lobby.join, {
      roomCode,
      playerName: "VIPPlayer",
    });

    await expect(
      t.mutation(api.lobby.startGame, {
        gameId,
        playerId,
        sessionToken: "invalid-token",
      })
    ).rejects.toThrow("Invalid session token");
  });
});
