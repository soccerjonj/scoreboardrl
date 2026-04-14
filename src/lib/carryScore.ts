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
 * Higher = bigger impact on the match. Everyone gets a score.
 */
export function calculateContributionScores(players: PlayerStats[]): Map<string, number> {
  const result = new Map<string, number>();

  if (players.length === 0) return result;

  // Raw contribution: weighted combination of all meaningful stats
  // RL in-game score already captures a lot, we amplify key actions
  const raws = players.map((p) => {
    const raw =
      p.score * 0.6 +       // in-game score is the primary signal
      p.goals * 120 +        // goals are the most impactful
      p.assists * 70 +       // assists matter
      p.saves * 60 +         // saves matter especially in tight games
      p.shots * 15;          // shots show involvement
    return { name: p.name, raw: Math.max(raw, 0) };
  });

  const maxRaw = Math.max(...raws.map((r) => r.raw), 1);

  raws.forEach(({ name, raw }) => {
    // Scale to 1–100; everyone gets at least 1
    const scaled = Math.round((raw / maxRaw) * 100);
    result.set(name.toLowerCase(), Math.max(scaled, 1));
  });

  return result;
}

// Keep old export name for any stale imports
export const calculateCarryScores = calculateContributionScores;
