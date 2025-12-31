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

# Current Issues To Fix

> Update this section as issues are fixed

## Global Issues
- Ties are broken on the UI but there is no indication that speed wins on ties
- In round 3 between battles on the host it shows the round 3 writing phase with tons of UI issues

## Round 1 Issues
- The special bar never fully charges on the UI. After a winning vote but before a KO it should become full and shake or something
- There is a bug with the health here. People are healing after rounds when they should not be able to

## Round 2 Issues
- The KO here does not do any animation

## Round 3 Issues
- The flying kick and stuff is super small and hard to see. Considering this is the final round the animation on that should be better. I want to see ATTEMPTED SUCCEEDED under the winner with the attack they chose and ATTEMPTED FAILED under the loser with the attack they chose. Then I should see the attack animated specifically for that successful attack and the multiplier that is applied from the max of the loser and the winners multiplier
- The champion page has the avatar overlapping with the word champion

---

# Completed Implementation Summary

The following phases have been fully implemented:

1. **Core Mechanics & Schema** - specialBar, attackType, damage resolution, The Cut logic, bracket seeding, corner man assignment, speed tiebreaker with `submittedAt` and `wonBySpeed`

2. **Special Bar UI** - 3-segment display, READY!/KO!/FINISHER! labels, currentRound awareness

3. **Attack Type Selection** - Jab/Haymaker/Flying Kick buttons in Final round, risk/reward display, bot support

4. **The Cut Announcement** - Ranked display, advancing vs eliminated, corner man assignments, GSAP animations

5. **Semi-Finals Jab/Haymaker** - Single-word jab enforcement, bragging round (prompt 4), UI indicators

---

## Notes for Future Expansion
- **Bot improvements:** Improve bot answer quality. This is top priority future expansion as bots will fill in the gaps for missing players. It would also be fun to make the bots funnier than the players. This could allow me to expand the semis to become a quaterfinal
- **Audio:** Add sound effects for attack types
- **Animations:** Different visuals for jab/haymaker/flying kick
