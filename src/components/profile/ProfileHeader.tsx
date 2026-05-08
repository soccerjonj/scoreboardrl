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

type Props = {
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  favoriteCar: string | null;
  ranks: Record<GameMode, RankInput>;
  profileUserId: string;
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
  onEdit,
  onBannerFileSelected,
  uploadingBanner,
}: Props) {
  const { toast } = useToast();
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const favoriteCarObj = favoriteCar ? CARS.find((c) => c.name === favoriteCar) ?? null : null;

  // Determine highest rank for the badge
  const primaryRankEntry = Object.values(ranks).reduce<RankInput | null>((best, r) => {
    const idx = RANK_TIER_ORDER.indexOf(r.rank_tier);
    if (!best) return r;
    return idx > RANK_TIER_ORDER.indexOf(best.rank_tier) ? r : best;
  }, null);
  const primaryRank = primaryRankEntry && primaryRankEntry.rank_tier !== "unranked" ? primaryRankEntry : null;

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
          <div className="w-full h-full bg-gradient-to-br from-primary/25 via-rl-purple/15 to-background">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.2),transparent_60%)]" />
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
      <div className="relative z-10 px-4 -mt-10 flex items-end justify-between">
        <div className="w-20 h-20 rounded-full border-[3px] border-background bg-muted/40 overflow-hidden shrink-0 shadow-[0_0_20px_hsl(var(--primary)/0.25)]">
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-9 h-9 text-muted-foreground/60" />
            </div>
          )}
        </div>

        <div className="pb-1 flex items-center gap-2">
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/50 bg-background/60 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Link className="w-3.5 h-3.5" />
            Share
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/50 bg-background/60 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Identity info */}
      <div className="px-4 pt-2 pb-4 space-y-2">
        <h2 className="font-display font-bold text-xl leading-tight">{displayName || "—"}</h2>
        {bio && <p className="text-sm text-muted-foreground">{bio}</p>}
        {(favoriteCarObj || primaryRank) && (
          <div className="flex items-center gap-2 flex-wrap">
            {favoriteCarObj && <CarBadge car={favoriteCarObj} />}
            {primaryRank && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-background/60 border border-border/40">
                <img
                  src={getRankIcon(primaryRank.rank_tier)}
                  alt={RANK_LABELS[primaryRank.rank_tier] ?? primaryRank.rank_tier}
                  className="w-4 h-4 object-contain"
                />
                <span className={`text-xs font-semibold ${RANK_COLORS[primaryRank.rank_tier] ?? "text-foreground"}`}>
                  {RANK_LABELS[primaryRank.rank_tier] ?? primaryRank.rank_tier}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
