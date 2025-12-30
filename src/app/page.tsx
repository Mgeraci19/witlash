"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useErrorState } from "@/hooks/useErrorState";

export default function Home() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { error, showError, clearError } = useErrorState();
  const createGame = useMutation(api.lobby.create);
  const joinGame = useMutation(api.lobby.join);
  const router = useRouter();

  const handleHost = async () => {
    if (isLoading) return;
    setIsLoading(true);
    clearError();
    try {
      const { roomCode, hostToken } = await createGame({});
      sessionStorage.setItem("hostToken", hostToken);
      router.push(`/host?code=${roomCode}`);
    } catch (e: unknown) {
      console.error(e);
      const message = e instanceof Error ? e.message : "Failed to create game";
      showError("host-failed", message);
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name || !roomCode) {
      showError("validation", "Please enter name and room code");
      return;
    }
    if (isLoading) return;
    setIsLoading(true);
    clearError();
    try {
      const code = roomCode.toUpperCase();
      const { playerId, sessionToken } = await joinGame({ roomCode: code, playerName: name });
      sessionStorage.setItem("playerId", playerId);
      sessionStorage.setItem("sessionToken", sessionToken);
      sessionStorage.setItem("playerName", name);
      router.push(`/room?code=${code}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to join game";
      showError("join-failed", message);
      setIsLoading(false);
    }
  };

  return (
    <div
      id="home-page"
      data-page="home"
      data-is-loading={isLoading}
      data-has-error={!!error}
      className="flex items-center justify-center min-h-screen bg-gray-100 p-4"
    >
      <ErrorBanner error={error} onDismiss={clearError} />

      <Card id="home-card" className="w-full max-w-md">
        <CardHeader>
          <CardTitle id="app-title" className="text-center text-3xl font-bold">SmackTalk</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Host Game - Desktop only */}
          <div className="hidden md:block">
            <Button
              id="host-game-button"
              data-testid="host-game-button"
              data-action="host-game"
              aria-label="Host a new game on this device (for TV display)"
              onClick={handleHost}
              className="w-full"
              variant="default"
              disabled={isLoading}
            >
              {isLoading ? "Creating..." : "Host Game"}
            </Button>
            <p className="text-xs text-gray-500 mt-1 text-center">
              Cast this screen to your TV
            </p>
          </div>

          {/* Divider - Desktop only */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-300" />
            <span className="text-sm text-gray-500">or join as player</span>
            <div className="flex-1 h-px bg-gray-300" />
          </div>

          {/* Join Game - Always visible */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="player-name-input" className="text-sm font-medium">Your Name</label>
              <Input
                id="player-name-input"
                data-testid="player-name-input"
                data-required="true"
                aria-label="Enter your name to join a game"
                aria-required="true"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="room-code-input" className="text-sm font-medium">Room Code</label>
              <Input
                id="room-code-input"
                data-testid="room-code-input"
                data-format="4-char-uppercase"
                aria-label="Enter 4-character room code to join existing game"
                placeholder="ABCD"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="text-center uppercase"
                maxLength={4}
              />
            </div>

            <Button
              id="join-game-button"
              data-testid="join-game-button"
              data-action="join-game"
              data-has-name={name.length > 0}
              data-has-code={roomCode.length === 4}
              aria-label="Join an existing game room"
              onClick={handleJoin}
              className="w-full"
              variant="outline"
              disabled={isLoading}
            >
              {isLoading ? "Joining..." : "Join Game"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
