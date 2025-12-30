# CI Testing Setup Plan

## Overview

Implement a CI pipeline that tests the backend comprehensively and verifies frontend components render without breaking. Frontend tests are minimal since UI changes frequently. Backend tests are comprehensive to prevent regressions.

### Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Backend | `convex-test` + Vitest | Comprehensive tests for game logic |
| Frontend | Vitest + React Testing Library | Basic render tests for critical components |
| Type Check | `tsc --noEmit` | Full TypeScript validation |
| Lint | ESLint | Existing setup |

---

## Implementation Steps

### 1. Install Dev Dependencies

```bash
# Backend testing (convex-test)
npm install --save-dev convex-test vitest @edge-runtime/vm

# Frontend testing
npm install --save-dev @testing-library/react @testing-library/jest-dom jsdom
```

### 2. Update package.json Scripts

Add to the `scripts` section:

```json
{
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:backend": "vitest run --config vitest.backend.config.ts",
  "test:frontend": "vitest run --config vitest.frontend.config.ts",
  "test:watch": "vitest"
}
```

### 3. Create vitest.backend.config.ts

For testing Convex backend functions with the edge-runtime:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    globals: true,
  },
});
```

### 4. Create vitest.frontend.config.ts

For testing React components with jsdom:

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

### 5. Create vitest.setup.ts

For frontend test setup:

```typescript
import "@testing-library/jest-dom";
```

### 6. Create .github/workflows/ci.yml

Separate CI workflow that runs on all PRs and main push (without requiring pass for deploy yet):

```yaml
name: CI

on:
  pull_request:
    branches: ["main"]
  push:
    branches: ["main"]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run typecheck

      - name: Backend tests
        run: npm run test:backend

      - name: Frontend tests
        run: npm run test:frontend
```

### 7. Test File Structure (Colocated)

```
convex/
├── engine.ts
├── engine.test.ts
├── lobby.ts
├── lobby.test.ts
├── actions.ts
├── actions.test.ts
├── lib/
│   ├── auth.ts
│   └── auth.test.ts
└── ...

src/
├── app/
│   ├── page.tsx
│   └── page.test.tsx
├── components/game/
│   ├── LobbyView.tsx
│   ├── LobbyView.test.tsx
│   └── ...
└── ...
```

---

## Backend Tests to Implement

### High Priority (Game Logic)

1. **engine.test.ts** - Core game loop
   - Damage calculation
   - Player elimination logic
   - Round progression
   - Score updates

2. **lobby.test.ts** - Game management
   - Game creation
   - Player joining/leaving
   - Game start validation
   - Session token validation

3. **actions.test.ts** - Player actions
   - Answer submission
   - Voting submission
   - Invalid action handling

4. **lib/auth.test.ts** - Authentication
   - Session token validation
   - Invalid token handling

### Medium Priority

5. **game.test.ts** - State transitions
   - Game phase changes
   - State consistency

---

## Frontend Tests to Implement

### Critical Components (Smoke Tests)

1. **src/app/page.test.tsx** - Home page
   - Page renders without crashing
   - Game creation form exists
   - Join game form exists

2. **src/app/room/page.test.tsx** - Room page
   - Page renders with mock game state
   - Shows appropriate view for each phase

3. **src/components/game/LobbyView.test.tsx**
   - Component renders
   - Player list displays

4. **src/components/game/WritingView.test.tsx**
   - Component renders
   - Answer input exists

5. **src/components/game/VotingView.test.tsx**
   - Component renders
   - Vote buttons exist

---

## Example Test Patterns

### Backend Test (Convex)

```typescript
// convex/engine.test.ts
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

test("damage calculation applies correctly", async () => {
  const t = convexTest(schema);

  // Setup: Create game with players
  const gameId = await t.run(async (db) => {
    return await db.insert("games", {
      phase: "playing",
      players: [
        { id: "p1", health: 100 },
        { id: "p2", health: 100 },
      ],
    });
  });

  // Act: Apply damage
  const updated = await t.mutation(api.engine.applyDamage, {
    gameId,
    playerId: "p1",
    damage: 25,
  });

  // Assert
  expect(updated.players[0].health).toBe(75);
});
```

### Frontend Test (React)

```typescript
// src/app/page.test.tsx
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import Home from "./page";

// Mock Convex provider
vi.mock("./ConvexClientProvider", () => ({
  ConvexClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

test("home page renders", () => {
  render(<Home />);
  expect(screen.getByText(/create game|join game/i)).toBeInTheDocument();
});
```

---

## Deployment Strategy

### Current (No Test Gate)

- **deploy.yml**: Runs on `main` push only, deploys immediately
- **ci.yml**: Runs on all PRs + main push, reports test results

### Future (With Test Gate)

Once tests are stable, update `deploy.yml`:

```yaml
deploy:
  needs: test  # Add this line to require tests pass
  # ... rest of deploy job
```

---

## Notes

- Tests run in CI but don't block deployment yet
- Colocated test files keep code organization simple
- Use `convex-test` for backend (fast, isolated)
- Use basic render tests for frontend (minimal, catches import errors)
- Type checking via TypeScript provides additional safety
