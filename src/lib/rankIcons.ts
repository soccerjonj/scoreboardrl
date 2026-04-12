// Maps each rank_tier enum value to its public icon path.
// Files live in /public/ranks/ and are served as static assets.

export const RANK_ICONS: Record<string, string> = {
  unranked:          "/ranks/unranked.png",
  bronze_1:          "/ranks/bronze1.webp",
  bronze_2:          "/ranks/bronze2.webp",
  bronze_3:          "/ranks/bronze3.webp",
  silver_1:          "/ranks/silver1.webp",
  silver_2:          "/ranks/silver2.webp",
  silver_3:          "/ranks/silver3.webp",
  gold_1:            "/ranks/gold1.webp",
  gold_2:            "/ranks/gold2.webp",
  gold_3:            "/ranks/gold3.webp",
  platinum_1:        "/ranks/platinum1.webp",
  platinum_2:        "/ranks/platinum2.webp",
  platinum_3:        "/ranks/platinum3.webp",
  diamond_1:         "/ranks/diamond1.webp",
  diamond_2:         "/ranks/diamond2.webp",
  diamond_3:         "/ranks/diamond3.webp",
  champion_1:        "/ranks/champion1.webp",
  champion_2:        "/ranks/champion2.webp",
  champion_3:        "/ranks/champion3.webp",
  grand_champion_1:  "/ranks/grandchampion1.png",
  grand_champion_2:  "/ranks/grandchampion2.webp",
  grand_champion_3:  "/ranks/grandchampion3.png",
  supersonic_legend: "/ranks/supersoniclegend.webp",
};

export const getRankIcon = (tier: string): string =>
  RANK_ICONS[tier] ?? RANK_ICONS["unranked"];
