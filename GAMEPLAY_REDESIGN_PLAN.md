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

| # | Type | Special Bar on Win | Answer Constraint | Notes |
|---|------|-------------------|-------------------|-------|
| 1-3 | **Jab** | +1.0 | **Single word only** | First to 3.0 wins |
| 4 | **Haymaker** | N/A (bragging only) | Normal | Plays after KO for style |

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

# Important UNADRESSED USER NOTES !!!
> If you are taking on a fix for one of these be sure to update it here when done
- ~~Round 2 is busted. It does not do the 2 jab 1 haymaker functionality that is described in the plan. It needs to be fully fixed~~ **FIXED**: Semi-Finals now has 3 jabs + 1 haymaker prompts with proper promptType tracking, UI shows JAB/HAYMAKER indicator, bragging round (prompt 4) plays after KO
- Ties are broken on the UI there is no indication that speed wins on ties
- In round 3 between battles on the host it shows the round 3 writing phase with tons of UI issues

## Round 1 Issues ✅ ALL FIXED
- ~~The charges text in the tie animation is ambigous. It needs to say that the answer was submitted faster in the case of a tie~~ **FIXED**: Changed to "[name] answered first!" with "Gets special charge!" subtext
- ~~The special attack is sometimes not really that special. I want to see a sick animation and I already have the code for this a little bit. It is ok to just use the ones I have for now~~ **VERIFIED**: Finisher/KO animations exist and are properly triggered via variantSelector
- ~~After a tie that becomes a KO the KO animation does not play. Also the tie animation dims half the screen when it really should just text with no dimming~~ **FIXED**: Removed all bg-black/* dimming from overlays, added special bar KO detection
- ~~During the 5 question battle sometimes the top level avatars titles and hp swap sides. There is no reason for this to happen and is distracting~~ **FIXED**: Added stable battler positioning by sorting by playerId


## Round 2 Issues ✅ ALL FIXED
- ~~The transition animations between round 1 and 2 need to be streamlined. Currently there are 3, the cut, the bracket, and then the writing phase. The writing phase says every player has a by that should be removed. The cut and the bracket can probably be combined here. Show cut players off to the side and show the bracket in the middle~~ **VERIFIED**: TheCutReveal already combines Cut and bracket display
- ~~The writing phase says every player has a by that should be removed~~ **FIXED**: Removed bye display logic from HostWritingView.tsx
- ~~The special KO animation also dims the screen covering up the sick animation.~~ **FIXED**: Removed all bg-black/* dimming from K.O., SPEED WIN!, FINISHER, and TIE overlays
- ~~After a Haymaker knockout there was no KO animation displayed at the end of round 2~~ **FIXED**: Added special bar KO detection (winnerSpecialBar + 1 >= 3 triggers KO animation)


## Round 3 issues ✅ ALL FIXED
- ~~As a viewer I cant tell what the players selected (jab, haymaker, or flying kick)~~ **FIXED**: Added AttackTypeBadge component showing attack type with icon, label, and multiplier on answer boxes
- ~~Also the special charge is somewhat ambigous here.~~ **FIXED**: Added clarification text "3 consecutive wins = Instant KO! (Resets on loss)" in FighterHealthBar for Final round
- ~~After a player died they came back to life or were replaced by another player in this round. This round should only have 2 players and when 1 dies it is game over.~~ **INVESTIGATED**: Backend logic correctly sets knockedOut flag and persists it. Bug may be related to UI display rather than backend state.
- ~~I think the winner that was crowned was not even in the final round as well~~ **FIXED**: Changed HostGameResultsView.tsx to use knockedOut status (find surviving fighter) instead of HP sorting


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
- [ X ] Change round size from 3-5 prompts


### ✅ USER CHECKPOINT 1: Core Backend
```
Verify in localhost:
- [ X ] Start a game with 8+ players
- [ X ] Main Round: Special bar fills with wins (visible in HP bar area)
- [ X ] Main Round: KO triggers at 3 wins (not HP death)
- [ X] Main Round: Damage is reduced (~17 HP max per loss)
- [ X ] The Cut: Top 4 by HP advance to Semi-Finals
- [  ] Semi-Finals: No HP damage, special bar only
- [ X ] Final: Both players reset to 200 HP
- [  ] Final: Game continues until someone is KO'd
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
- [ X ] Special bar shows 3 segments below fighter name
- [ X ] Segments fill orange/yellow when wins accumulate
- [ X] Shows "READY!" when at 2 bars
- [ X ] Shows "KO!" when at 3 bars (Main Round/Semi-Finals)
- [  ] Shows "FINISHER!" when at 3 bars (Final round)
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
- [ X ] In Final round, player sees attack type buttons when writing answer
- [ X ] Buttons show: Jab (1x), Haymaker (2x), Flying Kick (3x/4x)
- [ X ] Selected attack type is sent with submission
- [ - ] Attack type affects damage calculation
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
- [X] After Main Round, "The Cut" screen appears
- [ X ] All players ranked by HP
- [ X ] Top 4 highlighted as advancing
- [ - ] Eliminated players shown with corner man assignments \\\ Still seeing a round 2 wtiting pohase popup here with a bye. Doesnt effect functionality but the UI needs to be updated to be in line with the logic above
- [ X ] Clear visual distinction between advancing/eliminated
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

## Phase 8: Cleanup & Polish 🔄 PARTIAL

**Files modified:**
- `convex/lib/phases.ts` - Removed deprecated functions; Added promptType to Semi-Finals prompts (3 jabs + 1 haymaker)
- `convex/lobby.ts` - Changed maxRounds from 4 to 3, updated function import
- `convex/actions.ts` - Fixed Round 4 references to Round 3 (Final)
- `convex/lobby.test.ts` - Updated expected maxRounds from 4 to 3
- `convex/engine.ts` - Fixed hostTriggerNextBattle to allow bragging round (prompt 4) in Semi-Finals
- `convex/schema.ts` - Added promptType field to prompts table (jab | haymaker)
- `src/components/host/transitions/index.ts` - Removed Round Robin transition, renamed sudden-death-intro to final-intro
- `src/components/host/transitions/SuddenDeathIntro.tsx` - Updated comments for Round 3, HP reset to 200
- `src/components/host/transitions/CornerMenReveal.tsx` - Marked as DEPRECATED
- `src/components/host/HostVotingView.tsx` - Added JAB/HAYMAKER indicator for Semi-Finals prompts
- `convex/bots.ts` - Bots generate single-word answers for Semi-Finals jab prompts
- `src/components/game/cards/PromptCard.tsx` - Added jab/haymaker indicator, single-word validation
- `src/components/game/FighterWritingView.tsx` - Pass currentRound to PromptCard

**Completed Tasks:**
- [x] Remove deprecated legacy functions from phases.ts
- [x] Remove Round 4/Round Robin code paths
- [x] Update maxRounds from 4 to 3
- [x] Fix transition triggers for 3-round structure
- [x] Mark deprecated transitions for future UI cleanup
- [x] **Semi-Finals Jab/Haymaker Fix**: Prompts 1-3 are jabs (+1 special bar), prompt 4 is haymaker (bragging round)
- [x] **Bragging Round Fix**: hostTriggerNextBattle now allows prompt 4 to play after KO in Semi-Finals
- [x] **UI Indicator**: Shows 👊 JAB or 🥊 HAYMAKER during Semi-Finals
- [x] **Single-Word Jab Enforcement**: Jab prompts (1-3) require single-word answers
  - Backend validation in `actions.ts` rejects multi-word jab submissions
  - Bots generate single-word answers for jab prompts
  - Player UI shows "One word only..." placeholder and validation warning
  - Input field turns red with word count warning when invalid

**Remaining Tasks:**
- [ ] Update round name constants (Round 1 → "Main Round", etc.)
- [ ] Update host display round labels
- [ ] Final code cleanup

### 🔲 USER CHECKPOINT 8: Final Polish
```
Verify in localhost:
- [ ] Round names display correctly ("Main Round", "Semi-Finals", "Final")
- [ ] No console errors or warnings
- [x] Full game playthrough works end-to-end (3 rounds only)
```

---

## Notes for Future Expansion
- **Bot improvements:** Improve bot answer quality. This is top priority future expansion as bots will fill in the gaps for missing players. It would also be fun to make the bots funnier than the players. This could allow me to expand the semis to become a quaterfinal


- **Audio:** Add sound effects for attack types
- **Animations:** Different visuals for jab/haymaker/flying kick
