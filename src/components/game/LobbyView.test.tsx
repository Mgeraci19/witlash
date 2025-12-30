import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { LobbyView } from "./LobbyView";
import { Id } from "../../../convex/_generated/dataModel";

// Create a mock game state
function createMockGame(playerCount: number = 2) {
  const players = Array.from({ length: playerCount }, (_, i) => ({
    _id: `player-${i}` as Id<"players">,
    _creationTime: Date.now(),
    gameId: "game-1" as Id<"games">,
    name: `Player ${i + 1}`,
    score: 0,
    isVip: i === 0,
    sessionToken: `token-${i}`,
    hp: 100,
    maxHp: 100,
    knockedOut: false,
    role: "FIGHTER" as const,
    isBot: false,
  }));

  return {
    _id: "game-1" as Id<"games">,
    _creationTime: Date.now(),
    roomCode: "TEST",
    status: "LOBBY",
    currentRound: 1,
    maxRounds: 4,
    players,
    messages: [],
    prompts: [],
    submissions: [],
    votes: [],
    suggestions: [],
  };
}

describe("LobbyView", () => {
  const mockStartGame = vi.fn().mockResolvedValue(undefined);

  test("renders without crashing", () => {
    const game = createMockGame(2);
    render(
      <LobbyView
        game={game}
        playerId={"player-0" as Id<"players">}
        sessionToken="token-0"
        isVip={true}
        startGame={mockStartGame}
      />
    );
    expect(document.getElementById("lobby-view")).toBeInTheDocument();
  });

  test("displays waiting message", () => {
    const game = createMockGame(2);
    render(
      <LobbyView
        game={game}
        playerId={"player-0" as Id<"players">}
        sessionToken="token-0"
        isVip={false}
        startGame={mockStartGame}
      />
    );
    expect(screen.getByText("Waiting for players...")).toBeInTheDocument();
  });

  test("displays player list", () => {
    const game = createMockGame(3);
    render(
      <LobbyView
        game={game}
        playerId={"player-0" as Id<"players">}
        sessionToken="token-0"
        isVip={false}
        startGame={mockStartGame}
      />
    );

    expect(screen.getByText(/Player 1/)).toBeInTheDocument();
    expect(screen.getByText(/Player 2/)).toBeInTheDocument();
    expect(screen.getByText(/Player 3/)).toBeInTheDocument();
  });

  test("shows (You) indicator for current player", () => {
    const game = createMockGame(2);
    render(
      <LobbyView
        game={game}
        playerId={"player-0" as Id<"players">}
        sessionToken="token-0"
        isVip={false}
        startGame={mockStartGame}
      />
    );

    expect(screen.getByText(/\(You\)/)).toBeInTheDocument();
  });

  test("shows VIP crown for VIP player", () => {
    const game = createMockGame(2);
    render(
      <LobbyView
        game={game}
        playerId={"player-1" as Id<"players">}
        sessionToken="token-1"
        isVip={false}
        startGame={mockStartGame}
      />
    );

    expect(screen.getByLabelText("VIP Player")).toBeInTheDocument();
  });

  test("VIP sees start game button", () => {
    const game = createMockGame(2);
    render(
      <LobbyView
        game={game}
        playerId={"player-0" as Id<"players">}
        sessionToken="token-0"
        isVip={true}
        startGame={mockStartGame}
      />
    );

    const button = screen.getByRole("button", { name: /start/i });
    expect(button).toBeInTheDocument();
  });

  test("non-VIP does not see start game button", () => {
    const game = createMockGame(2);
    render(
      <LobbyView
        game={game}
        playerId={"player-1" as Id<"players">}
        sessionToken="token-1"
        isVip={false}
        startGame={mockStartGame}
      />
    );

    const button = screen.queryByRole("button", { name: /start/i });
    expect(button).not.toBeInTheDocument();
  });

  test("player list has correct count data attribute", () => {
    const game = createMockGame(4);
    render(
      <LobbyView
        game={game}
        playerId={"player-0" as Id<"players">}
        sessionToken="token-0"
        isVip={false}
        startGame={mockStartGame}
      />
    );

    const list = screen.getByTestId("lobby-player-list");
    expect(list).toHaveAttribute("data-count", "4");
  });
});
