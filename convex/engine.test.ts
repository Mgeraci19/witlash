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
    // Player 1 (loser) takes damage from 3 votes against (75% of 35 = 26 damage)
    // Player 2 (winner) takes NO damage
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

    // Player 1 had fewer votes (loser), takes damage
    // Damage = (3/4) * 35 = 26.25 → floor(100 - 26.25) = 73
    expect(player1!.hp!).toBe(73);
    // Player 2 had more votes (winner), takes NO damage, gets winStreak
    expect(player2!.hp!).toBe(100);
    expect(player2!.winStreak).toBe(1);
    // Player 1 has winStreak reset to 0
    expect(player1!.winStreak).toBe(0);
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
    // Both have winStreak reset to 0 (normal tie resets combos)
    expect(player1!.winStreak).toBe(0);
    expect(player2!.winStreak).toBe(0);
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

  test("2-win combo applies bonus damage", async () => {
    const t = convexTest(schema);
    const { gameId, player1Id, player2Id } = await setupVotingScenario(t, {
      player1Votes: 3,
      player2Votes: 1,
    });

    // Give player1 a winStreak of 1 (simulating a previous win)
    await t.run(async (ctx) => {
      await ctx.db.patch(player1Id, { winStreak: 1 });
    });

    await t.mutation(api.engine.nextBattle, {
      gameId,
      playerId: player1Id,
      sessionToken: "token1",
    });

    const player1 = await t.run(async (ctx) => ctx.db.get(player1Id));
    const player2 = await t.run(async (ctx) => ctx.db.get(player2Id));

    // Player2 takes base damage + COMBO_BONUS_DAMAGE (15)
    // Base damage: (3/4) * 35 = 26.25, + 15 bonus = 41.25
    // floor(100 - 41.25) = floor(58.75) = 58
    expect(player2!.hp).toBe(58);
    // Player1 winStreak increments to 2
    expect(player1!.winStreak).toBe(2);
    // Player2 winStreak resets to 0
    expect(player2!.winStreak).toBe(0);
  });

  test("3-win combo triggers instant KO", async () => {
    const t = convexTest(schema);
    const { gameId, player1Id, player2Id } = await setupVotingScenario(t, {
      player1Votes: 3,
      player2Votes: 1,
    });

    // Give player1 a winStreak of 2 (simulating 2 previous wins)
    await t.run(async (ctx) => {
      await ctx.db.patch(player1Id, { winStreak: 2 });
    });

    await t.mutation(api.engine.nextBattle, {
      gameId,
      playerId: player1Id,
      sessionToken: "token1",
    });

    const player1 = await t.run(async (ctx) => ctx.db.get(player1Id));
    const player2 = await t.run(async (ctx) => ctx.db.get(player2Id));

    // Player2 takes instant KO damage (HP = 0)
    expect(player2!.hp).toBe(0);
    expect(player2!.knockedOut).toBe(true);
    // Player1 winStreak increments to 3
    expect(player1!.winStreak).toBe(3);
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

  test("nextRound resets all winStreaks", async () => {
    const t = convexTest(schema);

    const gameId = await t.run(async (ctx) => {
      return await ctx.db.insert("games", {
        roomCode: "TEST",
        status: "ROUND_RESULTS",
        currentRound: 1,
        maxRounds: 4,
      });
    });

    // Create VIP player with winStreak
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
        winStreak: 2, // Has a combo streak
      });
    });

    // Add more players with various winStreaks
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
          winStreak: i % 3, // Mix of 0, 1, 2
        });
      });
    }

    await t.mutation(api.engine.nextRound, {
      gameId,
      playerId: vipId,
      sessionToken: "vip-token",
    });

    // Check all players have winStreak reset to 0
    const allPlayers = await t.run(async (ctx) =>
      ctx.db.query("players").withIndex("by_game", q => q.eq("gameId", gameId)).collect()
    );

    for (const player of allPlayers) {
      expect(player.winStreak).toBe(0);
    }
  });
});

describe("Pairing exclusion - Bug 10", () => {
  test("KO'd players are excluded from Phase 2 pairing", async () => {
    const t = convexTest(schema);

    // Create a game ready for Phase 2
    const gameId = await t.run(async (ctx) => {
      return await ctx.db.insert("games", {
        roomCode: "TEST",
        status: "ROUND_RESULTS",
        currentRound: 1,
        maxRounds: 4,
      });
    });

    // Create VIP player (active)
    const vipId = await t.run(async (ctx) => {
      return await ctx.db.insert("players", {
        gameId,
        name: "VIP",
        score: 0,
        isVip: true,
        sessionToken: "vip-token",
        hp: 80,
        maxHp: 100,
        knockedOut: false,
        role: "FIGHTER",
        isBot: false,
      });
    });

    // Create active player
    const activePlayerId = await t.run(async (ctx) => {
      return await ctx.db.insert("players", {
        gameId,
        name: "ActivePlayer",
        score: 0,
        isVip: false,
        sessionToken: "active-token",
        hp: 70,
        maxHp: 100,
        knockedOut: false,
        role: "FIGHTER",
        isBot: false,
      });
    });

    // Create KO'd player - should NOT be paired
    const koPlayerName = "KO'd_Player";
    await t.run(async (ctx) => {
      return await ctx.db.insert("players", {
        gameId,
        name: koPlayerName,
        score: 0,
        isVip: false,
        sessionToken: "ko-token",
        hp: 0,
        maxHp: 100,
        knockedOut: true, // KO'd
        role: "CORNER_MAN", // After KO, role changes to CORNER_MAN
        teamId: vipId, // Assigned to VIP
        isBot: false,
      });
    });

    // Add more active players to have enough for pairing
    for (let i = 0; i < 3; i++) {
      await t.run(async (ctx) => {
        await ctx.db.insert("players", {
          gameId,
          name: `ActiveBot${i}`,
          score: 0,
          isVip: false,
          sessionToken: `activebot${i}`,
          hp: 60 + i * 10,
          maxHp: 100,
          knockedOut: false,
          role: "FIGHTER",
          isBot: true,
        });
      });
    }

    // Advance to Round 2
    await t.mutation(api.engine.nextRound, {
      gameId,
      playerId: vipId,
      sessionToken: "vip-token",
    });

    // Check that prompts were created only for active players
    const prompts = await t.run(async (ctx) =>
      ctx.db.query("prompts").withIndex("by_game", q => q.eq("gameId", gameId)).collect()
    );

    // Verify no prompt contains the KO'd player
    for (const prompt of prompts) {
      expect(prompt.assignedTo).toBeDefined();
      for (const playerId of prompt.assignedTo!) {
        const player = await t.run(async (ctx) => ctx.db.get(playerId));
        expect(player!.knockedOut).toBe(false);
        expect(player!.role).toBe("FIGHTER");
        expect(player!.name).not.toBe(koPlayerName);
      }
    }
  });

  test("CORNER_MAN role players are excluded from pairing", async () => {
    const t = convexTest(schema);

    // Create a game ready for Phase 3
    const gameId = await t.run(async (ctx) => {
      return await ctx.db.insert("games", {
        roomCode: "TEST",
        status: "ROUND_RESULTS",
        currentRound: 2,
        maxRounds: 4,
      });
    });

    // Create VIP player (active fighter)
    const vipId = await t.run(async (ctx) => {
      return await ctx.db.insert("players", {
        gameId,
        name: "VIP",
        score: 0,
        isVip: true,
        sessionToken: "vip-token",
        hp: 80,
        maxHp: 100,
        knockedOut: false,
        role: "FIGHTER",
        isBot: false,
      });
    });

    // Create corner man - should NOT be paired
    const cornerManName = "CornerMan";
    await t.run(async (ctx) => {
      return await ctx.db.insert("players", {
        gameId,
        name: cornerManName,
        score: 0,
        isVip: false,
        sessionToken: "corner-token",
        hp: 0,
        maxHp: 100,
        knockedOut: true,
        role: "CORNER_MAN",
        teamId: vipId,
        isBot: false,
      });
    });

    // Add another active fighter
    await t.run(async (ctx) => {
      return await ctx.db.insert("players", {
        gameId,
        name: "OtherFighter",
        score: 0,
        isVip: false,
        sessionToken: "other-token",
        hp: 60,
        maxHp: 100,
        knockedOut: false,
        role: "FIGHTER",
        isBot: false,
      });
    });

    // Advance to Round 3 (Gauntlet)
    await t.mutation(api.engine.nextRound, {
      gameId,
      playerId: vipId,
      sessionToken: "vip-token",
    });

    // Check prompts - corner man should not be in any
    const prompts = await t.run(async (ctx) =>
      ctx.db.query("prompts").withIndex("by_game", q => q.eq("gameId", gameId)).collect()
    );

    for (const prompt of prompts) {
      expect(prompt.assignedTo).toBeDefined();
      for (const playerId of prompt.assignedTo!) {
        const player = await t.run(async (ctx) => ctx.db.get(playerId));
        expect(player!.role).toBe("FIGHTER");
        expect(player!.name).not.toBe(cornerManName);
      }
    }
  });
});
