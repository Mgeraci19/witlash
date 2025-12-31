import type { GameState } from "./types";
import type { Id } from "../../convex/_generated/dataModel";

/**
 * Get prompts visible to a player based on their role
 * - Fighters (PLAYER role) see prompts where they're assigned
 * - Corner men (CORNER_MAN role) see their captain's prompts
 */
export function getPromptsForPlayer(
  prompts: GameState["prompts"],
  playerId: Id<"players"> | null | undefined,
  players: GameState["players"]
) {
  if (!prompts || !playerId) {
    console.log("[promptUtils] getPromptsForPlayer: No prompts or playerId", {
      hasPrompts: !!prompts,
      promptCount: prompts?.length,
      playerId
    });
    return [];
  }

  const player = players?.find((p) => p._id === playerId);
  if (!player) {
    console.log("[promptUtils] getPromptsForPlayer: Player not found", { playerId });
    return [];
  }

  // Corner men see their captain's prompts
  if (player.role === "CORNER_MAN" && player.teamId) {
    const captainId = player.teamId;
    const captainPrompts = prompts.filter((p) => p.assignedTo?.includes(captainId));
    console.log("[promptUtils] Corner man prompt lookup", {
      cornerManName: player.name,
      captainId,
      totalPrompts: prompts.length,
      captainPromptCount: captainPrompts.length,
      promptAssignments: prompts.map(p => ({ id: p._id, assignedTo: p.assignedTo }))
    });
    return captainPrompts;
  }

  // Fighters see their own prompts
  if (player.role === "FIGHTER" || player.role === "PLAYER") {
    return prompts.filter((p) => p.assignedTo?.includes(playerId));
  }

  console.log("[promptUtils] getPromptsForPlayer: Unknown role", { role: player.role });
  return [];
}

/**
 * Get pending prompts (without submissions) for a player based on their role
 * - For corner men, checks captain's submissions
 * - For fighters, checks their own submissions
 */
export function getPendingPromptsForPlayer(
  prompts: GameState["prompts"],
  submissions: GameState["submissions"],
  playerId: Id<"players"> | null | undefined,
  players: GameState["players"]
) {
  if (!playerId) {
    console.log("[promptUtils] getPendingPromptsForPlayer: No playerId");
    return [];
  }

  const allPrompts = getPromptsForPlayer(prompts, playerId, players);

  const player = players?.find((p) => p._id === playerId);
  if (!player) {
    console.log("[promptUtils] getPendingPromptsForPlayer: Player not found", { playerId });
    return [];
  }

  // For corner men, check captain's submissions; for fighters, check own
  const submitterIdToCheck = player.role === "CORNER_MAN" ? player.teamId : playerId;

  const pendingPrompts = allPrompts.filter((p) =>
    !submissions?.some((s) => s.promptId === p._id && s.playerId === submitterIdToCheck)
  );

  console.log("[promptUtils] getPendingPromptsForPlayer result", {
    playerName: player.name,
    role: player.role,
    teamId: player.teamId,
    submitterIdToCheck,
    allPromptsCount: allPrompts.length,
    pendingCount: pendingPrompts.length,
    submissionsCount: submissions?.length || 0
  });

  return pendingPrompts;
}
