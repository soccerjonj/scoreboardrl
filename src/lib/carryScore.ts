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
 * Three pillars:
 *   Score premium   60% — in-game score relative to team average (Psyonix's
 *                         own comprehensive metric, capped at 2× to prevent
 *                         outliers from dominating)
 *   Defensive load  25% — player saves as a share of opposing team's total
 *                         shots, so a single save in a low-pressure game isn't
 *                         over-rewarded
 *   Offensive share 15% — goals (×3) + assists (×2) share of team offense
 */
export function calculateContributionScores(players: PlayerStats[]): Map<string, number> {
  const result = new Map<string, number>();
  if (players.length === 0) return result;

  const teamPlayers = (team: "blue" | "orange") =>
    players.filter((p) => p.team === team);

  const rawOf = (p: PlayerStats): number => {
    const team = p.team;
    const tp = teamPlayers(team);
    if (tp.length === 0) return 0;

    const opposingTeam = team === "blue" ? "orange" : "blue";
    const opposingShots = Math.max(
      players.filter((q) => q.team === opposingTeam).reduce((s, q) => s + q.shots, 0),
      1
    );

    const tOff = Math.max(tp.reduce((s, q) => s + q.goals * 3 + q.assists * 2, 0), 1);
    const tAvgScore = Math.max(tp.reduce((s, q) => s + q.score, 0) / tp.length, 1);

    // 1. Offensive share (15%)
    const offShare = (p.goals * 3 + p.assists * 2) / tOff;

    // 2. Defensive load (25%) — saves as a share of opposing team's total shots
    const defLoad = p.saves / opposingShots;

    // 3. Score premium (60%) — capped at 2× team average
    const scorePremium = Math.min(p.score / tAvgScore, 2) / 2;

    return Math.max(
      offShare     * 0.15 +
      defLoad      * 0.25 +
      scorePremium * 0.60,
      0.01
    );
  };

  const teams: Array<"blue" | "orange"> = ["blue", "orange"];

  for (const team of teams) {
    const tp = teamPlayers(team);
    if (tp.length === 0) continue;

    if (tp.length === 1) {
      result.set(tp[0].name.toLowerCase(), 100);
      continue;
    }

    const raws = tp.map((p) => ({ name: p.name, raw: rawOf(p) }));
    const total = raws.reduce((s, r) => s + r.raw, 0);

    const floats   = raws.map((r) => (r.raw / total) * 100);
    const floors   = floats.map(Math.floor);
    const leftover = 100 - floors.reduce((a, b) => a + b, 0);

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
