import type { Database } from "@/integrations/supabase/types";

type GameMode = Database["public"]["Enums"]["game_mode"];

/** Standard 1v1/2v2/3v3 soccer — contribute to profile averages and leaderboard */
export const STANDARD_MODES: GameMode[] = ["1v1", "2v2", "3v3"];

/** Extra competitive playlists — tracked separately, excluded from standard stats */
export const EXTRA_MODES: GameMode[] = [
  "rumble_3v3",
  "hoops_2v2",
  "snowday_3v3",
  "dropshot_3v3",
  "heatseeker_2v2",
];

/** Human-readable labels for extra modes (and 4v4) */
export const EXTRA_MODE_LABELS: Partial<Record<GameMode, string>> = {
  rumble_3v3:     "3v3 Rumble",
  hoops_2v2:      "2v2 Hoops",
  snowday_3v3:    "3v3 Snow Day",
  dropshot_3v3:   "3v3 Dropshot",
  heatseeker_2v2: "2v2 Heatseeker",
  "4v4":          "4v4",
};

/** Modes where scoreboard shows "Damage" instead of "Shots" */
export const DAMAGE_MODES: GameMode[] = ["dropshot_3v3"];

/** Returns true if the mode is non-standard (excluded from averages/leaderboard) */
export function isExtraMode(mode: string): boolean {
  return !STANDARD_MODES.includes(mode as GameMode);
}
