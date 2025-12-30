import { Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

// Input validation constants
export const MAX_PLAYER_NAME_LENGTH = 20;
export const MAX_MESSAGE_LENGTH = 500;
export const MAX_ANSWER_LENGTH = 280;
export const MAX_SUGGESTION_LENGTH = 280;

// Generate a random session token
export function generateSessionToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Validate that a player exists and the session token matches
export async function validatePlayer(
  ctx: MutationCtx | QueryCtx,
  playerId: Id<"players">,
  sessionToken: string
) {
  const player = await ctx.db.get(playerId);
  if (!player) {
    throw new Error("Player not found");
  }
  if (!player.sessionToken || player.sessionToken !== sessionToken) {
    throw new Error("Invalid session token");
  }
  return player;
}

// Validate that the player is VIP (for admin actions like starting game)
export async function validateVipPlayer(
  ctx: MutationCtx | QueryCtx,
  playerId: Id<"players">,
  sessionToken: string
) {
  const player = await validatePlayer(ctx, playerId, sessionToken);
  if (!player.isVip) {
    throw new Error("Only VIP can perform this action");
  }
  return player;
}

// Validate and sanitize text input
export function validateTextInput(
  text: string,
  maxLength: number,
  fieldName: string
): string {
  if (!text || typeof text !== "string") {
    throw new Error(`${fieldName} is required`);
  }
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error(`${fieldName} cannot be empty`);
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} must be ${maxLength} characters or less`);
  }
  return trimmed;
}

// Validate player name (alphanumeric + spaces only)
export function validatePlayerName(name: string): string {
  const validated = validateTextInput(name, MAX_PLAYER_NAME_LENGTH, "Player name");
  // Allow letters, numbers, spaces, and common characters
  if (!/^[\w\s\-']+$/u.test(validated)) {
    throw new Error("Player name can only contain letters, numbers, spaces, hyphens, and apostrophes");
  }
  return validated;
}
