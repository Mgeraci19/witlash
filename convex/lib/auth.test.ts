import { describe, expect, test } from "vitest";
import {
  generateSessionToken,
  validateTextInput,
  validatePlayerName,
  MAX_PLAYER_NAME_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_ANSWER_LENGTH,
} from "./auth";

describe("generateSessionToken", () => {
  test("generates a 32 character token", () => {
    const token = generateSessionToken();
    expect(token).toHaveLength(32);
  });

  test("generates unique tokens", () => {
    const tokens = new Set();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateSessionToken());
    }
    expect(tokens.size).toBe(100);
  });

  test("contains only alphanumeric characters", () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9]+$/);
  });
});

describe("validateTextInput", () => {
  test("returns trimmed valid input", () => {
    const result = validateTextInput("  hello world  ", 50, "Test");
    expect(result).toBe("hello world");
  });

  test("throws on empty string", () => {
    expect(() => validateTextInput("", 50, "Test")).toThrow("Test is required");
  });

  test("throws on whitespace-only string", () => {
    expect(() => validateTextInput("   ", 50, "Test")).toThrow("Test cannot be empty");
  });

  test("throws when exceeding max length", () => {
    const longText = "a".repeat(51);
    expect(() => validateTextInput(longText, 50, "Test")).toThrow(
      "Test must be 50 characters or less"
    );
  });

  test("accepts text at max length", () => {
    const text = "a".repeat(50);
    const result = validateTextInput(text, 50, "Test");
    expect(result).toBe(text);
  });

  test("works with MAX_MESSAGE_LENGTH constant", () => {
    const text = "a".repeat(MAX_MESSAGE_LENGTH);
    const result = validateTextInput(text, MAX_MESSAGE_LENGTH, "Message");
    expect(result).toBe(text);
  });

  test("works with MAX_ANSWER_LENGTH constant", () => {
    const text = "a".repeat(MAX_ANSWER_LENGTH);
    const result = validateTextInput(text, MAX_ANSWER_LENGTH, "Answer");
    expect(result).toBe(text);
  });
});

describe("validatePlayerName", () => {
  test("accepts valid alphanumeric name", () => {
    const result = validatePlayerName("Player1");
    expect(result).toBe("Player1");
  });

  test("accepts name with spaces", () => {
    const result = validatePlayerName("John Doe");
    expect(result).toBe("John Doe");
  });

  test("accepts name with hyphens", () => {
    const result = validatePlayerName("Mary-Jane");
    expect(result).toBe("Mary-Jane");
  });

  test("accepts name with apostrophes", () => {
    const result = validatePlayerName("O'Brien");
    expect(result).toBe("O'Brien");
  });

  test("trims whitespace", () => {
    const result = validatePlayerName("  Player1  ");
    expect(result).toBe("Player1");
  });

  test("throws on empty name", () => {
    expect(() => validatePlayerName("")).toThrow("Player name is required");
  });

  test("throws on name exceeding max length", () => {
    const longName = "a".repeat(MAX_PLAYER_NAME_LENGTH + 1);
    expect(() => validatePlayerName(longName)).toThrow(
      `Player name must be ${MAX_PLAYER_NAME_LENGTH} characters or less`
    );
  });

  test("throws on special characters", () => {
    expect(() => validatePlayerName("Player<script>")).toThrow(
      "Player name can only contain letters, numbers, spaces, hyphens, and apostrophes"
    );
  });

  test("throws on emoji", () => {
    expect(() => validatePlayerName("Player🎮")).toThrow(
      "Player name can only contain letters, numbers, spaces, hyphens, and apostrophes"
    );
  });
});
