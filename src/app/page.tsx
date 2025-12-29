"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function Home() {
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const createGame = useMutation(api.games.create);
  const joinGame = useMutation(api.games.join);
  const router = useRouter();

  const handleCreate = async () => {
    if (!name) return alert("Please enter your name");
    try {
      const { roomCode } = await createGame({});
      const { playerId } = await joinGame({ roomCode, playerName: name });
      sessionStorage.setItem("playerId", playerId);
      sessionStorage.setItem("playerName", name);
      router.push(`/room?code=${roomCode}`);
    } catch (e) {
      console.error(e);
      alert("Failed to create game");
    }
  };

  const handleJoin = async () => {
    if (!name || !roomCode) return alert("Please enter name and room code");
    try {
      const code = roomCode.toUpperCase();
      const { playerId } = await joinGame({ roomCode: code, playerName: name });
      sessionStorage.setItem("playerId", playerId);
      sessionStorage.setItem("playerName", name);
      router.push(`/room?code=${code}`);
    } catch (e: any) {
      alert("Failed to join: " + (e.message || e));
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-3xl font-bold">SmackTalk</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Your Name</label>
            <Input
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Button onClick={handleCreate} className="w-full" variant="default">
                Create Game
              </Button>
            </div>

            <div className="space-y-2 flex flex-col">
              <Input
                placeholder="Room Code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                className="text-center uppercase"
                maxLength={4}
              />
              <Button onClick={handleJoin} className="w-full" variant="outline">
                Join Game
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
