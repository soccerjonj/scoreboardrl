/**
 * Player-row matching helpers. A "target" represents a person in two ways:
 *  • by their ScoreboardRL `user_id` (canonical, set when their account is
 *    linked to the game_players row), and
 *  • by one or more aliases for their in-game name (the parsed scoreboard
 *    text). Names are compared case- and whitespace-insensitively because RL
 *    casing isn't stable across screenshots.
 *
 * Both matching paths exist so that older un-linked game_players rows still
 * resolve to the right person and so that we cope with friends who haven't
 * signed up for ScoreboardRL yet.
 */

export type PlayerMatchTarget = {
  userId?: string | null;
  /** Pre-normalized aliases. Use `buildTarget` to construct from raw names. */
  names: string[];
};

export const normalizeName = (s: string | null | undefined): string =>
  (s ?? "").trim().toLowerCase();

export const buildTarget = (
  userId: string | null | undefined,
  names: Array<string | null | undefined>
): PlayerMatchTarget => ({
  userId,
  names: names.map(normalizeName).filter(Boolean),
});

export const matchesTarget = (
  player: { user_id?: string | null; player_name?: string | null },
  target: PlayerMatchTarget
): boolean => {
  if (target.userId && player.user_id === target.userId) return true;
  if (!target.names.length) return false;
  return target.names.includes(normalizeName(player.player_name));
};

export const findPlayer = <T extends { user_id?: string | null; player_name?: string | null }>(
  players: T[] | null | undefined,
  target: PlayerMatchTarget
): T | null => players?.find((p) => matchesTarget(p, target)) ?? null;
