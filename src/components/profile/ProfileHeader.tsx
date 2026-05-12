import { Link, Pencil, User, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CARS, CarBadge } from "@/components/profile/CarSilhouette";
import { getRankIcon } from "@/lib/rankIcons";
import type { Database } from "@/integrations/supabase/types";
import type { TeammateProfile } from "@/types/profile";

type RankTier = Database["public"]["Enums"]["rank_tier"];
type GameMode = Database["public"]["Enums"]["game_mode"];
type RankInput = { rank_tier: RankTier; rank_division: string | null; mmr: number | null };

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

const RANK_LABELS: Partial<Record<RankTier, string>> = {
  unranked: "Unranked",
  bronze_1: "Bronze I", bronze_2: "Bronze II", bronze_3: "Bronze III",
  silver_1: "Silver I", silver_2: "Silver II", silver_3: "Silver III",
  gold_1: "Gold I", gold_2: "Gold II", gold_3: "Gold III",
  platinum_1: "Platinum I", platinum_2: "Platinum II", platinum_3: "Platinum III",
  diamond_1: "Diamond I", diamond_2: "Diamond II", diamond_3: "Diamond III",
  champion_1: "Champion I", champion_2: "Champion II", champion_3: "Champion III",
  grand_champion_1: "Grand Champ I", grand_champion_2: "Grand Champ II", grand_champion_3: "Grand Champ III",
  supersonic_legend: "Supersonic Legend",
};

const RANK_COLORS: Partial<Record<string, string>> = {
  unranked: "text-muted-foreground",
  bronze_1: "text-amber-700", bronze_2: "text-amber-700", bronze_3: "text-amber-700",
  silver_1: "text-slate-400", silver_2: "text-slate-400", silver_3: "text-slate-400",
  gold_1: "text-yellow-400", gold_2: "text-yellow-400", gold_3: "text-yellow-400",
  platinum_1: "text-cyan-400", platinum_2: "text-cyan-400", platinum_3: "text-cyan-400",
  diamond_1: "text-blue-400", diamond_2: "text-blue-400", diamond_3: "text-blue-400",
  champion_1: "text-purple-400", champion_2: "text-purple-400", champion_3: "text-purple-400",
  grand_champion_1: "text-red-400", grand_champion_2: "text-red-400", grand_champion_3: "text-red-400",
  supersonic_legend: "text-primary",
};

// Avatar ring color + optional glow per rank tier
type RingStyle = { border: string; shadow?: string };
function getRingStyle(tier: RankTier | undefined): RingStyle {
  if (!tier || tier === "unranked") return { border: "hsl(var(--border) / 0.7)" };
  if (tier.startsWith("bronze"))         return { border: "#92400e" };
  if (tier.startsWith("silver"))         return { border: "#94a3b8" };
  if (tier.startsWith("gold"))           return { border: "#facc15", shadow: "0 0 10px rgba(250,204,21,0.35)" };
  if (tier.startsWith("platinum"))       return { border: "#22d3ee", shadow: "0 0 12px rgba(34,211,238,0.35)" };
  if (tier.startsWith("diamond"))        return { border: "#60a5fa", shadow: "0 0 14px rgba(96,165,250,0.45)" };
  if (tier.startsWith("champion"))       return { border: "#c084fc", shadow: "0 0 14px rgba(192,132,252,0.45)" };
  if (tier.startsWith("grand_champion")) return { border: "#f87171", shadow: "0 0 16px rgba(248,113,113,0.5)" };
  return { border: "hsl(var(--primary))", shadow: "0 0 20px hsl(var(--primary) / 0.55)" };
}

// Subtle rank-tinted card background gradient
function getBgGradient(tier: RankTier | undefined): string {
  if (!tier || tier === "unranked")
    return "linear-gradient(135deg, hsl(var(--primary) / 0.08) 0%, transparent 60%)";
  if (tier.startsWith("bronze"))
    return "linear-gradient(135deg, rgba(146,64,14,0.13) 0%, transparent 60%)";
  if (tier.startsWith("silver"))
    return "linear-gradient(135deg, rgba(148,163,184,0.10) 0%, transparent 60%)";
  if (tier.startsWith("gold"))
    return "linear-gradient(135deg, rgba(234,179,8,0.14) 0%, transparent 60%)";
  if (tier.startsWith("platinum"))
    return "linear-gradient(135deg, rgba(34,211,238,0.13) 0%, transparent 60%)";
  if (tier.startsWith("diamond"))
    return "linear-gradient(135deg, rgba(59,130,246,0.15) 0%, transparent 60%)";
  if (tier.startsWith("champion"))
    return "linear-gradient(135deg, rgba(168,85,247,0.15) 0%, transparent 60%)";
  if (tier.startsWith("grand_champion"))
    return "linear-gradient(135deg, rgba(239,68,68,0.14) 0%, transparent 60%)";
  return "linear-gradient(135deg, hsl(var(--primary) / 0.18) 0%, rgba(168,85,247,0.10) 60%)";
}

const MODE_LABELS: Partial<Record<GameMode, string>> = {
  "1v1": "1v1", "2v2": "2v2", "3v3": "3v3",
};

type Props = {
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  favoriteCar: string | null;
  ranks: Record<GameMode, RankInput>;
  profileUserId: string;
  totalGames?: number;
  wins?: number;
  teammates?: TeammateProfile[];
  // Own profile only — omit to hide controls
  onEdit?: () => void;
};

export default function ProfileHeader({
  displayName,
  avatarUrl,
  bio,
  favoriteCar,
  ranks,
  profileUserId,
  totalGames,
  wins,
  teammates,
  onEdit,
}: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const favoriteCarObj = favoriteCar ? CARS.find((c) => c.name === favoriteCar) ?? null : null;

  // Highest rank for ring + gradient
  const primaryRankEntry = Object.values(ranks).reduce<RankInput | null>((best, r) => {
    const idx = RANK_TIER_ORDER.indexOf(r.rank_tier);
    if (!best) return r;
    return idx > RANK_TIER_ORDER.indexOf(best.rank_tier) ? r : best;
  }, null);
  const primaryRank = primaryRankEntry?.rank_tier !== "unranked" ? primaryRankEntry : null;

  const ringStyle   = getRingStyle(primaryRank?.rank_tier);
  const bgGradient  = getBgGradient(primaryRank?.rank_tier);

  const winRate = (totalGames && wins != null && totalGames > 0)
    ? Math.round((wins / totalGames) * 100)
    : null;

  const rankedModes = (["1v1", "2v2", "3v3"] as GameMode[]).filter(
    (m) => ranks[m]?.rank_tier && ranks[m].rank_tier !== "unranked"
  );

  const handleShare = async () => {
    const url = `${window.location.origin}/profile/${profileUserId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied to clipboard" });
    } catch {
      toast({ title: "Profile link", description: url });
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Subtle rank-tinted gradient overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: bgGradient }} />

      <div className="relative p-4 space-y-4">
        {/* Top row: avatar + action buttons */}
        <div className="flex items-start justify-between gap-3">
          {/* Avatar with rank ring */}
          <div
            className="w-20 h-20 rounded-full bg-muted/40 overflow-hidden shrink-0"
            style={{
              border: `3px solid ${ringStyle.border}`,
              boxShadow: ringStyle.shadow ?? "none",
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} decoding="async" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User className="w-9 h-9 text-muted-foreground/60" />
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/50 bg-background/70 backdrop-blur-sm text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Link className="w-3.5 h-3.5" />
              Share
            </button>
            {!onEdit && (
              <button
                onClick={() => navigate(`/stats?friend=${profileUserId}`)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/50 bg-background/70 backdrop-blur-sm text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Users className="w-3.5 h-3.5" />
                Together
              </button>
            )}
            {onEdit && (
              <button
                onClick={onEdit}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/50 bg-background/70 backdrop-blur-sm text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Identity */}
        <div className="space-y-1">
          <h2 className="font-display font-bold text-2xl leading-tight tracking-tight">
            {displayName || "—"}
          </h2>
          {bio && <p className="text-sm text-muted-foreground leading-snug">{bio}</p>}
          {favoriteCarObj && (
            <div className="flex items-center gap-2 pt-0.5">
              <CarBadge car={favoriteCarObj} />
            </div>
          )}
        </div>

        {/* Quick stats */}
        {(totalGames != null && totalGames > 0) && (
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <div className="flex items-center gap-1">
              <span className="font-display font-bold">{totalGames}</span>
              <span className="text-xs text-muted-foreground">games</span>
            </div>
            {winRate != null && (
              <>
                <span className="text-border/60">·</span>
                <div className="flex items-center gap-1">
                  <span className={cn("font-display font-bold", winRate >= 50 ? "text-rl-green" : "text-rl-red")}>
                    {winRate}%
                  </span>
                  <span className="text-xs text-muted-foreground">win rate</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Competitive Ranks — compact inline rows */}
        {rankedModes.length > 0 && (
          <div className="border-t border-border/30 pt-2.5 space-y-1.5">
            {rankedModes.map((mode) => {
              const rank = ranks[mode];
              const colorClass = RANK_COLORS[rank.rank_tier] ?? "text-foreground";
              return (
                <div key={mode} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase w-6 shrink-0">
                    {MODE_LABELS[mode]}
                  </span>
                  <img
                    src={getRankIcon(rank.rank_tier)}
                    alt={RANK_LABELS[rank.rank_tier] ?? rank.rank_tier}
                    className="w-5 h-5 object-contain shrink-0"
                  />
                  <span className={cn("text-xs font-semibold", colorClass)}>
                    {RANK_LABELS[rank.rank_tier] ?? rank.rank_tier}
                    {rank.rank_division && rank.rank_tier !== "supersonic_legend"
                      ? ` ${rank.rank_division}`
                      : ""}
                  </span>
                  {rank.mmr != null && (
                    <span className="text-[10px] text-muted-foreground font-mono ml-auto">{rank.mmr} MMR</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Squad strip — most played with */}
        {teammates && teammates.length > 0 && (
          <div className="border-t border-border/30 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Squad</p>
            <div className="flex items-start gap-4">
              {teammates.slice(0, 3).map((tm) => {
                const winRate = tm.games > 0 ? Math.round((tm.wins / tm.games) * 100) : 0;
                return (
                  <a
                    key={tm.userId}
                    href={`/profile/${tm.userId}`}
                    className="flex flex-col items-center gap-1 group min-w-0"
                  >
                    <div className="w-11 h-11 rounded-full bg-muted/60 border-2 border-border/50 overflow-hidden shrink-0 flex items-center justify-center group-hover:border-primary/50 transition-colors">
                      {tm.avatarUrl
                        ? <img src={tm.avatarUrl} alt={tm.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        : <span className="text-xs font-bold text-muted-foreground">{tm.name.slice(0, 2).toUpperCase()}</span>
                      }
                    </div>
                    <p className="text-[10px] font-medium text-muted-foreground truncate max-w-[52px] text-center leading-tight">{tm.name}</p>
                    <span className={cn("text-[9px] font-bold font-mono", winRate >= 50 ? "text-rl-green" : "text-rl-red")}>
                      {winRate}%
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
