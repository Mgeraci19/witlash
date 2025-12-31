import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  games: defineTable({
    roomCode: v.string(),
    status: v.string(), // "LOBBY" | "PROMPTS" | "VOTING" | "ROUND_RESULTS" | "RESULTS"
    currentRound: v.number(),
    maxRounds: v.optional(v.number()),
    currentPromptId: v.optional(v.id("prompts")),
    roundStatus: v.optional(v.string()), // "VOTING" | "REVEAL"
    usedPromptIndices: v.optional(v.array(v.number())), // Track used prompt indices
    hostToken: v.optional(v.string()), // Auth token for host display
    isTransitioning: v.optional(v.boolean()), // Prevent race conditions during state transitions
    round2Pairings: v.optional(v.array(v.object({
      fighter1Id: v.id("players"),
      fighter2Id: v.id("players"),
    }))), // Snapshot of Round 2 pairings for transition display
    round2ExecutedPlayerIds: v.optional(v.array(v.id("players"))), // Players executed at end of Round 2
  }).index("by_room_code", ["roomCode"]),

  players: defineTable({
    gameId: v.id("games"),
    name: v.string(),
    score: v.number(),
    isVip: v.boolean(),
    sessionToken: v.optional(v.string()), // Auth token for player actions
    // SmackTalk specific fields
    hp: v.optional(v.number()),
    maxHp: v.optional(v.number()),
    knockedOut: v.optional(v.boolean()),
    role: v.optional(v.string()), // "FIGHTER" | "CORNER_MAN"
    teamId: v.optional(v.id("players")), // Linked to the "Team Captain" (Winner of the pairing)
    becameCornerManInRound: v.optional(v.number()), // Track which round player was KO'd
    isBot: v.optional(v.boolean()),
    avatar: v.optional(v.string()), // Base64 PNG avatar image
    winStreak: v.optional(v.number()), // Track consecutive wins for combo bonuses
    lossStreak: v.optional(v.number()), // Track consecutive losses
  }).index("by_game", ["gameId"]),

  // temporary for chat verification
  messages: defineTable({
    gameId: v.id("games"),
    playerId: v.id("players"),
    text: v.string(),
  }).index("by_game", ["gameId"]),

  // Phase 3: Game Logic Tables
  prompts: defineTable({
    gameId: v.id("games"),
    text: v.string(),
    assignedTo: v.optional(v.array(v.id("players"))), // The 2 players who must answer this
  }).index("by_game", ["gameId"]),

  submissions: defineTable({
    promptId: v.id("prompts"),
    playerId: v.id("players"),
    text: v.string(),
  })
    .index("by_prompt", ["promptId"])
    .index("by_prompt_player", ["promptId", "playerId"]),

  votes: defineTable({
    promptId: v.id("prompts"),
    submissionId: v.id("submissions"),
    playerId: v.id("players"),
  })
    .index("by_prompt", ["promptId"])
    .index("by_prompt_player", ["promptId", "playerId"]),

  suggestions: defineTable({
    gameId: v.id("games"),
    promptId: v.id("prompts"),
    senderId: v.id("players"), // Corner Man
    targetId: v.id("players"), // Captain
    text: v.string(),
  })
    .index("by_game", ["gameId"])
    .index("by_target", ["targetId", "promptId"]),

  // Pre-made avatar templates for selection/bots
  defaultAvatars: defineTable({
    name: v.string(), // "Robot", "Ninja", etc.
    imageData: v.string(), // Base64 PNG
  }),
});
