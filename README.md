# SmackTalk

**SmackTalk** is a multiplayer party game inspired by Jackbox's *Quiplash*. Players answer prompts with witty responses and vote on their favorites in a tournament-style battle.

## Tech Stack
-   **Frontend**: Next.js 15 (App Router), React 19, TailwindCSS 4.
-   **Backend**: Convex (Real-time database and serverless functions).
-   **Deployment**: GitHub Pages (Static Export).

## Architecture & Data Flow
This section provides a high-level overview for developers and AI assistants navigating the codebase.

### Frontend Structure (`src/`)
-   `app/page.tsx`: Landing page. Allows creating a new game or joining an existing one.
-   `app/room/[code]/page.tsx`: **Main Game Loop**. This component handles the entire game state for a connected player (Lobby -> Writing -> Voting -> Results).
-   `app/globals.css`: Tailwind imports and global styles.

### Backend Structure (`convex/`)
-   `schema.ts`: Defines the database tables:
    -   `games`: Stores game state (`LOBBY`, `WRITING`, `VOTING`, `RESULTS`), room code, and current round info.
    -   `players`: Stores player profiles (name, score) linked to a game.
    -   `prompts`: Stores the questions/prompts for a game round.
    -   `submissions`: Stores player answers to prompts.
    -   `votes`: Stores votes cast during the battle phase.
-   `games.ts`: Core game logic mutations and queries:
    -   `createGame`: Initializes a new game room.
    -   `joinGame`: adds a player to the game.
    -   `startGame`: Transitions from Lobby to Writing phase.
    -   `submitAnswer`: Records a player's answer.
    -   `submitVote`: Records a vote.
    -   `nextPhase`: Advances the game state (e.g., Writing -> Voting).

## Development Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Start Convex Dev Server**:
    ```bash
    npx convex dev
    ```

3.  **Start Frontend Dev Server**:
    ```bash
    npm run dev
    ```

4.  **Open App**: Visit `http://localhost:3000`.

## Deployment

### Backend (Convex)
Deploy your Convex functions to production:
```bash
npx convex deploy
```
This will provide the Production URL (e.g., `https://example-app-123.convex.cloud`).

### Frontend (GitHub Pages)
The frontend is automatically deployed to GitHub Pages via GitHub Actions when pushing to `main`.

1.  **Configuration**:
    The workflow is defined in `.github/workflows/deploy.yml`.
    It uses `next build` with `output: "export"`.

2.  **Environment Variables**:
    The production build requires `NEXT_PUBLIC_CONVEX_URL`.
    This is set as a **Repository Variable** in GitHub Settings:
    `Settings > Secrets and variables > Actions > Variables`.

3.  **Access**:
    The live site is available at: `https://<username>.github.io/smacktalk`
