import { Camera, Link, Pencil, User } from "lucide-react";
import { useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CARS, CarBadge } from "@/components/profile/CarSilhouette";
import { getRankIcon } from "@/lib/rankIcons";
import type { Database } from "@/integrations/supabase/types";

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
  if (tier.startsWith("bronze"))       return { border: "#92400e" };
  if (tier.startsWith("silver"))       return { border: "#94a3b8" };
  if (tier.startsWith("gold"))         return { border: "#facc15", shadow: "0 0 10px rgba(250,204,21,0.35)" };
  if (tier.startsWith("platinum"))     return { border: "#22d3ee", shadow: "0 0 12px rgba(34,211,238,0.35)" };
  if (tier.startsWith("diamond"))      return { border: "#60a5fa", shadow: "0 0 14px rgba(96,165,250,0.45)" };
  if (tier.startsWith("champion"))     return { border: "#c084fc", shadow: "0 0 14px rgba(192,132,252,0.45)" };
  if (tier.startsWith("grand_champion")) return { border: "#f87171", shadow: "0 0 16px rgba(248,113,113,0.5)" };
  // supersonic_legend
  return { border: "hsl(var(--primary))", shadow: "0 0 20px hsl(var(--primary) / 0.55)" };
}

// Banner fallback gradient per rank category (CSS gradient string)
function getBannerGradient(tier: RankTier | undefined): string {
  if (!tier || tier === "unranked") {
    return "linear-gradient(135deg, hsl(var(--primary) / 0.22) 0%, hsl(280 55% 50% / 0.12) 55%, hsl(var(--background) / 0) 100%)";
  }
  if (tier.startsWith("bronze"))
    return "linear-gradient(135deg, rgba(146,64,14,0.28) 0%, rgba(120,53,15,0.14) 55%, transparent 100%)";
  if (tier.startsWith("silver"))
    return "linear-gradient(135deg, rgba(148,163,184,0.24) 0%, rgba(100,116,139,0.12) 55%, transparent 100%)";
  if (tier.startsWith("gold"))
    return "linear-gradient(135deg, rgba(234,179,8,0.28) 0%, rgba(161,98,7,0.14) 55%, transparent 100%)";
  if (tier.startsWith("platinum"))
    return "linear-gradient(135deg, rgba(34,211,238,0.26) 0%, rgba(8,145,178,0.14) 55%, transparent 100%)";
  if (tier.startsWith("diamond"))
    return "linear-gradient(135deg, rgba(59,130,246,0.30) 0%, rgba(29,78,216,0.16) 55%, transparent 100%)";
  if (tier.startsWith("champion"))
    return "linear-gradient(135deg, rgba(168,85,247,0.30) 0%, rgba(109,40,217,0.16) 55%, transparent 100%)";
  if (tier.startsWith("grand_champion"))
    return "linear-gradient(135deg, rgba(239,68,68,0.28) 0%, rgba(185,28,28,0.14) 55%, transparent 100%)";
  // supersonic_legend
  return "linear-gradient(135deg, hsl(var(--primary) / 0.38) 0%, rgba(168,85,247,0.22) 40%, rgba(239,68,68,0.10) 100%)";
}

type Props = {
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  favoriteCar: string | null;
  ranks: Record<GameMode, RankInput>;
  profileUserId: string;
  // Optional stats for the quick-stats strip
  totalGames?: number;
  wins?: number;
  // Own profile only — omit to hide controls
  onEdit?: () => void;
  onBannerFileSelected?: (file: File) => void;
  uploadingBanner?: boolean;
};

export default function ProfileHeader({
  displayName,
  avatarUrl,
  bannerUrl,
  bio,
  favoriteCar,
  ranks,
  profileUserId,
  totalGames,
  wins,
  onEdit,
  onBannerFileSelected,
  uploadingBanner,
}: Props) {
  const { toast } = useToast();
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const favoriteCarObj = favoriteCar ? CARS.find((c) => c.name === favoriteCar) ?? null : null;

  // Determine highest rank
  const primaryRankEntry = Object.values(ranks).reduce<RankInput | null>((best, r) => {
    const idx = RANK_TIER_ORDER.indexOf(r.rank_tier);
    if (!best) return r;
    return idx > RANK_TIER_ORDER.indexOf(best.rank_tier) ? r : best;
  }, null);
  const primaryRank = primaryRankEntry && primaryRankEntry.rank_tier !== "unranked" ? primaryRankEntry : null;

  const ringStyle = getRingStyle(primaryRank?.rank_tier);
  const bannerGradient = getBannerGradient(primaryRank?.rank_tier);

  const winRate = (totalGames && wins != null && totalGames > 0)
    ? Math.round((wins / totalGames) * 100)
    : null;

  const handleShare = async () => {
    const url = `${window.location.origin}/profile/${profileUserId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied to clipboard" });
    } catch {
      toast({ title: "Profile link", description: url });
    }
  };

  const handleBannerClick = () => {
    if (!uploadingBanner) bannerInputRef.current?.click();
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onBannerFileSelected) onBannerFileSelected(file);
    if (bannerInputRef.current) bannerInputRef.current.value = "";
  };

  return (
    <div>
      {/* Banner */}
      <div className="h-40 relative overflow-hidden rounded-t-xl">
        {bannerUrl ? (
          <img src={bannerUrl} alt="Profile banner" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-card relative">
            {/* Dark base */}
            <div className="absolute inset-0 bg-background/60" />
            {/* Rank-tinted gradient */}
            <div className="absolute inset-0" style={{ background: bannerGradient }} />
            {/* Radial shimmer */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.12),transparent_65%)]" />
          </div>
        )}
        {/* Banner upload button (own profile only) */}
        {onBannerFileSelected && (
          <button
            onClick={handleBannerClick}
            disabled={uploadingBanner}
            className={cn(
              "absolute top-3 right-3 p-1.5 rounded-md bg-black/50 text-white transition-opacity",
              uploadingBanner ? "opacity-50 cursor-not-allowed" : "hover:bg-black/70"
            )}
            aria-label="Change banner"
          >
            <Camera className="w-4 h-4" />
          </button>
        )}
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleBannerChange}
        />
      </div>

      {/* Avatar + action buttons row */}
      <div className="relative z-10 px-4 -mt-12 flex items-end justify-between">
        {/* Avatar — rank-colored ring + glow */}
        <div
          className="w-24 h-24 rounded-full bg-muted/40 overflow-hidden shrink-0"
          style={{
            border: `3px solid ${ringStyle.border}`,
            boxShadow: ringStyle.shadow ?? "none",
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-10 h-10 text-muted-foreground/60" />
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="pb-1 flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/50 bg-background/70 backdrop-blur-sm text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Link className="w-3.5 h-3.5" />
            Share
          </button>
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

      {/* Identity info */}
      <div className="px-4 pt-3 pb-0 space-y-1.5">
        {/* Name — bigger */}
        <h2 className="font-display font-bold text-2xl leading-tight tracking-tight">
          {displayName || "—"}
        </h2>

        {/* Bio */}
        {bio && <p className="text-sm text-muted-foreground leading-snug">{bio}</p>}

        {/* Car badge */}
        {favoriteCarObj && (
          <div className="flex items-center gap-2">
            <CarBadge car={favoriteCarObj} />
          </div>
        )}
      </div>

      {/* Quick-stats strip */}
      <div className="mt-3 px-4 py-3 border-t border-border/30 flex items-center gap-3 flex-wrap">
        {totalGames != null && totalGames > 0 && (
          <>
            <div className="flex items-center gap-1">
              <span className="font-display font-bold text-sm">{totalGames}</span>
              <span className="text-xs text-muted-foreground">games</span>
            </div>
            <span className="text-border/60">·</span>
          </>
        )}
        {winRate != null && (
          <>
            <div className="flex items-center gap-1">
              <span className={cn("font-display font-bold text-sm", winRate >= 50 ? "text-rl-green" : "text-rl-red")}>
                {winRate}%
              </span>
              <span className="text-xs text-muted-foreground">win rate</span>
            </div>
            <span className="text-border/60">·</span>
          </>
        )}
        {primaryRank ? (
          <div className="flex items-center gap-1.5">
            <img
              src={getRankIcon(primaryRank.rank_tier)}
              alt={RANK_LABELS[primaryRank.rank_tier] ?? primaryRank.rank_tier}
              className="w-5 h-5 object-contain"
            />
            <span className={cn("text-sm font-semibold", RANK_COLORS[primaryRank.rank_tier] ?? "text-foreground")}>
              {RANK_LABELS[primaryRank.rank_tier] ?? primaryRank.rank_tier}
              {primaryRank.rank_division && primaryRank.rank_tier !== "supersonic_legend"
                ? ` ${primaryRank.rank_division}`
                : ""}
            </span>
          </div>
        ) : (
          totalGames == null && (
            <span className="text-xs text-muted-foreground">No ranks set</span>
          )
        )}
      </div>
    </div>
  );
}
