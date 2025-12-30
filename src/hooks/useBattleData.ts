import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

/**
 * useBattleData - Fetch battle data from backend with calculated damage
 *
 * This hook provides the SINGLE SOURCE OF TRUTH for damage calculations.
 * It fetches damage from the backend instead of calculating it on the frontend.
 */
export function useBattleData(promptId: Id<"prompts"> | undefined) {
  const data = useQuery(
    api.lib.battleData.getBattleData,
    promptId ? { promptId } : "skip"
  );

  return {
    isLoading: data === undefined,
    leftDamage: data?.leftDamage ?? 0,
    rightDamage: data?.rightDamage ?? 0,
    leftVotes: data?.leftVotes ?? 0,
    rightVotes: data?.rightVotes ?? 0,
    leftPlayer: data?.leftPlayer,
    rightPlayer: data?.rightPlayer,
    leftSubmission: data?.leftSubmission,
    rightSubmission: data?.rightSubmission,
  };
}
