import { describe, it, expect } from "vitest";
import {
  isExtraMode,
  isStandardGame,
  getGameCategory,
  isSeriousCategory,
  STANDARD_MODES,
  SERIOUS_CATEGORIES,
} from "./gameModes";

describe("isExtraMode", () => {
  it("treats 1v1/2v2/3v3 as standard, not extra", () => {
    for (const mode of STANDARD_MODES) {
      expect(isExtraMode(mode)).toBe(false);
    }
  });

  it("treats rumble/hoops/snowday/dropshot/heatseeker/4v4 as extra", () => {
    expect(isExtraMode("rumble_3v3")).toBe(true);
    expect(isExtraMode("hoops_2v2")).toBe(true);
    expect(isExtraMode("4v4")).toBe(true);
  });
});

describe("isStandardGame", () => {
  it("counts competitive 1v1/2v2/3v3", () => {
    expect(isStandardGame({ game_mode: "2v2", game_type: "competitive" })).toBe(true);
  });

  it("does not count competitive extra modes (e.g. Rumble)", () => {
    expect(isStandardGame({ game_mode: "rumble_3v3", game_type: "competitive" })).toBe(false);
  });

  it("counts tournament Soccar 2v2/3v3", () => {
    expect(
      isStandardGame({ game_mode: "3v3", game_type: "tournament", tournament_type: "soccar" })
    ).toBe(true);
  });

  it("does not count tournament non-Soccar (e.g. Rumble tournament)", () => {
    expect(
      isStandardGame({ game_mode: "3v3", game_type: "tournament", tournament_type: "rumble" })
    ).toBe(false);
  });

  it("does not count tournament 1v1 Soccar (only 2v2/3v3 qualify)", () => {
    expect(
      isStandardGame({ game_mode: "1v1", game_type: "tournament", tournament_type: "soccar" })
    ).toBe(false);
  });

  it("does not count casual games", () => {
    expect(isStandardGame({ game_mode: "2v2", game_type: "casual" })).toBe(false);
  });
});

describe("getGameCategory", () => {
  it("labels competitive standard modes as 'competitive'", () => {
    expect(getGameCategory({ game_type: "competitive", game_mode: "3v3" })).toBe("competitive");
  });

  it("labels competitive extra modes as 'extra_mode'", () => {
    expect(getGameCategory({ game_type: "competitive", game_mode: "hoops_2v2" })).toBe("extra_mode");
  });

  it("labels tournament Soccar 2v2/3v3 as 'tournament'", () => {
    expect(
      getGameCategory({ game_type: "tournament", game_mode: "2v2", tournament_type: "soccar" })
    ).toBe("tournament");
  });

  it("labels tournament non-Soccar as 'special_tournament'", () => {
    expect(
      getGameCategory({ game_type: "tournament", game_mode: "2v2", tournament_type: "rumble" })
    ).toBe("special_tournament");
  });

  it("labels anything else as 'casual'", () => {
    expect(getGameCategory({ game_type: "casual", game_mode: "1v1" })).toBe("casual");
  });
});

describe("isSeriousCategory", () => {
  it("treats competitive and tournament as serious", () => {
    for (const c of SERIOUS_CATEGORIES) {
      expect(isSeriousCategory(c)).toBe(true);
    }
  });

  it("treats casual/extra_mode/special_tournament as not serious", () => {
    expect(isSeriousCategory("casual")).toBe(false);
    expect(isSeriousCategory("extra_mode")).toBe(false);
    expect(isSeriousCategory("special_tournament")).toBe(false);
  });
});
