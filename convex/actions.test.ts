import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

// Helper to create a game with players and a prompt
async function setupGameWithPrompt(t: ReturnType<typeof convexTest>) {
  const { roomCode, gameId } = await t.mutation(api.lobby.create, {});

  // Add two players
  const player1 = await t.mutation(api.lobby.join, {
    roomCode,
    playerName: "Player1",
  });

  const player2 = await t.mutation(api.lobby.join, {
    roomCode,
    playerName: "Player2",
  });

  // Add a third player for voting (battlers can't vote in their own battle)
  const voter = await t.mutation(api.lobby.join, {
    roomCode,
    playerName: "Voter",
  });

  // Create a prompt manually
  const promptId = await t.run(async (ctx) => {
    return await ctx.db.insert("prompts", {
      gameId,
      text: "Test prompt?",
      assignedTo: [player1.playerId, player2.playerId],
    });
  });

  // Set game to PROMPTS status
  await t.run(async (ctx) => {
    await ctx.db.patch(gameId, { status: "PROMPTS" });
  });

  return { gameId, player1, player2, voter, promptId };
}

describe("actions.submitAnswer", () => {
  test("player can submit answer", async () => {
    const t = convexTest(schema);
    const { gameId, player1, promptId } = await setupGameWithPrompt(t);

    await t.mutation(api.actions.submitAnswer, {
      gameId,
      playerId: player1.playerId,
      sessionToken: player1.sessionToken,
      promptId,
      text: "My witty answer",
    });

    // Verify submission was created
    const submissions = await t.run(async (ctx) => {
      return await ctx.db
        .query("submissions")
        .withIndex("by_prompt", (q) => q.eq("promptId", promptId))
        .collect();
    });

    expect(submissions).toHaveLength(1);
    expect(submissions[0].text).toBe("My witty answer");
    expect(submissions[0].playerId).toBe(player1.playerId);
  });

  test("trims whitespace from answer", async () => {
    const t = convexTest(schema);
    const { gameId, player1, promptId } = await setupGameWithPrompt(t);

    await t.mutation(api.actions.submitAnswer, {
      gameId,
      playerId: player1.playerId,
      sessionToken: player1.sessionToken,
      promptId,
      text: "  Trimmed answer  ",
    });

    const submissions = await t.run(async (ctx) => {
      return await ctx.db
        .query("submissions")
        .withIndex("by_prompt", (q) => q.eq("promptId", promptId))
        .collect();
    });

    expect(submissions[0].text).toBe("Trimmed answer");
  });

  test("rejects empty answer", async () => {
    const t = convexTest(schema);
    const { gameId, player1, promptId } = await setupGameWithPrompt(t);

    await expect(
      t.mutation(api.actions.submitAnswer, {
        gameId,
        playerId: player1.playerId,
        sessionToken: player1.sessionToken,
        promptId,
        text: "",
      })
    ).rejects.toThrow("Answer is required");
  });

  test("rejects invalid session token", async () => {
    const t = convexTest(schema);
    const { gameId, player1, promptId } = await setupGameWithPrompt(t);

    await expect(
      t.mutation(api.actions.submitAnswer, {
        gameId,
        playerId: player1.playerId,
        sessionToken: "wrong-token",
        promptId,
        text: "My answer",
      })
    ).rejects.toThrow("Invalid session token");
  });

  test("transitions to VOTING when all answers submitted", async () => {
    const t = convexTest(schema);
    const { gameId, player1, player2, promptId } = await setupGameWithPrompt(t);

    // Player 1 submits
    await t.mutation(api.actions.submitAnswer, {
      gameId,
      playerId: player1.playerId,
      sessionToken: player1.sessionToken,
      promptId,
      text: "Answer 1",
    });

    // Player 2 submits
    await t.mutation(api.actions.submitAnswer, {
      gameId,
      playerId: player2.playerId,
      sessionToken: player2.sessionToken,
      promptId,
      text: "Answer 2",
    });

    // Verify game transitioned to VOTING
    const game = await t.run(async (ctx) => {
      return await ctx.db.get(gameId);
    });

    expect(game?.status).toBe("VOTING");
    expect(game?.currentPromptId).toBe(promptId);
  });
});

describe("actions.submitVote", () => {
  async function setupVotingGame(t: ReturnType<typeof convexTest>) {
    const setup = await setupGameWithPrompt(t);
    const { gameId, player1, player2, promptId } = setup;

    // Submit answers from both battlers
    await t.mutation(api.actions.submitAnswer, {
      gameId,
      playerId: player1.playerId,
      sessionToken: player1.sessionToken,
      promptId,
      text: "Answer 1",
    });

    await t.mutation(api.actions.submitAnswer, {
      gameId,
      playerId: player2.playerId,
      sessionToken: player2.sessionToken,
      promptId,
      text: "Answer 2",
    });

    // Get submission IDs
    const submissions = await t.run(async (ctx) => {
      return await ctx.db
        .query("submissions")
        .filter((q) => q.eq(q.field("promptId"), promptId))
        .collect();
    });

    return {
      ...setup,
      submission1: submissions[0],
      submission2: submissions[1],
    };
  }

  test("voter can vote for a submission", async () => {
    const t = convexTest(schema);
    const { gameId, voter, promptId, submission1 } = await setupVotingGame(t);

    await t.mutation(api.actions.submitVote, {
      gameId,
      playerId: voter.playerId,
      sessionToken: voter.sessionToken,
      promptId,
      submissionId: submission1._id,
    });

    // Verify vote was recorded
    const votes = await t.run(async (ctx) => {
      return await ctx.db
        .query("votes")
        .withIndex("by_prompt", (q) => q.eq("promptId", promptId))
        .collect();
    });

    expect(votes).toHaveLength(1);
    expect(votes[0].submissionId).toBe(submission1._id);
    expect(votes[0].playerId).toBe(voter.playerId);
  });

  test("battler cannot vote in their own battle", async () => {
    const t = convexTest(schema);
    const { gameId, player1, promptId, submission2 } = await setupVotingGame(t);

    await expect(
      t.mutation(api.actions.submitVote, {
        gameId,
        playerId: player1.playerId,
        sessionToken: player1.sessionToken,
        promptId,
        submissionId: submission2._id,
      })
    ).rejects.toThrow("You cannot vote in your own battle");
  });

  test("cannot vote twice for same prompt", async () => {
    const t = convexTest(schema);
    const { gameId, voter, promptId, submission1, submission2 } =
      await setupVotingGame(t);

    // First vote
    await t.mutation(api.actions.submitVote, {
      gameId,
      playerId: voter.playerId,
      sessionToken: voter.sessionToken,
      promptId,
      submissionId: submission1._id,
    });

    // Second vote should fail
    await expect(
      t.mutation(api.actions.submitVote, {
        gameId,
        playerId: voter.playerId,
        sessionToken: voter.sessionToken,
        promptId,
        submissionId: submission2._id,
      })
    ).rejects.toThrow("Already voted");
  });

  test("rejects invalid session token", async () => {
    const t = convexTest(schema);
    const { gameId, voter, promptId, submission1 } = await setupVotingGame(t);

    await expect(
      t.mutation(api.actions.submitVote, {
        gameId,
        playerId: voter.playerId,
        sessionToken: "wrong-token",
        promptId,
        submissionId: submission1._id,
      })
    ).rejects.toThrow("Invalid session token");
  });
});

describe("actions.sendMessage", () => {
  test("player can send message", async () => {
    const t = convexTest(schema);
    const { roomCode, gameId } = await t.mutation(api.lobby.create, {});

    const { playerId, sessionToken } = await t.mutation(api.lobby.join, {
      roomCode,
      playerName: "Chatter",
    });

    await t.mutation(api.actions.sendMessage, {
      gameId,
      playerId,
      sessionToken,
      text: "Hello everyone!",
    });

    const messages = await t.run(async (ctx) => {
      return await ctx.db
        .query("messages")
        .withIndex("by_game", (q) => q.eq("gameId", gameId))
        .collect();
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].text).toBe("Hello everyone!");
  });

  test("rejects message with invalid token", async () => {
    const t = convexTest(schema);
    const { roomCode, gameId } = await t.mutation(api.lobby.create, {});

    const { playerId } = await t.mutation(api.lobby.join, {
      roomCode,
      playerName: "Chatter",
    });

    await expect(
      t.mutation(api.actions.sendMessage, {
        gameId,
        playerId,
        sessionToken: "invalid",
        text: "Hello!",
      })
    ).rejects.toThrow("Invalid session token");
  });
});
