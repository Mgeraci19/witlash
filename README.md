# SmackTalk 🎮

A multiplayer battle-of-wits game where players compete in SmackTalk battles! Answer prompts creatively, vote on the best answers, and knock out your opponents in this Jackbox-style party game.

## 🎯 Game Overview

SmackTalk is a 4-round elimination game for 4-8 players:

- **Round 1-2**: Series Matchups - Players answer prompts and vote. Losers become "Corner Men" for winners
- **Round 3**: The Gauntlet - Remaining fighters battle it out
- **Round 4**: Final Showdown - The last two standing fight in sudden death mode

## 🚀 Live Demo

Play now at: [https://mgeraci19.github.io/witlash/](https://mgeraci19.github.io/witlash/)

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (React 19) with TypeScript
- **Backend**: Convex (real-time database and serverless functions)
- **Styling**: Tailwind CSS
- **Deployment**: GitHub Pages (static export)

## 🏗️ Architecture

### Frontend (`src/`)
- **`app/page.tsx`**: Home page for creating/joining games
- **`app/room/page.tsx`**: Main game room with phase routing
- **`components/game/`**: Game phase components
  - `LobbyView.tsx` - Waiting room
  - `WritingView.tsx` - Answer submission phase
  - `VotingView.tsx` - Voting phase with results
  - `RoundResultsView.tsx` - Round recap
  - `GameResultsView.tsx` - Final results

### Backend (`convex/`)
- **`lobby.ts`**: Game creation, joining, and starting
- **`engine.ts`**: Core game loop (damage, elimination, round progression)
- **`actions.ts`**: Player actions (submit answers, vote, suggestions)
- **`bots.ts`**: AI players for testing and filling lobbies
- **`lib/phases.ts`**: Round setup and matchmaking logic

## 🎮 Key Features

### Real-Time Multiplayer
- Instant state synchronization across all players
- No polling - updates pushed via Convex subscriptions

### Bot Players
- Automatically fill lobbies to 6 players minimum
- Bots vote and answer prompts
- Bot Corner Men send suggestions to human captains

### Corner Man System
- Eliminated players become "Corner Men" for their victors
- Can send suggestions to their captain
- Human corner men can control bot captains

### HP & Damage System
- 100 HP starting health
- Proportional damage based on voting results
- Sudden death with 1.5x multiplier in Round 4

## 📦 Local Development

### Prerequisites
- Node.js 20+
- npm

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Mgeraci19/witlash.git
   cd witlash
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Convex**
   ```bash
   npx convex dev
   ```
   This will create a `.env.local` file with your Convex deployment URL.

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open the game**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🚀 Deployment

### GitHub Pages Deployment

This project is configured for automatic deployment to GitHub Pages.

1. **Set up Convex production deployment**
   ```bash
   npx convex deploy
   ```
   Copy the production URL (e.g., `https://your-project.convex.cloud`)

2. **Configure GitHub Repository**
   - Go to repository Settings → Secrets and variables → Actions → Variables
   - Add `NEXT_PUBLIC_CONVEX_URL` with your production Convex URL

3. **Enable GitHub Pages**
   - Go to Settings → Pages
   - Source: GitHub Actions

4. **Deploy**
   ```bash
   git add .
   git commit -m "Deploy SmackTalk"
   git push origin main
   ```

The GitHub Action will automatically build and deploy on push to `main`.

## 🧪 Testing

### Bot-Only Testing
Use the `scenarios.ts` file to quickly test specific game states:

```bash
# In Convex dashboard, run:
scenarios:testDualBots
```

### Manual Testing
1. Open multiple browser windows/tabs
2. Create a game and copy the room code
3. Join from other windows with different names
4. Bots will automatically fill empty slots

## 🐛 Known Issues & Fixes

All major bugs have been resolved:
- ✅ Duplicate voting in Round 4 (fixed with prompt validation)
- ✅ NaN HP values (fixed with sanitization)
- ✅ Vote leaking between games (fixed with proper filtering)
- ✅ Double-click vote submission (fixed with loading states)

## 📝 License

MIT

## 🤝 Contributing

This is a personal project, but feel free to fork and modify!

## 👨‍💻 Author

Michael Geraci
