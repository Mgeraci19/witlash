import { describe, expect, test } from "vitest";
import { getPromptsForPlayer, getPendingPromptsForPlayer } from "./promptUtils";
import type { GameState } from "./types";
import type { Id } from "../../convex/_generated/dataModel";

// Helper to create mock player data
function createMockPlayer(
  id: string,
  name: string,
  role: "FIGHTER" | "CORNER_MAN",
  teamId?: string
): GameState["players"][number] {
  return {
    _id: id as Id<"players">,
    _creationTime: Date.now(),
    gameId: "game1" as Id<"games">,
    name,
    score: 0,
    isVip: false,
    hp: 100,
    maxHp: 100,
    knockedOut: role === "CORNER_MAN",
    role,
    isBot: false,
    teamId: teamId as Id<"players"> | undefined,
    sessionToken: `token-${id}`,
  };
}

// Helper to create mock prompt data
function createMockPrompt(
  id: string,
  assignedTo: string[]
): GameState["prompts"][number] {
  return {
    _id: id as Id<"prompts">,
    _creationTime: Date.now(),
    gameId: "game1" as Id<"games">,
    text: `Prompt ${id}`,
    assignedTo: assignedTo as Id<"players">[],
  };
}

// Helper to create mock submission data
function createMockSubmission(
  id: string,
  promptId: string,
  playerId: string
): GameState["submissions"][number] {
  return {
    _id: id as Id<"submissions">,
    _creationTime: Date.now(),
    promptId: promptId as Id<"prompts">,
    playerId: playerId as Id<"players">,
    text: `Answer ${id}`,
  };
}

describe("getPromptsForPlayer", () => {
  test("fighter sees their own prompts", () => {
    const players = [
      createMockPlayer("player1", "Fighter1", "FIGHTER"),
      createMockPlayer("player2", "Fighter2", "FIGHTER"),
    ];

    const prompts = [
      createMockPrompt("prompt1", ["player1", "player2"]),
      createMockPrompt("prompt2", ["player1", "player2"]),
      createMockPrompt("prompt3", ["player3", "player4"]), // Different players
    ];

    const result = getPromptsForPlayer(
      prompts,
      "player1" as Id<"players">,
      players
    );

    expect(result).toHaveLength(2);
    expect(result.map((p) => p._id)).toEqual(["prompt1", "prompt2"]);
  });

  test("corner man sees captain's prompts", () => {
    const players = [
      createMockPlayer("captain1", "Captain", "FIGHTER"),
      createMockPlayer("cornerMan1", "CornerMan", "CORNER_MAN", "captain1"),
    ];

    const prompts = [
      createMockPrompt("prompt1", ["captain1", "otherPlayer"]),
      createMockPrompt("prompt2", ["captain1", "anotherPlayer"]),
      createMockPrompt("prompt3", ["differentPlayer", "yetAnother"]), // Not captain's
    ];

    const result = getPromptsForPlayer(
      prompts,
      "cornerMan1" as Id<"players">,
      players
    );

    expect(result).toHaveLength(2);
    expect(result.map((p) => p._id)).toEqual(["prompt1", "prompt2"]);
  });

  test("returns empty array if player not found", () => {
    const players = [createMockPlayer("player1", "Fighter1", "FIGHTER")];
    const prompts = [createMockPrompt("prompt1", ["player1", "player2"])];

    const result = getPromptsForPlayer(
      prompts,
      "nonexistent" as Id<"players">,
      players
    );

    expect(result).toHaveLength(0);
  });

  test("returns empty array if no playerId provided", () => {
    const players = [createMockPlayer("player1", "Fighter1", "FIGHTER")];
    const prompts = [createMockPrompt("prompt1", ["player1", "player2"])];

    const result = getPromptsForPlayer(prompts, null, players);

    expect(result).toHaveLength(0);
  });
});

describe("getPendingPromptsForPlayer", () => {
  test("fighter sees prompts without their submissions", () => {
    const players = [
      createMockPlayer("player1", "Fighter1", "FIGHTER"),
      createMockPlayer("player2", "Fighter2", "FIGHTER"),
    ];

    const prompts = [
      createMockPrompt("prompt1", ["player1", "player2"]),
      createMockPrompt("prompt2", ["player1", "player2"]),
    ];

    const submissions = [
      createMockSubmission("sub1", "prompt1", "player1"), // Player 1 answered prompt 1
    ];

    const result = getPendingPromptsForPlayer(
      prompts,
      submissions,
      "player1" as Id<"players">,
      players
    );

    // Only prompt2 is pending (prompt1 already answered)
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("prompt2");
  });

  test("corner man sees captain's pending prompts", () => {
    const players = [
      createMockPlayer("captain1", "Captain", "FIGHTER"),
      createMockPlayer("cornerMan1", "CornerMan", "CORNER_MAN", "captain1"),
    ];

    const prompts = [
      createMockPrompt("prompt1", ["captain1", "otherPlayer"]),
      createMockPrompt("prompt2", ["captain1", "anotherPlayer"]),
    ];

    const submissions = [
      createMockSubmission("sub1", "prompt1", "captain1"), // Captain answered prompt 1
    ];

    const result = getPendingPromptsForPlayer(
      prompts,
      submissions,
      "cornerMan1" as Id<"players">,
      players
    );

    // Only prompt2 is pending (captain already answered prompt1)
    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe("prompt2");
  });

  test("corner man sees all captain's prompts when captain hasn't answered any", () => {
    const players = [
      createMockPlayer("captain1", "Captain", "FIGHTER"),
      createMockPlayer("cornerMan1", "CornerMan", "CORNER_MAN", "captain1"),
    ];

    const prompts = [
      createMockPrompt("prompt1", ["captain1", "otherPlayer"]),
      createMockPrompt("prompt2", ["captain1", "anotherPlayer"]),
      createMockPrompt("prompt3", ["captain1", "thirdPlayer"]),
    ];

    const submissions: GameState["submissions"] = []; // No submissions

    const result = getPendingPromptsForPlayer(
      prompts,
      submissions,
      "cornerMan1" as Id<"players">,
      players
    );

    // All 3 prompts should be pending
    expect(result).toHaveLength(3);
  });

  test("returns empty array when all prompts answered", () => {
    const players = [
      createMockPlayer("player1", "Fighter1", "FIGHTER"),
      createMockPlayer("player2", "Fighter2", "FIGHTER"),
    ];

    const prompts = [
      createMockPrompt("prompt1", ["player1", "player2"]),
      createMockPrompt("prompt2", ["player1", "player2"]),
    ];

    const submissions = [
      createMockSubmission("sub1", "prompt1", "player1"),
      createMockSubmission("sub2", "prompt2", "player1"),
    ];

    const result = getPendingPromptsForPlayer(
      prompts,
      submissions,
      "player1" as Id<"players">,
      players
    );

    expect(result).toHaveLength(0);
  });
});
