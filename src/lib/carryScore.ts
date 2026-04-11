export interface PlayerForCarry {
  name: string;
  team: "blue" | "orange";
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
}

export interface CarryResult {
  name: string;
  /** 0 = not the carrier on their team, 1–100 = carried (higher = more dominant) */
  carry_score: number;
}

/**
 * Calculates carry scores for all players in a game.
 *
 * Rules:
 * - Only the top contributor per team receives a non-zero score (1–100).
 * - 1v1 games (1 player per side) receive no carry scores.
 * - Score reflects how dominant the carrier was relative to teammates:
 *   1 = barely edged out teammates, 100 = did everything singlehandedly.
 */
export function calculateCarryScores(players: PlayerForCarry[]): CarryResult[] {
  const results: CarryResult[] = players.map((p) => ({ name: p.name, carry_score: 0 }));

  for (const team of ["blue", "orange"] as const) {
    const teamPlayers = players.filter((p) => p.team === team);
    const teamSize = teamPlayers.length;

    // No carry concept in 1v1
    if (teamSize <= 1) continue;

    const opponents = players.filter((p) => p.team !== team);

    // ── Team aggregates ────────────────────────────────────────────────────────
    const teamGoals      = teamPlayers.reduce((s, p) => s + p.goals,   0);
    const teamAssists    = teamPlayers.reduce((s, p) => s + p.assists, 0);
    const teamShots      = teamPlayers.reduce((s, p) => s + p.shots,   0);
    const teamSaves      = teamPlayers.reduce((s, p) => s + p.saves,   0);
    const teamScore      = teamPlayers.reduce((s, p) => s + p.score,   0);
    const goalsAgainst   = opponents.reduce((s, p) => s + p.goals,     0);

    const teamAvgSaves       = teamSaves / teamSize;
    const teamAvgScore       = teamScore / teamSize;
    const teamAvgInvolvement = teamPlayers.reduce((s, p) => s + p.goals + p.assists + p.shots + p.saves, 0) / teamSize;
    const teamShotWaste      = teamShots > 0 ? (teamShots - teamGoals) / teamShots : 0;
    const teamOffenseWeight  = teamGoals * 3 + teamAssists * 2;

    // Hidden contribution: score not explained by visible stats
    // Goal ≈ 100 pts, Assist ≈ 50 pts, Save ≈ 50 pts, Shot ≈ 10 pts
    const hiddenContribs = teamPlayers.map((p) =>
      Math.max(p.score - (p.goals * 100 + p.assists * 50 + p.saves * 50 + p.shots * 10), 0)
    );
    const teamAvgHidden = hiddenContribs.reduce((s, h) => s + h, 0) / teamSize;

    // Game closeness multiplier — blowouts dampen carry signal
    const goalDiff     = Math.abs(teamGoals - goalsAgainst);
    const closenessMult = 1 / (1 + goalDiff * 0.15);
    const isLoser      = teamGoals < goalsAgainst;

    // ── Per-player raw carry ───────────────────────────────────────────────────
    const rawCarries = teamPlayers.map((p, i) => {
      // 1. Offensive share — what % of team offense ran through you
      const offensive = teamOffenseWeight > 0
        ? (p.goals * 3 + p.assists * 2) / teamOffenseWeight
        : 0;

      // 2. Enabler bonus — assists weighted by how badly teammates converted
      const maxEnablerRaw = Math.max(...teamPlayers.map((tp) => tp.assists)) * (1 + teamShotWaste);
      const enablerBonus = maxEnablerRaw > 0
        ? (p.assists * (1 + teamShotWaste)) / maxEnablerRaw
        : 0;

      // 3. Defensive load — overloaded defender × clutch saver
      const savesRatio  = teamAvgSaves > 0 ? p.saves / teamAvgSaves : (p.saves > 0 ? 2 : 0);
      const clutchFactor = (p.saves + goalsAgainst) > 0 ? p.saves / (p.saves + goalsAgainst) : 0;
      const defensiveLoad = Math.min(savesRatio * clutchFactor, 3);

      // 4. Score premium — how far above team average your score is
      const scorePremium = teamAvgScore > 0
        ? Math.min(Math.max((p.score - teamAvgScore) / teamAvgScore, -1), 2)
        : 0;

      // 5. Hidden contribution residual — invisible work the game engine saw
      const residualCarryIndex = teamAvgHidden > 0
        ? Math.min(hiddenContribs[i] / teamAvgHidden, 3)
        : hiddenContribs[i] > 0 ? 1 : 0;

      // 6. Involvement rate — were you constantly in the action?
      const involvement    = p.goals + p.assists + p.shots + p.saves;
      const involvementRate = teamAvgInvolvement > 0
        ? Math.min(involvement / teamAvgInvolvement, 3)
        : involvement > 0 ? 1 : 0;

      // Weighted sum (all pillars 0–1 scale before multipliers)
      let raw =
        offensive          * 0.20 +
        enablerBonus       * 0.15 +
        defensiveLoad      * 0.20 +
        scorePremium       * 0.15 +
        residualCarryIndex * 0.15 +
        involvementRate    * 0.15;

      // Two-way superstar bonus: above-average in goals, assists, AND saves
      const pillarsAboveAvg = [
        p.goals   > teamGoals   / teamSize,
        p.assists > teamAssists / teamSize,
        p.saves   > teamAvgSaves,
      ].filter(Boolean).length;
      raw *= 1.0 + pillarsAboveAvg * 0.1;

      // Fake hero penalty: multiple goals but almost zero other involvement
      if (p.goals >= 2 && p.shots + p.saves + p.assists < 3) raw *= 0.75;

      // Game closeness: blowout wins/losses mean less individual carry
      raw *= closenessMult;

      // Defensive wall on a losing team: slight discount (they were carrying
      // defensively but the offence failed them — still notable, just discounted)
      if (isLoser && savesRatio > 1.5) raw *= 0.9;

      return Math.max(raw, 0);
    });

    // ── Pick the top carrier and score them 1–100 ─────────────────────────────
    const maxIdx      = rawCarries.indexOf(Math.max(...rawCarries));
    const topRaw      = rawCarries[maxIdx];
    const totalRaw    = rawCarries.reduce((s, r) => s + r, 0);

    // How far above "fair share" was the top player?
    const fairShare  = 1 / teamSize;
    const topShare   = totalRaw > 0 ? topRaw / totalRaw : fairShare;
    const excess     = Math.max(topShare - fairShare, 0);
    const maxExcess  = 1 - fairShare; // theoretical max if one player did everything
    const carryScore = maxExcess > 0 ? Math.max(Math.round((excess / maxExcess) * 100), 1) : 1;

    const winner = results.find((r) => r.name === teamPlayers[maxIdx].name);
    if (winner) winner.carry_score = carryScore;
  }

  return results;
}
