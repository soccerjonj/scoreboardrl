import type { Database } from "@/integrations/supabase/types";
import type { TournamentSummary } from "@/types/profile";

type GameMode = Database["public"]["Enums"]["game_mode"];
type RankTier = Database["public"]["Enums"]["rank_tier"];
type RankInput = { rank_tier: RankTier; rank_division: string | null; mmr: number | null };

export type BadgeId =
  | "champion"
  | "finalist"
  | "mvp_machine"
  | "goal_machine"
  | "shot_stopper"
  | "team_player"
  | "sniper"
  | "active"
  | "veteran"
  | "grinder"
  | "on_fire"
  | "diamond_plus"
  | "grand_champion";

export type Badge = {
  id: BadgeId;
  emoji: string;
  label: string;
  description: string;
  earned: boolean;
};

type ProfileStats = {
  totalGames: number;
  wins: number;
  losses: number;
  recentForm: Array<"W" | "L">;
  avgScore: number;
  avgGoals: number;
  avgAssists: number;
  avgSaves: number;
  avgShots: number;
  avgContribution: number | null;
  mvpRate: number;
  bestScore: number;
  bestGoals: number;
  bestAssists: number;
  bestSaves: number;
  bestContributionScore: number;
  topTeammates: Array<{ userId: string; name: string; games: number; wins: number }>;
};

const RANK_TIER_ORDER: RankTier[] = [
  "unranked",
  "bronze_1", "bronze_2", "bronze_3",
  "silver_1", "silver_2", "silver_3",
  "gold_1", "gold_2", "gold_3",
  "platinum_1", "platinum_2", "platinum_3",
  "diamond_1", "diamond_2", "diamond_3",
  "champion_1", "champion_2", "champion_3",
  "grand_champion_1", "grand_champion_2", "grand_champion_3",
  "supersonic_legend",
];

const DIAMOND_PLUS_INDEX = RANK_TIER_ORDER.indexOf("diamond_1");
const GRAND_CHAMP_INDEX  = RANK_TIER_ORDER.indexOf("grand_champion_1");

const BADGE_DEFINITIONS: Omit<Badge, "earned">[] = [
  { id: "champion",      emoji: "🏆", label: "Champion",     description: "Won a tournament" },
  { id: "finalist",      emoji: "🥈", label: "Finalist",     description: "Reached the Final (without winning)" },
  { id: "mvp_machine",   emoji: "⭐", label: "MVP Machine",  description: "MVP in 35%+ of games (min 10 games)" },
  { id: "goal_machine",  emoji: "⚽", label: "Goal Machine", description: "1.5+ goals per game (min 10 games)" },
  { id: "shot_stopper",  emoji: "🧱", label: "Shot Stopper", description: "2.0+ saves per game (min 10 games)" },
  { id: "team_player",   emoji: "🤝", label: "Team Player",  description: "1.0+ assists per game (min 10 games)" },
  { id: "sniper",        emoji: "🎯", label: "Sniper",       description: "30%+ shot conversion rate (min 10 games)" },
  { id: "active",        emoji: "🎮", label: "Active",       description: "10+ games logged" },
  { id: "veteran",       emoji: "💪", label: "Veteran",      description: "50+ games logged" },
  { id: "grinder",       emoji: "⚙️", label: "Grinder",      description: "100+ games logged" },
  { id: "on_fire",       emoji: "🔥", label: "On Fire",      description: "3+ game win streak" },
  { id: "diamond_plus",  emoji: "💎", label: "Diamond+",     description: "Diamond rank or above in any mode" },
  { id: "grand_champion",emoji: "👑", label: "Grand Champ",  description: "Grand Champion rank or above in any mode" },
];

type UseProfileBadgesInput = {
  stats: ProfileStats | null;
  ranks: Record<GameMode, RankInput>;
  tournaments: TournamentSummary | null;
};

type UseProfileBadgesResult = {
  badges: Badge[];
  earnedCount: number;
  totalCount: number;
};

export function useProfileBadges({ stats, ranks, tournaments }: UseProfileBadgesInput): UseProfileBadgesResult {
  const highestRankIndex = Math.max(
    ...Object.values(ranks).map((r) => RANK_TIER_ORDER.indexOf(r.rank_tier))
  );

  function check(id: BadgeId): boolean {
    const g = stats?.totalGames ?? 0;
    const minGames = g >= 10;

    switch (id) {
      case "champion":
        return (tournaments?.wins ?? 0) > 0;
      case "finalist":
        return (tournaments?.highestRoundReached === "final") && (tournaments?.wins ?? 0) === 0;
      case "mvp_machine":
        return minGames && (stats?.mvpRate ?? 0) > 35;
      case "goal_machine":
        return minGames && (stats?.avgGoals ?? 0) > 1.5;
      case "shot_stopper":
        return minGames && (stats?.avgSaves ?? 0) > 2.0;
      case "team_player":
        return minGames && (stats?.avgAssists ?? 0) > 1.0;
      case "sniper":
        return minGames && (stats?.avgShots ?? 0) > 0 && (stats?.avgGoals ?? 0) / (stats?.avgShots ?? 1) > 0.30;
      case "active":
        return g >= 10;
      case "veteran":
        return g >= 50;
      case "grinder":
        return g >= 100;
      case "on_fire": {
        const form = stats?.recentForm ?? [];
        return form.length >= 3 && form[0] === "W" && form[1] === "W" && form[2] === "W";
      }
      case "diamond_plus":
        return highestRankIndex >= DIAMOND_PLUS_INDEX && highestRankIndex > 0;
      case "grand_champion":
        return highestRankIndex >= GRAND_CHAMP_INDEX;
      default:
        return false;
    }
  }

  const allBadges: Badge[] = BADGE_DEFINITIONS.map((def) => ({
    ...def,
    earned: check(def.id),
  }));

  // Sort: earned first, then unearned
  const badges = [
    ...allBadges.filter((b) => b.earned),
    ...allBadges.filter((b) => !b.earned),
  ];

  return {
    badges,
    earnedCount: badges.filter((b) => b.earned).length,
    totalCount: badges.length,
  };
}
