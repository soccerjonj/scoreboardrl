import { describe, it, expect } from "vitest";
import { normalizeName, buildTarget, matchesTarget, findPlayer } from "./playerMatch";

describe("normalizeName", () => {
  it("lowercases and trims whitespace", () => {
    expect(normalizeName("  Nightbot  ")).toBe("nightbot");
  });

  it("returns an empty string for null/undefined", () => {
    expect(normalizeName(null)).toBe("");
    expect(normalizeName(undefined)).toBe("");
  });
});

describe("buildTarget", () => {
  it("normalizes and dedupes-via-filter empty aliases", () => {
    const target = buildTarget("user-1", [" Alice ", "", null, "ALICE_ALT"]);
    expect(target.userId).toBe("user-1");
    expect(target.names).toEqual(["alice", "alice_alt"]);
  });
});

describe("matchesTarget", () => {
  it("matches by user_id even if the name differs", () => {
    const target = buildTarget("user-1", ["Alice"]);
    expect(matchesTarget({ user_id: "user-1", player_name: "SomeoneElse" }, target)).toBe(true);
  });

  it("matches by normalized name when user_id is absent", () => {
    const target = buildTarget(null, ["Alice"]);
    expect(matchesTarget({ user_id: null, player_name: "  alice  " }, target)).toBe(true);
  });

  it("does not match a different user_id and a different name", () => {
    const target = buildTarget("user-1", ["Alice"]);
    expect(matchesTarget({ user_id: "user-2", player_name: "Bob" }, target)).toBe(false);
  });

  it("returns false when the target has no userId and no names", () => {
    const target = buildTarget(null, []);
    expect(matchesTarget({ user_id: null, player_name: "Anyone" }, target)).toBe(false);
  });
});

describe("findPlayer", () => {
  const players = [
    { user_id: "u1", player_name: "Alice" },
    { user_id: null, player_name: "Bob" },
  ];

  it("finds a player by user_id", () => {
    const target = buildTarget("u1", []);
    expect(findPlayer(players, target)?.player_name).toBe("Alice");
  });

  it("finds an unlinked player by name", () => {
    const target = buildTarget(null, ["bob"]);
    expect(findPlayer(players, target)?.player_name).toBe("Bob");
  });

  it("returns null when no player matches", () => {
    const target = buildTarget("u-nobody", ["nobody"]);
    expect(findPlayer(players, target)).toBeNull();
  });

  it("returns null for a null/undefined players list", () => {
    const target = buildTarget("u1", []);
    expect(findPlayer(null, target)).toBeNull();
    expect(findPlayer(undefined, target)).toBeNull();
  });
});
