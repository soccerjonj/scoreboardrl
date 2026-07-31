import { describe, it, expect } from "vitest";
import { getRankIcon, RANK_ICONS } from "./rankIcons";

describe("getRankIcon", () => {
  it("returns the mapped icon for a known tier", () => {
    expect(getRankIcon("diamond_2")).toBe(RANK_ICONS.diamond_2);
  });

  it("falls back to unranked for an unknown tier", () => {
    expect(getRankIcon("not_a_real_tier")).toBe(RANK_ICONS.unranked);
  });

  it("has an icon for every rank tier used by the scoreboard parser", () => {
    const tiers = [
      "bronze_1", "bronze_2", "bronze_3",
      "silver_1", "silver_2", "silver_3",
      "gold_1", "gold_2", "gold_3",
      "platinum_1", "platinum_2", "platinum_3",
      "diamond_1", "diamond_2", "diamond_3",
      "champion_1", "champion_2", "champion_3",
      "grand_champion_1", "grand_champion_2", "grand_champion_3",
      "supersonic_legend",
    ];
    for (const tier of tiers) {
      expect(RANK_ICONS[tier]).toBeTruthy();
    }
  });
});
