import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock convex/react
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: () => undefined,
}));

// Import after mocks
import Home from "./page";

describe("Home page", () => {
  test("renders without crashing", () => {
    render(<Home />);
    expect(document.getElementById("home-page")).toBeInTheDocument();
  });

  test("displays app title", () => {
    render(<Home />);
    expect(screen.getByText("SmackTalk")).toBeInTheDocument();
  });

  test("has player name input", () => {
    render(<Home />);
    const input = screen.getByPlaceholderText("Enter your name");
    expect(input).toBeInTheDocument();
  });

  test("has room code input", () => {
    render(<Home />);
    const input = screen.getByPlaceholderText("ABCD");
    expect(input).toBeInTheDocument();
  });

  test("has join game button", () => {
    render(<Home />);
    const button = screen.getByRole("button", { name: /join/i });
    expect(button).toBeInTheDocument();
  });

  test("has host game button (visible on desktop)", () => {
    render(<Home />);
    // Host button exists but may be hidden on mobile via CSS
    const button = document.getElementById("host-game-button");
    expect(button).toBeInTheDocument();
  });

  test("room code input has maxLength of 4", () => {
    render(<Home />);
    const input = screen.getByPlaceholderText("ABCD");
    expect(input).toHaveAttribute("maxLength", "4");
  });
});
