# SmackTalk Gameplay Redesign Plan

## Summary of Changes

This redesign addresses the core issues:
1. Specials rarely trigger → Every round uses special bar mechanic
2. Rounds 1 & 2 feel same → **Removed Round 1**, single Main Round
3. Awkward culling to 2 → Structured 4-player semi-finals bracket
4. Wasted answers from KOs → Winner heals from remaining prompts
5. Corner men underutilized → Every finalist gets corner men, max 3 per team

---

## New Game Flow (3 Rounds Total)

### Player Requirements
- **Minimum: 8 players**
- **Maximum: 12 players**
- Hard cap of 3 corner men per team

---

### Round 1: Main Round (formerly Round 2)
**Purpose:** Elimination via special bar, HP tracks seeding

| Setting | Value |
|---------|-------|
| Prompts per matchup | **5** |
| Damage multiplier | **0.5x** (~17 HP max per loss) |
| Special bar per win | **+1.0** |
| Special trigger | **3.0** = instant KO |
| Pairing | Random pairs |

**Win Condition:**
- First to 3 wins triggers special bar → KO
- **HP cannot kill** - only special bar eliminates

**HP Mechanics:**
- Damage is applied (0.5x multiplier, ~17 HP max per loss)
- Max 2 losses before KO = ~34 HP damage max (survivable)
- **Once KO'd, loser cannot deal damage** on remaining prompts
- HP determines seeding for semi-finals

**Post-KO Healing:**
- Remaining prompts still play (answers shown)
- Winner heals based on vote margin (same as damage formula)
- Max heal per prompt = ~17 HP (capped at damage cap × 0.5)

**Corner Men:**
- All losers become corner men for their opponent

---

### After Round 1: The Cut
**Purpose:** Guarantee exactly 4 semi-finalists with corner men

1. **Rank all fighters by HP** (descending)
2. **Top 4** advance to semi-finals
3. **Remaining fighters** (5th place and below) become corner men:
   - Randomly assigned to teams that have fewer than 3 corner men
   - Priority given to teams with 0 corner men, then 1, then 2
4. **UI must clearly explain** who made the cut and why

---

### Round 2: Semi-Finals
**Purpose:** Dramatic 1v1 with guaranteed winner via special bar

| Setting | Value |
|---------|-------|
| Fighters | 4 (2 matches) |
| HP damage | **NONE** (HP carries through unchanged) |
| Win condition | **Special bar reaches 3.0** |

**4 Prompts per match:**

| # | Type | Special Bar on Win | Notes |
|---|------|-------------------|-------|
| 1-3 | **Jab** | +1.0 | First to 3.0 wins |
| 4 | **Haymaker** | N/A (bragging only) | Plays after KO for style |

**Special Bar Rules:**
- +1.0 per win, triggers at 3.0
- **Does NOT reset on loss** (cumulative)
- First to 3.0 = instant KO

**Haymaker (Prompt 4) - Bragging Round:**
- Plays even after someone already won
- If KO'd player loses: **"Stop! He's already dead!"**
- If KO'd player wins: **"How did you miss a guy knocked out on the floor?"**

**Winners advance to Final**

---

### Round 3: Final Showdown
**Purpose:** Epic finale with attack-type mind games

| Setting | Value |
|---------|-------|
| Starting HP | **200** each |
| Prompts | **Infinite** (until KO) |
| Voting | All non-finalists vote (corner men + eliminated) |

**Attack Types (chosen secretly on submit):**

| Attack | Damage Dealt | Damage Received |
|--------|--------------|-----------------|
| Jab | 1x | 1x |
| Haymaker | 2x | 2x |
| Flying Kick | 3x | **4x** |

**Damage Resolution:**
- Both players secretly choose attack type
- Voting reveals winner
- **Loser takes the HIGHER multiplier** between:
  - Winner's "dealt" multiplier
  - Loser's "received" multiplier

**Examples:**
- Winner: Flying Kick (3x), Loser: Jab (1x) → Loser takes **3x** damage
- Winner: Jab (1x), Loser: Flying Kick (4x) → Loser takes **4x** damage
- Both Haymaker: Loser takes **2x** damage

**Special Bar:**
- 3 consecutive wins = **auto KO** (FINISHER)
- **Resets on non-win** (loss or tie)

**Corner Man Support:**
- Corner men can submit suggestions (already implemented)
- Fighter chooses whether to use suggestions

---

## Key Formulas

### Main Round Damage
```
damage = (votesAgainst / totalVotes) × 35 × 0.5
       = max ~17 HP per loss
```

### Main Round Healing (post-KO)
```
healing = (votesFor / totalVotes) × 35 × 0.5
        = max ~17 HP per remaining prompt won
```

### Final Damage
```
baseDamage = (votesAgainst / totalVotes) × 35
multiplier = max(winner.dealtMultiplier, loser.receivedMultiplier)
finalDamage = baseDamage × multiplier
```

---

# Implementation Phases

---

## Phase 1: Core Mechanics & Schema ✅ COMPLETE

**Files modified:**
- `convex/schema.ts`
- `convex/lib/gameLogic.ts`
- `convex/lib/phases.ts`
- `convex/engine.ts`
- `convex/actions.ts`
- `convex/bots.ts`

**Tasks:**
- [x] Add `specialBar` field to player schema
- [x] Add `attackType` to submission schema (`jab` | `haymaker` | `flyingKick`)
- [x] Modify `resolveBattle()`:
  - [x] Track special bar (+1.0 per win)
  - [x] KO when bar reaches 3.0
  - [x] Apply 0.5x damage multiplier for Main Round
  - [x] Prevent damage after KO (loser can't hurt winner)
- [x] Implement post-KO healing (vote margin based)
- [x] Implement "The Cut" logic after Main Round
- [x] Create semi-final bracket (top 4 by HP)
- [x] Implement random corner man assignment for eliminated fighters
- [x] Reset finalists to 200 HP
- [x] Implement attack type selection in actions.ts
- [x] Implement "higher multiplier" damage resolution
- [x] Implement final-specific special bar (resets on non-win)
- [x] Infinite prompt generation until KO
- [x] Update bot logic for attack types
- [x] Update all backend tests (59 tests passing)
- [x] **Speed Tiebreaker**: Ties now use submission speed to determine winner
  - Added `submittedAt` timestamp to submissions
  - Added `wonBySpeed` flag to mark speed wins
  - Winner gets +1 special bar, loser takes damage
  - UI shows "SPEED WIN!" overlay and status message
- [ ] Change round size from 3-5 prompts


### ✅ USER CHECKPOINT 1: Core Backend
```
Verify in localhost:
- [ ] Start a game with 8+ players
- [ ] Main Round: Special bar fills with wins (visible in HP bar area)
- [ ] Main Round: KO triggers at 3 wins (not HP death)
- [ ] Main Round: Damage is reduced (~17 HP max per loss)
- [ ] The Cut: Top 4 by HP advance to Semi-Finals
- [ ] Semi-Finals: No HP damage, special bar only
- [ ] Final: Both players reset to 200 HP
- [ ] Final: Game continues until someone is KO'd
```

---

## Phase 2: Special Bar UI ✅ COMPLETE

**Files modified:**
- `src/components/host/FighterHealthBar.tsx`
- `src/components/host/HostVotingView.tsx`

**Tasks:**
- [x] Update FighterHealthBar to use `specialBar` instead of `winStreak`
- [x] Pass `specialBar` and `currentRound` from HostVotingView
- [x] Display "READY!" at 2 bars, "KO!" at 3 bars
- [x] Display "FINISHER!" for 3 bars in Final round

### ✅ USER CHECKPOINT 2: Special Bar Display
```
Verify in localhost:
- [ ] Special bar shows 3 segments below fighter name
- [ ] Segments fill orange/yellow when wins accumulate
- [ ] Shows "READY!" when at 2 bars
- [ ] Shows "KO!" when at 3 bars (Main Round/Semi-Finals)
- [ ] Shows "FINISHER!" when at 3 bars (Final round)
```

---

## Phase 3: Attack Type Selection UI ✅ COMPLETE

**Files modified:**
- `src/components/game/cards/PromptCard.tsx` - Add attack type buttons and selection
- `src/components/game/FighterWritingView.tsx` - Pass round info and attack type to mutation
- `src/components/game/CaptainWritingView.tsx` - Support attack type for corner men submitting for bots
- `src/components/game/cards/SuggestionCard.tsx` - Attack type selection for bot captains
- `src/components/game/cards/PromptCard.test.tsx` - 15 new tests for attack type selection

**Tasks:**
- [x] Add attack type selection buttons (Jab/Haymaker/Flying Kick)
- [x] Only show in Final round (Round 3)
- [x] Show risk/reward info for each attack type (color-coded by risk level)
- [x] Default to "jab" if not selected
- [x] Pass attackType to submitAnswer mutation
- [x] Support attack type selection for corner men controlling bot captains
- [x] Write tests (15 passing tests)

### ✅ USER CHECKPOINT 3: Attack Type Selection
```
Verify in localhost:
- [ ] In Final round, player sees attack type buttons when writing answer
- [ ] Buttons show: Jab (1x), Haymaker (2x), Flying Kick (3x/4x)
- [ ] Selected attack type is sent with submission
- [ ] Attack type affects damage calculation
```

---

## Phase 4: The Cut Announcement Screen ✅ COMPLETE

**Files modified:**
- `src/components/host/transitions/TheCutReveal.tsx` - New transition component
- `src/components/host/transitions/index.ts` - Register transition
- `src/components/host/transitions/TheCutReveal.test.tsx` - 13 new tests

**Tasks:**
- [x] Create "The Cut" announcement screen after Round 1
- [x] Show all fighters ranked by HP (descending order)
- [x] Highlight top 4 who advance (green section with seed numbers #1-#4)
- [x] Show eliminated fighters (red/gray section with ranks #5+)
- [x] Show corner man assignments ("Now supporting [Captain Name]")
- [x] Dramatic reveal animation (GSAP-powered with staggered entrance)
- [x] Write tests (13 passing tests)

**Features:**
- "THE CUT" title with dramatic red glow effect
- Two-column layout: Advancing (green) vs Eliminated (red)
- Seed numbers clearly displayed (#1, #2, #3, #4 for semifinalists)
- HP shown for all fighters
- Eliminated players show strikethrough name and assigned captain
- GSAP animation: fade in, title zoom, staggered column reveals, 5s hold

### ✅ USER CHECKPOINT 4: The Cut Display
```
Verify in localhost:
- [ ] After Main Round, "The Cut" screen appears
- [ ] All players ranked by HP
- [ ] Top 4 highlighted as advancing
- [ ] Eliminated players shown with corner man assignments
- [ ] Clear visual distinction between advancing/eliminated
```

---

## Phase 5: Semi-Final Bracket Display ⏳ PENDING

**Files to modify:**
- `src/components/host/HostRoundResultsView.tsx`
- `src/components/host/` - Bracket visualization component

**Tasks:**
- [ ] Create bracket visualization for semi-finals
- [ ] Show #1 vs #4 and #2 vs #3 matchups
- [ ] Display HP for each fighter
- [ ] Show winner advancing to final
- [ ] Tournament bracket style layout

### 🔲 USER CHECKPOINT 5: Semi-Final Bracket
```
Verify in localhost:
- [ ] Semi-final shows tournament bracket
- [ ] Seeding visible (#1 vs #4, #2 vs #3)
- [ ] Winners clearly marked after matches
- [ ] Bracket shows path to Final
```

---

## Phase 6: Bragging Round Messages ⏳ PENDING

**Files to modify:**
- `src/components/host/HostVotingView.tsx` - Add bragging messages
- `convex/lib/gameLogic.ts` - Track if player already KO'd

**Tasks:**
- [ ] Detect when Prompt 4 plays in Semi-Finals (after KO)
- [ ] If KO'd player loses again: "Stop! He's already dead!"
- [ ] If KO'd player wins: "How did you miss a guy knocked out on the floor?"
- [ ] Dramatic text animation for messages

### 🔲 USER CHECKPOINT 6: Bragging Round
```
Verify in localhost:
- [ ] Semi-Finals Prompt 4 plays even after KO
- [ ] Appropriate message displays based on outcome
- [ ] Message is dramatic and visible
```

---

## Phase 7: Attack Type Reveal Animation ⏳ PENDING

**Files to modify:**
- `src/components/host/HostVotingView.tsx`
- `src/components/host/animations/` - New attack reveal animations

**Tasks:**
- [ ] Show attack type icons during Final reveal
- [ ] Animate the attack type selection
- [ ] Show damage multiplier calculation
- [ ] Different visual effects for jab/haymaker/flying kick

### 🔲 USER CHECKPOINT 7: Attack Type Reveal
```
Verify in localhost:
- [ ] Final round shows attack types during reveal
- [ ] Visual distinction between attack types
- [ ] Multiplier shown in damage display
```

---

## Phase 8: Cleanup & Polish ⏳ PENDING

**Files to modify:**
- `convex/lib/phases.ts` - Remove deprecated functions
- `convex/lib/constants.ts` - Update round labels
- Various UI files - Update round names

**Tasks:**
- [ ] Remove deprecated `resolvePhase2` function
- [ ] Update round name constants (Round 1 → "Main Round", etc.)
- [ ] Update host display round labels
- [ ] Remove old combo damage code if any remains
- [ ] Final code cleanup

### 🔲 USER CHECKPOINT 8: Final Polish
```
Verify in localhost:
- [ ] Round names display correctly ("Main Round", "Semi-Finals", "Final")
- [ ] No console errors or warnings
- [ ] Full game playthrough works end-to-end
```

---

## Notes for Future Expansion
- **Bot improvements:** Improve bot answer quality. This is top priority future expansion as bots will fill in the gaps for missing players. It would also be fun to make the bots funnier than the players. This could allow me to expand the semis to become a quaterfinal


- **Audio:** Add sound effects for attack types
- **Animations:** Different visuals for jab/haymaker/flying kick
