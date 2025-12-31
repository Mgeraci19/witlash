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
      maxRounds: 3, // New game flow: Main Round, Semi-Finals, Final
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

  // Create submissions (player 1 submits first for speed tiebreaker)
  const sub1Id = await t.run(async (ctx) => {
    return await ctx.db.insert("submissions", {
      promptId,
      playerId: player1Id,
      text: "Player 1 answer",
      submittedAt: 1000, // Earlier timestamp = wins speed tiebreaker
    });
  });

  const sub2Id = await t.run(async (ctx) => {
    return await ctx.db.insert("submissions", {
      promptId,
      playerId: player2Id,
      text: "Player 2 answer",
      submittedAt: 2000, // Later timestamp
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
  test("player with fewer votes takes damage (0.5x in Main Round)", async () => {
    const t = convexTest(schema);
    // Player 1 gets 1 vote, Player 2 gets 3 votes
    // In Main Round (Round 1): damage = (3/4) * 35 * 0.5 = 13.125 → 13
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

    // Player 1 (loser) takes 0.5x damage: (3/4) * 35 * 0.5 = 13
    // HP can't go below 1 in Main Round (only special bar kills)
    expect(player1!.hp!).toBe(87);
    // Player 2 (winner) takes NO damage, gets winStreak+1 and special bar+1
    expect(player2!.hp!).toBe(100);
    expect(player2!.winStreak).toBe(1);
    expect(player2!.specialBar).toBe(1);
    // Player 1 has winStreak reset to 0
    expect(player1!.winStreak).toBe(0);
  });

  test("even votes use speed tiebreaker (faster submitter wins)", async () => {
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

    // Player 1 submitted first (timestamp 1000 vs 2000), so they win
    // Winner gets +1 special bar
    expect(player1!.specialBar ?? 0).toBe(1);
    expect(player1!.hp).toBe(100); // Winner takes no damage

    // Loser takes damage (0.5x multiplier in Main Round)
    // With 2-2 votes (50% each), damage = 0.5 * 35 * 0.5 = ~8
    expect(player2!.hp).toBeLessThan(100);
    expect(player2!.specialBar ?? 0).toBe(0);
  });

  test("Main Round max damage is ~17 HP (0.5x of 35)", async () => {
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

    // Player 1 takes max damage: 35 * 0.5 = 17.5 → 17
    // HP can't go below 1 in Main Round
    expect(player1!.hp).toBe(83);
    // Player 2 takes 0 damage (won all votes)
    expect(player2!.hp).toBe(100);
  });

  test("Special bar triggers KO at 3.0", async () => {
    const t = convexTest(schema);
    const { gameId, player1Id, player2Id } = await setupVotingScenario(t, {
      player1Votes: 0,
      player2Votes: 10,
    });

    // Give player2 special bar of 2.0 (one more win triggers KO)
    await t.run(async (ctx) => {
      await ctx.db.patch(player2Id, { specialBar: 2.0 });
    });

    await t.mutation(api.engine.nextBattle, {
      gameId,
      playerId: player1Id,
      sessionToken: "token1",
    });

    const player1 = await t.run(async (ctx) => ctx.db.get(player1Id));
    const player2 = await t.run(async (ctx) => ctx.db.get(player2Id));

    // Player 2's special bar should now be 3.0, triggering KO on player 1
    expect(player2!.specialBar).toBe(3.0);
    expect(player1!.hp).toBe(0);
    expect(player1!.knockedOut).toBe(true);
    expect(player1!.role).toBe("CORNER_MAN");
    expect(player1!.teamId).toBe(player2Id); // Loser becomes corner man for winner
  });

  test("HP cannot kill in Main Round (min 1 HP)", async () => {
    const t = convexTest(schema);
    const { gameId, player1Id, player2Id } = await setupVotingScenario(t, {
      player1Votes: 0,
      player2Votes: 10,
    });

    // Set player1 HP very low
    await t.run(async (ctx) => {
      await ctx.db.patch(player1Id, { hp: 5 });
    });

    await t.mutation(api.engine.nextBattle, {
      gameId,
      playerId: player1Id,
      sessionToken: "token1",
    });

    const player1 = await t.run(async (ctx) => ctx.db.get(player1Id));
    const player2 = await t.run(async (ctx) => ctx.db.get(player2Id));

    // HP can't go below 1 in Main Round (only special bar kills)
    // Since player2's special bar is 0→1 (not 3.0), no KO
    expect(player1!.hp).toBe(1);
    expect(player1!.knockedOut).toBe(false);
    expect(player2!.specialBar).toBe(1.0);
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

  test("Special bar accumulates with each win", async () => {
    const t = convexTest(schema);
    const { gameId, player1Id, player2Id } = await setupVotingScenario(t, {
      player1Votes: 3,
      player2Votes: 1,
    });

    // Give player1 special bar of 1.0 (simulating a previous win)
    await t.run(async (ctx) => {
      await ctx.db.patch(player1Id, { specialBar: 1.0 });
    });

    await t.mutation(api.engine.nextBattle, {
      gameId,
      playerId: player1Id,
      sessionToken: "token1",
    });

    const player1 = await t.run(async (ctx) => ctx.db.get(player1Id));
    const player2 = await t.run(async (ctx) => ctx.db.get(player2Id));

    // Player1 special bar increments to 2.0
    expect(player1!.specialBar).toBe(2.0);
    expect(player1!.winStreak).toBe(1);
    // Player2 takes damage but special bar unchanged (they lost)
    expect(player2!.hp).toBe(87); // 100 - 13 = 87 (0.5x damage)
    expect(player2!.winStreak).toBe(0);
  });

  test("Final round applies attack type multipliers", async () => {
    const t = convexTest(schema);
    // Use Final round (Round 3)
    const { gameId, player1Id, player2Id } = await setupVotingScenario(t, {
      player1Votes: 0,
      player2Votes: 10,
      currentRound: 3, // Final
    });

    // Set up Final round HP (200) and submissions with attack types
    await t.run(async (ctx) => {
      await ctx.db.patch(player1Id, { hp: 200, maxHp: 200 });
      await ctx.db.patch(player2Id, { hp: 200, maxHp: 200 });

      // Update submissions to have attack types
      const subs = await ctx.db.query("submissions").collect();
      // Player 2 (winner) uses flyingKick (3x dealt)
      // Player 1 (loser) uses jab (1x received)
      // Loser takes max(3x dealt, 1x received) = 3x damage
      for (const sub of subs) {
        if (sub.playerId === player2Id) {
          await ctx.db.patch(sub._id, { attackType: "flyingKick" as const });
        } else {
          await ctx.db.patch(sub._id, { attackType: "jab" as const });
        }
      }
    });

    await t.mutation(api.engine.nextBattle, {
      gameId,
      playerId: player1Id,
      sessionToken: "token1",
    });

    const player1 = await t.run(async (ctx) => ctx.db.get(player1Id));
    const player2 = await t.run(async (ctx) => ctx.db.get(player2Id));

    // Player 1 takes 3x damage: 35 * 3 = 105
    expect(player1!.hp).toBe(95); // 200 - 105 = 95
    expect(player2!.hp).toBe(200); // Winner takes no damage
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
        maxRounds: 3, // New game flow
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
        maxRounds: 3, // New game flow
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
        maxRounds: 3, // New game flow
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
  test("KO'd players are excluded from Semi-Finals pairing", async () => {
    const t = convexTest(schema);

    // Create a game ready for Semi-Finals (Round 2)
    const gameId = await t.run(async (ctx) => {
      return await ctx.db.insert("games", {
        roomCode: "TEST",
        status: "ROUND_RESULTS",
        currentRound: 1,
        maxRounds: 3, // New game flow
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
    await t.run(async (ctx) => {
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

    // Create a game ready for Final (Round 3)
    const gameId = await t.run(async (ctx) => {
      return await ctx.db.insert("games", {
        roomCode: "TEST",
        status: "ROUND_RESULTS",
        currentRound: 2,
        maxRounds: 3, // New game flow
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
