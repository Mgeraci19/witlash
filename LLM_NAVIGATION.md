# SmackTalk LLM Navigation Guide

This document describes how an LLM or automation agent can navigate and interact with the SmackTalk game.

## 🎮 Game Flow Overview

```
HOME (/) → LOBBY → PROMPTS (Writing) → VOTING → ROUND_RESULTS → Repeat or → RESULTS (Game Over)
```

The game cycles through PROMPTS → VOTING → ROUND_RESULTS for each round (3 rounds total).

---

## 🏠 Home Page (`/`)

### Purpose
Create a new game or join an existing one.

### Key Selectors

| Element | Selector | Purpose |
|---------|----------|---------|
| Name input | `#player-name-input` | Enter player name (required) |
| Room code input | `#room-code-input` | Enter 4-char code to join |
| Create button | `#create-game-button` | Create new game |
| Join button | `#join-game-button` | Join existing game |

### Data Attributes

- `data-has-name` - Boolean on buttons, true if name is entered
- `data-has-code` - Boolean on join button, true if 4-char code entered

### How to Create a Game

1. Type name in `#player-name-input`
2. Click `#create-game-button`
3. Wait for redirect to `/room?code=XXXX`

### How to Join a Game

1. Type name in `#player-name-input`
2. Type 4-character room code in `#room-code-input`
3. Click `#join-game-button`
4. Wait for redirect to `/room?code=XXXX`

---

## 🚪 Room Page (`/room?code=XXXX`)

### Detecting Current State

The root container `#room-container` has data attributes:

| Attribute | Values | Description |
|-----------|--------|-------------|
| `data-game-phase` | `LOBBY`, `PROMPTS`, `VOTING`, `ROUND_RESULTS`, `RESULTS` | Current game phase |
| `data-current-round` | `1-4` | Current round number |
| `data-max-rounds` | `4` | Total rounds |
| `data-round-status` | `VOTING`, `REVEAL` | Sub-state during voting |
| `data-is-vip` | `true`/`false` | Can this player control game? |
| `data-player-role` | `FIGHTER`, `CORNER_MAN` | Player's current role |
| `data-player-hp` | `0-100` | Player's health |

### LLM Context JSON

A structured JSON object is available in `#llm-game-context`:

```javascript
const context = JSON.parse(document.querySelector('#llm-game-context').textContent);
console.log(context.availableActions); // Array of actions with element selectors
```

---

## 📍 Phase: LOBBY

### Detecting This Phase
```javascript
document.querySelector('#lobby-view') !== null
// OR
document.querySelector('[data-game-phase="lobby"]') !== null
```

### Key Selectors

| Element | Selector | Purpose |
|---------|----------|---------|
| Start button | `#start-game-button` | VIP only - starts game |
| Player list | `#lobby-player-list` | Shows all joined players |
| Player item | `#player-item-{name}` | Individual player entry |

### Data Attributes on Lobby View

- `data-player-count` - Number of players
- `data-can-start` - Boolean, true if game can start
- `data-is-vip` - Boolean, true if current player is VIP

### Actions

**Start Game (VIP only):**
1. Verify `#lobby-view[data-is-vip="true"]`
2. Click `#start-game-button`
3. Wait for phase change to `PROMPTS`

---

## 📝 Phase: PROMPTS (Writing)

### Detecting This Phase
```javascript
document.querySelector('#writing-view-fighter') !== null
// OR
document.querySelector('#writing-view-corner-man') !== null
```

### Fighter View

When you are a `FIGHTER`, you need to answer prompts.

| Element | Selector | Purpose |
|---------|----------|---------|
| View container | `#writing-view-fighter` | Main container |
| Prompt card | `#prompt-card-{promptId}` | Card with prompt text |
| Answer input | `#answer-input-{promptId}` | Type your answer |
| Submit button | `#submit-answer-{promptId}` | Submit answer |

**Data Attributes on View:**
- `data-prompts-pending` - Number of prompts left to answer
- `data-prompts-total` - Total prompts assigned
- `data-all-submitted` - Boolean, true when all done

**How to Submit an Answer:**
1. Find `[data-status="pending"]` prompt cards
2. Type in `#answer-input-{promptId}`
3. Click `#submit-answer-{promptId}`
4. Repeat for all pending prompts
5. Wait for phase change when all players submit

### Corner Man View

When you are a `CORNER_MAN`, you help your captain.

| Element | Selector | Purpose |
|---------|----------|---------|
| View container | `#writing-view-corner-man` | Main container |
| Suggestion input | `#corner-suggestion-input-{promptId}` | Type suggestion |
| Suggest button | `#corner-suggest-button-{promptId}` | Send suggestion |
| Submit for bot | `#corner-submit-for-bot-{promptId}` | Direct submit (bot captain) |

**Data Attributes:**
- `data-captain-is-bot` - If true, you control the answer directly

---

## 🗳️ Phase: VOTING

### Detecting This Phase
```javascript
document.querySelector('#voting-view') !== null
```

### Key Selectors

| Element | Selector | Purpose |
|---------|----------|---------|
| View container | `#voting-view` | Main container |
| Prompt text | `#current-prompt-text` | The question being voted on |
| Vote button | `#vote-button-{submissionId}` | Click to vote |
| Next battle | `#next-battle-button` | VIP only - advance game |

### Data Attributes on Voting View

- `data-round-status` - `VOTING` or `REVEAL`
- `data-is-reveal` - Boolean, true during results reveal
- `data-has-voted` - Boolean, true if player voted
- `data-can-vote` - Boolean, true if player can vote

### Data Attributes on Vote Buttons

- `data-can-vote` - Boolean, true if clickable
- `data-is-my-answer` - Boolean, true if this is your answer
- `data-is-my-vote` - Boolean, true if you voted for this
- `data-vote-state` - `available`, `voted`, or `other-voted`
- `data-is-winner` - Boolean, true if this won (during reveal)

### Status Messages

| Selector | Meaning |
|----------|---------|
| `#vote-recorded-message` | Your vote was recorded |
| `#battling-message` | You are battling, cannot vote |
| `#supporting-message` | Your captain is battling |

### How to Vote

1. Check `#voting-view[data-can-vote="true"]`
2. Find `[data-vote-state="available"]` buttons
3. Find one where `[data-is-my-answer="false"]`
4. Click the button
5. Wait for `#vote-recorded-message` to appear

### How to Advance (VIP)

1. Wait for `[data-round-status="REVEAL"]`
2. Click `#next-battle-button`
3. Wait for next prompt or phase change

---

## 🏆 Phase: ROUND_RESULTS

### Detecting This Phase
```javascript
document.querySelector('#round-results-view') !== null
```

### Key Selectors

| Element | Selector | Purpose |
|---------|----------|---------|
| View container | `#round-results-view` | Main container |
| Standings list | `#round-standings-list` | HP rankings |
| Next round button | `#next-round-button` | VIP only - start next round |
| Standing item | `#standing-{rank}` | Individual player ranking |

### Data Attributes on Standings

- `data-rank` - Position (1, 2, 3...)
- `data-hp` - Player's HP
- `data-is-me` - Boolean, true if this is you

### How to Start Next Round (VIP)

1. Click `#next-round-button`
2. Wait for phase change to `PROMPTS` or `RESULTS`

---

## 🎉 Phase: RESULTS (Game Over)

### Detecting This Phase
```javascript
document.querySelector('#game-results-view') !== null
```

### Key Selectors

| Element | Selector | Purpose |
|---------|----------|---------|
| View container | `#game-results-view` | Main container |
| Final standings | `#final-standings-list` | Final rankings |
| Back to home | `#back-to-home-button` | VIP only - return home |

### Data Attributes

- `data-winner-name` - Name of the winner
- `data-winner-hp` - Winner's final HP

---

## 💬 Chat System

Available at all phases in `#chat-section`.

| Element | Selector | Purpose |
|---------|----------|---------|
| Messages container | `#chat-messages` | Message history |
| Chat input | `#chat-input` | Type message |
| Send button | `#send-chat-button` | Send message |

---

## 🔧 Utility Elements

### Debug Panel

| Element | Selector | Purpose |
|---------|----------|---------|
| Toggle button | `#toggle-debug-button` | Show/hide debug info |
| Container | `#debug-panel-container` | Debug panel wrapper |

### Loading States

| Selector | Meaning |
|----------|---------|
| `#room-loading` | Room data is loading |
| `#room-not-found` | Room code doesn't exist |
| `#voting-loading` | Battle data is loading |

---

## 📊 Reading LLM Context

The most comprehensive way to understand game state:

```javascript
// Get structured game context
const script = document.querySelector('#llm-game-context');
const context = JSON.parse(script.textContent);

// Example context structure:
{
  "phase": "VOTING",
  "round": 2,
  "roundStatus": "VOTING",
  "player": {
    "name": "Player1",
    "isVip": true,
    "role": "FIGHTER",
    "hp": 85
  },
  "availableActions": [
    {
      "action": "vote",
      "description": "Vote for answer: \"Funny response\"",
      "element": "#vote-button-abc123"
    }
  ],
  "waitingFor": "Waiting for all votes to be cast",
  "currentPrompt": {
    "text": "What would a caveman tweet?"
  }
}
```

---

## ✅ Quick Action Reference

### Play a Full Game (Single Player Flow)

1. Go to `/`
2. Enter name → `#player-name-input`
3. Click Create → `#create-game-button`
4. Click Start → `#start-game-button`
5. Answer prompts → `#answer-input-*` + `#submit-answer-*`
6. Vote on answers → `#vote-button-*`
7. VIP: Advance → `#next-battle-button` or `#next-round-button`
8. Repeat until game ends
9. Return home → `#back-to-home-button`

---

## 🤖 Tips for LLM Agents

1. **Always read `#llm-game-context`** for structured state
2. **Check `data-*` attributes** before clicking (e.g., `data-can-vote`)
3. **Wait for phase changes** after actions - use `data-game-phase` on `#room-container`
4. **VIP actions require `data-is-vip="true"`** on the containing view
5. **Prompt IDs are Convex document IDs** - use them consistently
6. **Disabled buttons have `disabled` attribute** - check before clicking
