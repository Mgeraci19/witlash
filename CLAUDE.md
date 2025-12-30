# SmackTalk (Witlash) - Claude Code Context

## Tech Stack
- **Frontend**: Next.js 16 (React 19), TypeScript, Tailwind CSS v4
- **Backend**: Convex (real-time database + serverless functions)
- **Animation**: GSAP
- **Deployment**: GitHub Pages (static export)

## Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build (use GITHUB_ACTIONS=true for CI)
npm run lint         # ESLint
npm run typecheck    # TypeScript check
```

## Architecture Overview

### Game Flow
```
LOBBY → PROMPTS → VOTING → ROUND_RESULTS → (repeat 4 rounds) → RESULTS
```

### Key Directories
```
src/
├── app/
│   ├── page.tsx           # Home - Host Game / Join Game
│   ├── room/page.tsx      # Player mobile view
│   └── host/page.tsx      # Host TV display (animated)
├── components/
│   ├── game/              # Player-facing components
│   └── host/              # Host display components + animations
└── lib/types.ts           # GameState type

convex/
├── schema.ts              # Database schema
├── game.ts                # Queries (get, getForHost)
├── lobby.ts               # Room creation, joining, game start
├── actions.ts             # Player actions (answers, votes, suggestions)
├── engine.ts              # Game logic (damage, round progression)
└── bots.ts                # AI player behavior
```

### Two Frontend Views
1. **Player View** (`/room?code=XXXX`) - Mobile-friendly, interactive
2. **Host View** (`/host?code=XXXX`) - TV display, animations, no controls

### Authentication
- **Players**: `sessionToken` in sessionStorage, validated on mutations
- **Host**: `hostToken` in sessionStorage, validated by `getForHost` query

### Key Patterns
- All state in Convex, real-time sync via `useQuery`
- Phase-based component routing based on `game.status`
- VIP (first player to join) controls game flow
- GSAP for host animations (round transitions, voting battles)

## Current Features
- Host display with Street Fighter-style round transitions
- Voting battle animations (HP bars, sliding answers, vote attacks)
- Bot auto-fill when < 6 players
- Corner man role for eliminated players

## Planned Features
- User-drawn fighter avatars
- KO/damage effect animations
- Audio integration
