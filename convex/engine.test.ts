import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// Helper to set up a game in voting phase with votes cast
async function setupVotingScenario(
  t: ReturnType<typeof convexTest>,
  options: {
    player1Votes: number;
    player2Votes: number;
    currentRound?: number;
  }
) {
  const { player1Votes, player2Votes, currentRound = 1 } = options;

  // Create game
  const gameId = await t.run(async (ctx) => {
    return await ctx.db.insert("games", {
      roomCode: "TEST",
      status: "VOTING",
      currentRound,
      maxRounds: 4,
    });
  });

  // Create two battling players
  const player1Id = await t.run(async (ctx) => {
    return await ctx.db.insert("players", {
      gameId,
      name: "Fighter1",
      score: 0,
      isVip: true,
      sessionToken: "token1",
      hp: 100,
      maxHp: 100,
      knockedOut: false,
      role: "FIGHTER",
      isBot: false,
    });
  });

  const player2Id = await t.run(async (ctx) => {
    return await ctx.db.insert("players", {
      gameId,
      name: "Fighter2",
      score: 0,
      isVip: false,
      sessionToken: "token2",
      hp: 100,
      maxHp: 100,
      knockedOut: false,
      role: "FIGHTER",
      isBot: false,
    });
  });

  // Create prompt
  const promptId = await t.run(async (ctx) => {
    return await ctx.db.insert("prompts", {
      gameId,
      text: "Test prompt?",
      assignedTo: [player1Id, player2Id],
    });
  });

  // Create submissions
  const sub1Id = await t.run(async (ctx) => {
    return await ctx.db.insert("submissions", {
      promptId,
      playerId: player1Id,
      text: "Player 1 answer",
    });
  });

  const sub2Id = await t.run(async (ctx) => {
    return await ctx.db.insert("submissions", {
      promptId,
      playerId: player2Id,
      text: "Player 2 answer",
    });
  });

  // Set current prompt
  await t.run(async (ctx) => {
    await ctx.db.patch(gameId, { currentPromptId: promptId });
  });

  // Create voters and cast votes
  for (let i = 0; i < player1Votes; i++) {
    const voterId = await t.run(async (ctx) => {
      return await ctx.db.insert("players", {
        gameId,
        name: `Voter${i}A`,
        score: 0,
        isVip: false,
        sessionToken: `voter${i}a`,
        hp: 100,
        maxHp: 100,
        knockedOut: false,
        role: "FIGHTER",
        isBot: false,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("votes", {
        promptId,
        playerId: voterId,
        submissionId: sub1Id,
      });
    });
  }

  for (let i = 0; i < player2Votes; i++) {
    const voterId = await t.run(async (ctx) => {
      return await ctx.db.insert("players", {
        gameId,
        name: `Voter${i}B`,
        score: 0,
        isVip: false,
        sessionToken: `voter${i}b`,
        hp: 100,
        maxHp: 100,
        knockedOut: false,
        role: "FIGHTER",
        isBot: false,
      });
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("votes", {
        promptId,
        playerId: voterId,
        submissionId: sub2Id,
      });
    });
  }

  return { gameId, player1Id, player2Id, promptId };
}

describe("engine.nextBattle - damage calculation", () => {
  test("player with fewer votes takes more damage", async () => {
    const t = convexTest(schema);
    // Player 1 gets 1 vote, Player 2 gets 3 votes
    // Player 1 takes damage from 3 votes against (75% of 35 = 26 damage)
    // Player 2 takes damage from 1 vote against (25% of 35 = 8 damage)
    const { gameId, player1Id, player2Id } = await setupVotingScenario(t, {
      player1Votes: 1,
      player2Votes: 3,
    });

    await t.mutation(api.engine.nextBattle, {
      gameId,
      playerId: player1Id,
      sessionToken: "token1",
    });

    const player1 = await t.run(async (ctx) => ctx.db.get(player1Id));
    const player2 = await t.run(async (ctx) => ctx.db.get(player2Id));

    // Player 1 had fewer votes, takes more damage
    expect(player1!.hp!).toBeLessThan(player2!.hp!);
    // Both should have taken some damage
    expect(player1!.hp!).toBeLessThan(100);
    expect(player2!.hp!).toBeLessThan(100);
  });

  test("even votes result in equal damage", async () => {
    const t = convexTest(schema);
    const { gameId, player1Id, player2Id } = await setupVotingScenario(t, {
      player1Votes: 2,
      player2Votes: 2,
    });

    await t.mutation(api.engine.nextBattle, {
      gameId,
      playerId: player1Id,
      sessionToken: "token1",
    });

    const player1 = await t.run(async (ctx) => ctx.db.get(player1Id));
    const player2 = await t.run(async (ctx) => ctx.db.get(player2Id));

    // Equal damage for equal votes
    expect(player1!.hp).toBe(player2!.hp);
  });

  test("damage cap is 35 HP per battle", async () => {
    const t = convexTest(schema);
    // All 10 votes for player 2 means player 1 takes 100% of damage
    const { gameId, player1Id, player2Id } = await setupVotingScenario(t, {
      player1Votes: 0,
      player2Votes: 10,
    });

    await t.mutation(api.engine.nextBattle, {
      gameId,
      playerId: player1Id,
      sessionToken: "token1",
    });

    const player1 = await t.run(async (ctx) => ctx.db.get(player1Id));
    const player2 = await t.run(async (ctx) => ctx.db.get(player2Id));

    // Player 1 takes max 35 damage
    expect(player1!.hp).toBe(65);
    // Player 2 takes 0 damage (won all votes)
    expect(player2!.hp).toBe(100);
  });

  test("round 4 applies 1.5x damage multiplier", async () => {
    const t = convexTest(schema);
    // Same vote distribution but in round 4
    const { gameId, player1Id } = await setupVotingScenario(t, {
      player1Votes: 0,
      player2Votes: 10,
      currentRound: 4,
    });

    await t.mutation(api.engine.nextBattle, {
      gameId,
      playerId: player1Id,
      sessionToken: "token1",
    });

    const player1 = await t.run(async (ctx) => ctx.db.get(player1Id));

    // Player 1 takes 35 * 1.5 = 52.5 damage, floored to 52, so 100 - 52 = 48
    // But the game floors (100 - 52.5) = 47
    expect(player1!.hp).toBe(47);
  });

  test("player at 0 HP is knocked out", async () => {
    const t = convexTest(schema);
    const { gameId, player1Id } = await setupVotingScenario(t, {
      player1Votes: 0,
      player2Votes: 10,
    });

    // Set player1 HP low enough to be knocked out
    await t.run(async (ctx) => {
      await ctx.db.patch(player1Id, { hp: 30 });
    });

    await t.mutation(api.engine.nextBattle, {
      gameId,
      playerId: player1Id,
      sessionToken: "token1",
    });

    const player1 = await t.run(async (ctx) => ctx.db.get(player1Id));

    expect(player1!.hp).toBe(0);
    expect(player1!.knockedOut).toBe(true);
  });

  test("no damage when no votes cast", async () => {
    const t = convexTest(schema);
    // 0 votes for both players
    const { gameId, player1Id, player2Id } = await setupVotingScenario(t, {
      player1Votes: 0,
      player2Votes: 0,
    });

    await t.mutation(api.engine.nextBattle, {
      gameId,
      playerId: player1Id,
      sessionToken: "token1",
    });

    const player1 = await t.run(async (ctx) => ctx.db.get(player1Id));
    const player2 = await t.run(async (ctx) => ctx.db.get(player2Id));

    // No damage when no votes
    expect(player1!.hp).toBe(100);
    expect(player2!.hp).toBe(100);
  });
});

describe("engine.nextBattle - game flow", () => {
  test("non-VIP cannot advance battle", async () => {
    const t = convexTest(schema);
    const { gameId, player2Id } = await setupVotingScenario(t, {
      player1Votes: 1,
      player2Votes: 1,
    });

    await expect(
      t.mutation(api.engine.nextBattle, {
        gameId,
        playerId: player2Id,
        sessionToken: "token2",
      })
    ).rejects.toThrow("Only VIP can perform this action");
  });

  test("invalid session token rejected", async () => {
    const t = convexTest(schema);
    const { gameId, player1Id } = await setupVotingScenario(t, {
      player1Votes: 1,
      player2Votes: 1,
    });

    await expect(
      t.mutation(api.engine.nextBattle, {
        gameId,
        playerId: player1Id,
        sessionToken: "wrong-token",
      })
    ).rejects.toThrow("Invalid session token");
  });
});

describe("engine.nextRound", () => {
  test("VIP can advance to next round", async () => {
    const t = convexTest(schema);

    // Create a game in ROUND_RESULTS status
    const gameId = await t.run(async (ctx) => {
      return await ctx.db.insert("games", {
        roomCode: "TEST",
        status: "ROUND_RESULTS",
        currentRound: 1,
        maxRounds: 4,
      });
    });

    // Create VIP player
    const vipId = await t.run(async (ctx) => {
      return await ctx.db.insert("players", {
        gameId,
        name: "VIP",
        score: 0,
        isVip: true,
        sessionToken: "vip-token",
        hp: 100,
        maxHp: 100,
        knockedOut: false,
        role: "FIGHTER",
        isBot: false,
      });
    });

    // Add more players to meet minimum
    for (let i = 0; i < 5; i++) {
      await t.run(async (ctx) => {
        await ctx.db.insert("players", {
          gameId,
          name: `Bot${i}`,
          score: 0,
          isVip: false,
          sessionToken: `bot${i}`,
          hp: 100,
          maxHp: 100,
          knockedOut: false,
          role: "FIGHTER",
          isBot: true,
        });
      });
    }

    await t.mutation(api.engine.nextRound, {
      gameId,
      playerId: vipId,
      sessionToken: "vip-token",
    });

    const game = await t.run(async (ctx) => ctx.db.get(gameId));

    expect(game!.currentRound).toBe(2);
  });

  test("non-VIP cannot advance round", async () => {
    const t = convexTest(schema);

    const gameId = await t.run(async (ctx) => {
      return await ctx.db.insert("games", {
        roomCode: "TEST",
        status: "ROUND_RESULTS",
        currentRound: 1,
        maxRounds: 4,
      });
    });

    const regularId = await t.run(async (ctx) => {
      return await ctx.db.insert("players", {
        gameId,
        name: "Regular",
        score: 0,
        isVip: false,
        sessionToken: "regular-token",
        hp: 100,
        maxHp: 100,
        knockedOut: false,
        role: "FIGHTER",
        isBot: false,
      });
    });

    await expect(
      t.mutation(api.engine.nextRound, {
        gameId,
        playerId: regularId,
        sessionToken: "regular-token",
      })
    ).rejects.toThrow("Only VIP can perform this action");
  });
});
