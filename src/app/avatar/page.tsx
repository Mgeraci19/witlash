"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = require("../../../convex/_generated/api").api;
import { AvatarEditor } from "@/components/avatar/AvatarEditor";
import { Id } from "../../../convex/_generated/dataModel";

function AvatarContent() {
  const searchParams = useSearchParams();
  const roomCode = searchParams.get("code") || "";
  const isEdit = searchParams.get("edit") === "true";
  const router = useRouter();

  const [playerId, setPlayerId] = useState<Id<"players"> | null>(null);
  const [sessionToken, setSessionToken] = useState<string>("");
  const [isReady, setIsReady] = useState(false);

  // Get default avatars
  const defaultAvatars = useQuery(api.avatars?.getDefaults) || [];

  // Get current player's avatar if editing
  const game = useQuery(
    api.game.get,
    roomCode ? { roomCode } : "skip"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) as any;

  const saveAvatar = useMutation(api.avatars?.saveAvatar);
  const assignRandomDefault = useMutation(api.avatars?.assignRandomDefault);

  // Get player info from session storage
  useEffect(() => {
    if (!roomCode) {
      router.push("/");
      return;
    }

    const storedId = sessionStorage.getItem("playerId");
    const storedToken = sessionStorage.getItem("sessionToken");

    if (!storedId || !storedToken) {
      router.push("/");
    } else {
      setPlayerId(storedId as Id<"players">);
      setSessionToken(storedToken);
      setIsReady(true);
    }
  }, [router, roomCode]);

  if (!roomCode || !isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  // Find current player's avatar if editing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentPlayer = game?.players.find((p: any) => p._id === playerId);
  const initialAvatar = isEdit ? currentPlayer?.avatar : undefined;

  const handleSave = async (avatarData: string) => {
    if (!playerId) return;

    await saveAvatar({
      playerId,
      sessionToken,
      avatarData,
    });

    router.push(`/room?code=${roomCode}`);
  };

  const handleSkip = async () => {
    if (!playerId) return;

    // Assign random default avatar
    try {
      await assignRandomDefault({
        playerId,
        sessionToken,
      });
    } catch {
      // If no defaults available, just continue without avatar
    }

    router.push(`/room?code=${roomCode}`);
  };

  return (
    <div className="h-screen">
      <AvatarEditor
        initialAvatar={initialAvatar}
        onSave={handleSave}
        onSkip={handleSkip}
        defaultAvatars={defaultAvatars.map((a: { _id: string; name: string; imageData: string }) => ({
          _id: a._id,
          name: a.name,
          imageData: a.imageData,
        }))}
      />
    </div>
  );
}

export default function AvatarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          Loading avatar editor...
        </div>
      }
    >
      <AvatarContent />
    </Suspense>
  );
}
