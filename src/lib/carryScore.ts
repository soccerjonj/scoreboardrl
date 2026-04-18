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
 * Calculate each player's contribution as a percentage of their TEAM's total.
 * All teammates sum to exactly 100 (e.g. 2v2: 65% + 35% = 100%).
 *
 * Five pillars weighted toward the in-game score (Psyonix's own comprehensive
 * contribution metric) with explicit offensive, defensive, and activity signals:
 *
 *   Score premium   35% — in-game score relative to team average
 *   Offensive share 20% — goals (×3) + assists (×2) share of team offense
 *   Defensive load  25% — share of team saves (no clutch penalty)
 *   Hidden contrib  15% — score beyond what tracked stats explain
 *   Involvement      5% — actions relative to team average
 */
export function calculateContributionScores(players: PlayerStats[]): Map<string, number> {
  const result = new Map<string, number>();
  if (players.length === 0) return result;

  const teamPlayers = (team: "blue" | "orange") =>
    players.filter((p) => p.team === team);

  const goalsFor = (team: "blue" | "orange") =>
    teamPlayers(team).reduce((s, p) => s + p.goals, 0);

  // ── Compute a raw pillar score per player ────────────────────────────────
  const rawOf = (p: PlayerStats): number => {
    const team = p.team;
    const tp = teamPlayers(team);
    if (tp.length === 0) return 0;

    const tOff      = Math.max(tp.reduce((s, q) => s + q.goals * 3 + q.assists * 2, 0), 1);
    const tAvgScore = Math.max(tp.reduce((s, q) => s + q.score, 0) / tp.length, 1);
    const tAvgInv   = Math.max(tp.reduce((s, q) => s + q.goals + q.assists + q.saves + q.shots, 0) / tp.length, 1);

    // 1. Offensive share (20%)
    const offShare = (p.goals * 3 + p.assists * 2) / tOff;

    // 2. Defensive load (25%) — pure save share, no clutch divisor
    //    A save is a save regardless of how many goals were conceded.
    const tTotalSaves = Math.max(tp.reduce((s, q) => s + q.saves, 0), 1);
    const defLoad     = p.saves / tTotalSaves;

    // 3. Score premium (35%) — the game's own comprehensive metric, relative to
    //    team average, capped at 2× to prevent extreme outliers from dominating
    const scorePremium = Math.min(p.score / tAvgScore, 2) / 2;

    // 4. Hidden contribution (15%) — in-game score beyond what tracked stats explain
    const expected = p.goals * 100 + p.assists * 50 + p.saves * 50 + p.shots * 10;
    const hidden   = p.score > 0
      ? Math.max(0, Math.min((p.score - expected) / Math.max(p.score, 1), 1))
      : 0;

    // 5. Involvement rate (5%)
    const actions     = p.goals + p.assists + p.saves + p.shots;
    const involvement = Math.min(actions / tAvgInv, 2) / 2;

    let raw =
      offShare     * 0.20 +
      defLoad      * 0.25 +
      scorePremium * 0.35 +
      hidden       * 0.15 +
      involvement  * 0.05;

    // Superstar bonus (+10% per stat category above team average, max ×1.5)
    const tAvgGoals   = tp.reduce((s, q) => s + q.goals,   0) / tp.length;
    const tAvgAssists = tp.reduce((s, q) => s + q.assists,  0) / tp.length;
    const tAvgSaves   = tp.reduce((s, q) => s + q.saves,    0) / tp.length;
    const tAvgShots   = tp.reduce((s, q) => s + q.shots,    0) / tp.length;

    let bonus = 1.0;
    if (p.goals   > tAvgGoals)   bonus += 0.10;
    if (p.assists > tAvgAssists) bonus += 0.10;
    if (p.saves   > tAvgSaves)   bonus += 0.10;
    if (p.shots   > tAvgShots)   bonus += 0.10;
    if (p.score   > tAvgScore)   bonus += 0.10;
    raw *= Math.min(bonus, 1.5);

    return Math.max(raw, 0.01); // floor so everyone gets something
  };

  // ── Normalize per team so shares sum to exactly 100 ─────────────────────
  const teams: Array<"blue" | "orange"> = ["blue", "orange"];

  for (const team of teams) {
    const tp = teamPlayers(team);
    if (tp.length === 0) continue;

    // 1v1: each player is 100% of their own "team"
    if (tp.length === 1) {
      result.set(tp[0].name.toLowerCase(), 100);
      continue;
    }

    const raws = tp.map((p) => ({ name: p.name, raw: rawOf(p) }));
    const total = raws.reduce((s, r) => s + r.raw, 0);

    // Convert to integer percentages; distribute rounding error to highest raw
    const floats   = raws.map((r) => (r.raw / total) * 100);
    const floors   = floats.map(Math.floor);
    const leftover = 100 - floors.reduce((a, b) => a + b, 0);

    // Give the remainder to the player(s) with the largest fractional part
    const indices = floats
      .map((f, i) => ({ i, frac: f - floors[i] }))
      .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < leftover; k++) floors[indices[k].i]++;

    raws.forEach(({ name }, i) => {
      result.set(name.toLowerCase(), Math.max(floors[i], 1));
    });
  }

  return result;
}

// Alias for backward compatibility
export const calculateCarryScores = calculateContributionScores;
