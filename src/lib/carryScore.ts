export interface PlayerStats {
  name: string;
  team: "blue" | "orange";
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
}

/**
 * Calculate a contribution score (1–100) for every player in a game.
 *
 * Uses five team-relative pillars (same as the old carry score algorithm),
 * but instead of only awarding the top contributor, every player gets a
 * score normalized game-wide to 1–100.
 *
 * Pillars:
 *   1. Offensive share   (25%) — goals*3+assists*2 as % of team offense
 *   2. Defensive load    (25%) — saves relative to goals conceded
 *   3. Score premium     (25%) — in-game score vs team average
 *   4. Hidden contribution(15%)— score not explained by visible stats
 *   5. Involvement rate  (10%) — total actions vs team average
 *
 * Modifiers:
 *   • Superstar bonus  — +10% per stat category above team average (max ×1.5)
 *   • Fake hero penalty— ×0.75 if 2+ goals but fewer than 3 other actions
 *   • Closeness factor — blowouts slightly dampen the signal
 *   • Defensive wall   — slight discount for high-save losers
 */
export function calculateContributionScores(players: PlayerStats[]): Map<string, number> {
  const result = new Map<string, number>();
  if (players.length === 0) return result;

  // ── Per-team aggregates ────────────────────────────────────────────────────
  const teams = ["blue", "orange"] as const;

  const teamPlayers = (team: "blue" | "orange") =>
    players.filter((p) => p.team === team);

  const teamGoals = (team: "blue" | "orange") =>
    teamPlayers(team).reduce((s, p) => s + p.goals, 0);

  const teamOffense = (team: "blue" | "orange") =>
    teamPlayers(team).reduce((s, p) => s + p.goals * 3 + p.assists * 2, 0);

  const teamAvgScore = (team: "blue" | "orange") => {
    const tp = teamPlayers(team);
    return tp.length ? tp.reduce((s, p) => s + p.score, 0) / tp.length : 1;
  };

  const teamAvgInvolvement = (team: "blue" | "orange") => {
    const tp = teamPlayers(team);
    return tp.length
      ? tp.reduce((s, p) => s + p.goals + p.assists + p.saves + p.shots, 0) / tp.length
      : 1;
  };

  // Goals the opposing team scored (used for defensive load)
  const goalsAgainst = (team: "blue" | "orange") => {
    const opp = team === "blue" ? "orange" : "blue";
    return teamGoals(opp);
  };

  // ── Game-level goal difference (for closeness factor) ────────────────────
  const blueGoals = teamGoals("blue");
  const orangeGoals = teamGoals("orange");
  const goalDiff = Math.abs(blueGoals - orangeGoals);
  const closenessFactor = 1 / (1 + goalDiff * 0.12); // blowouts dampen signal slightly

  // ── Raw pillar scores per player ──────────────────────────────────────────
  const rawScores = players.map((p) => {
    const team = p.team;
    const tOff = Math.max(teamOffense(team), 1);
    const tAvgScore = Math.max(teamAvgScore(team), 1);
    const tAvgInv = Math.max(teamAvgInvolvement(team), 1);
    const conceded = Math.max(goalsAgainst(team), 0);
    const tp = teamPlayers(team);

    // 1. Offensive share — how much of the team's offense did this player drive?
    const playerOffense = p.goals * 3 + p.assists * 2;
    const offensiveShare = playerOffense / tOff; // 0–1

    // 2. Defensive load — saves relative to goals conceded, with clutch factor
    const clutchFactor = conceded > 0 ? p.saves / (p.saves + conceded) : 0.5;
    const defensiveLoad = tp.length > 1
      ? (p.saves / Math.max(tp.reduce((s, q) => s + q.saves, 0), 1)) * clutchFactor
      : clutchFactor * 0.5; // 0–1

    // 3. Score premium — how far above team average is this player's in-game score?
    const scorePremium = Math.min(p.score / tAvgScore, 2) / 2; // 0–1 (capped at 2× avg)

    // 4. Hidden contribution — in-game score not explained by the visible stats
    const expectedScore = p.goals * 100 + p.assists * 50 + p.saves * 50 + p.shots * 10;
    const hidden = p.score > 0
      ? Math.max(0, Math.min((p.score - expectedScore) / Math.max(p.score, 1), 1))
      : 0; // 0–1

    // 5. Involvement rate — how active vs team average
    const totalActions = p.goals + p.assists + p.saves + p.shots;
    const involvementRate = Math.min(totalActions / tAvgInv, 2) / 2; // 0–1

    // ── Weighted combination ─────────────────────────────────────────────
    let raw =
      offensiveShare  * 0.25 +
      defensiveLoad   * 0.25 +
      scorePremium    * 0.25 +
      hidden          * 0.15 +
      involvementRate * 0.10;

    // ── Superstar bonus ───────────────────────────────────────────────────
    // +10% for each stat category where this player beats the team average
    const tAvgGoals   = tp.reduce((s, q) => s + q.goals,   0) / tp.length;
    const tAvgAssists = tp.reduce((s, q) => s + q.assists,  0) / tp.length;
    const tAvgSaves   = tp.reduce((s, q) => s + q.saves,    0) / tp.length;
    const tAvgShots   = tp.reduce((s, q) => s + q.shots,    0) / tp.length;

    let superstarBonus = 1.0;
    if (p.goals   > tAvgGoals)   superstarBonus += 0.10;
    if (p.assists > tAvgAssists) superstarBonus += 0.10;
    if (p.saves   > tAvgSaves)   superstarBonus += 0.10;
    if (p.shots   > tAvgShots)   superstarBonus += 0.10;
    if (p.score   > tAvgScore)   superstarBonus += 0.10;
    superstarBonus = Math.min(superstarBonus, 1.5);

    raw *= superstarBonus;

    // ── Fake hero penalty ─────────────────────────────────────────────────
    // Scored 2+ goals but barely did anything else (low involvement)
    if (p.goals >= 2 && (p.assists + p.saves + p.shots) < 3) {
      raw *= 0.75;
    }

    // ── Closeness factor ──────────────────────────────────────────────────
    raw *= 1 - (1 - closenessFactor) * 0.3; // softer dampening than old carry score

    // ── Defensive wall discount ───────────────────────────────────────────
    // High saves on a losing team — effort noted but slightly discounted
    const teamLost =
      (team === "blue" && blueGoals < orangeGoals) ||
      (team === "orange" && orangeGoals < blueGoals);
    if (teamLost && p.saves >= 5 && offensiveShare < 0.2) {
      raw *= 0.9;
    }

    return { name: p.name, raw: Math.max(raw, 0) };
  });

  // ── Normalize game-wide to 1–100 ─────────────────────────────────────────
  const maxRaw = Math.max(...rawScores.map((r) => r.raw), 0.001);

  rawScores.forEach(({ name, raw }) => {
    // Power curve (exponent 0.65) for better spread at the lower end
    const normalized = Math.pow(raw / maxRaw, 0.65);
    const score = Math.max(1, Math.round(normalized * 100));
    result.set(name.toLowerCase(), score);
  });

  return result;
}

// Alias for backward compatibility
export const calculateCarryScores = calculateContributionScores;
