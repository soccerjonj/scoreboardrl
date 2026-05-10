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

/**
 * Returns true if the game should count toward standard stats and leaderboard.
 * - Competitive 1v1/2v2/3v3: always counted
 * - Tournament Soccar 2v2/3v3: counted (treated equivalent to competitive)
 * - Everything else (casual, extra modes, non-soccar tournaments): not counted
 */
export function isStandardGame(g: {
  game_mode: string;
  game_type: string;
  tournament_type?: string | null;
}): boolean {
  if (g.game_type === "competitive") return STANDARD_MODES.includes(g.game_mode as GameMode);
  if (g.game_type === "tournament") {
    return (g.game_mode === "2v2" || g.game_mode === "3v3") && g.tournament_type === "soccar";
  }
  return false;
}

/**
 * High-level game category — a single label that captures both the game_type
 * and whether the mode is "standard" (1v1/2v2/3v3 soccar) or not.
 *
 *  competitive          → comp 1v1/2v2/3v3 (serious, counted)
 *  tournament           → tournament 2v2/3v3 Soccar (serious, counted)
 *  casual               → casual any mode (not serious)
 *  extra_mode           → comp Rumble/Hoops/Snow Day/Dropshot/Heatseeker, comp 4v4 (not serious)
 *  special_tournament   → tournament non-Soccar e.g. Rumble/Heatseeker (not serious)
 */
export type GameCategory = "competitive" | "tournament" | "casual" | "extra_mode" | "special_tournament";

export function getGameCategory(g: {
  game_type: string;
  game_mode: string;
  tournament_type?: string | null;
}): GameCategory {
  if (g.game_type === "tournament") {
    if (g.tournament_type === "soccar" && (g.game_mode === "2v2" || g.game_mode === "3v3")) {
      return "tournament";
    }
    return "special_tournament";
  }
  if (g.game_type === "competitive") {
    return STANDARD_MODES.includes(g.game_mode as GameMode) ? "competitive" : "extra_mode";
  }
  return "casual";
}

export const GAME_CATEGORY_LABELS: Record<GameCategory, string> = {
  competitive:        "Competitive",
  tournament:         "Tournament",
  casual:             "Casual",
  extra_mode:         "Extra Mode",
  special_tournament: "Special Tournament",
};

/** Short labels for compact previews where horizontal space is tight. */
export const GAME_CATEGORY_SHORT_LABELS: Record<GameCategory, string> = {
  competitive:        "Comp",
  tournament:         "Tourny",
  casual:             "Casual",
  extra_mode:         "Extra",
  special_tournament: "Sp. Tourny",
};

/** Categories that contribute to standard stats and leaderboard */
export const SERIOUS_CATEGORIES: GameCategory[] = ["competitive", "tournament"];

/** True for "serious" categories (counted in stats) */
export function isSeriousCategory(c: GameCategory): boolean {
  return SERIOUS_CATEGORIES.includes(c);
}
