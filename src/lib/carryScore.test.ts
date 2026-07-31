import { describe, it, expect } from "vitest";
import { calculateContributionScores, normalizeContribution, type PlayerStats } from "./carryScore";

const player = (overrides: Partial<PlayerStats> & Pick<PlayerStats, "name" | "team">): PlayerStats => ({
  score: 0,
  goals: 0,
  assists: 0,
  saves: 0,
  shots: 0,
  ...overrides,
});

describe("calculateContributionScores", () => {
  it("returns an empty map for no players", () => {
    expect(calculateContributionScores([]).size).toBe(0);
  });

  it("gives a solo 1v1 player 100% regardless of stats", () => {
    const result = calculateContributionScores([
      player({ name: "Alice", team: "blue", score: 200, goals: 1 }),
      player({ name: "Bob", team: "orange", score: 900, goals: 5 }),
    ]);
    expect(result.get("alice")).toBe(100);
    expect(result.get("bob")).toBe(100);
  });

  it("splits a 2v2 team's contribution to sum to exactly 100", () => {
    const result = calculateContributionScores([
      player({ name: "Alice", team: "blue", score: 600, goals: 3, assists: 1, saves: 2, shots: 4 }),
      player({ name: "Bob", team: "blue", score: 200, goals: 0, assists: 1, saves: 0, shots: 2 }),
      player({ name: "Carol", team: "orange", score: 300, shots: 5 }),
      player({ name: "Dave", team: "orange", score: 300, shots: 5 }),
    ]);
    expect((result.get("alice") ?? 0) + (result.get("bob") ?? 0)).toBe(100);
    expect((result.get("carol") ?? 0) + (result.get("dave") ?? 0)).toBe(100);
    // Alice clearly outscored Bob, so she should carry more of the team's 100%.
    expect(result.get("alice")!).toBeGreaterThan(result.get("bob")!);
  });

  it("sums to exactly 100 per team for 3v3 with uneven contributions", () => {
    const result = calculateContributionScores([
      player({ name: "A", team: "blue", score: 700, goals: 4, assists: 2, saves: 3, shots: 6 }),
      player({ name: "B", team: "blue", score: 300, goals: 1, assists: 0, saves: 1, shots: 3 }),
      player({ name: "C", team: "blue", score: 150, goals: 0, assists: 1, saves: 0, shots: 1 }),
      player({ name: "D", team: "orange", score: 400, shots: 4 }),
      player({ name: "E", team: "orange", score: 400, shots: 4 }),
      player({ name: "F", team: "orange", score: 400, shots: 4 }),
    ]);
    const blueTotal = (result.get("a") ?? 0) + (result.get("b") ?? 0) + (result.get("c") ?? 0);
    expect(blueTotal).toBe(100);
  });

  it("caps score premium at 2x team average so a bigger outlier doesn't take a bigger share", () => {
    // With a 3-player team, a low-scoring supporting cast pulls the average
    // down enough that one player's score can exceed 2x the average — that's
    // exactly the case the cap exists for. Once a player's ratio clears 2x,
    // any further increase in their score should NOT increase their share
    // any further, since it's clamped to the same capped value.
    const makeTeam = (aliceScore: number) => [
      player({ name: "Alice", team: "blue", score: aliceScore }),
      player({ name: "Bob", team: "blue", score: 50 }),
      player({ name: "Carol", team: "blue", score: 50 }),
      player({ name: "D", team: "orange", score: 300, shots: 3 }),
      player({ name: "E", team: "orange", score: 300, shots: 3 }),
      player({ name: "F", team: "orange", score: 300, shots: 3 }),
    ];

    // 3000 already puts Alice's ratio (3000 / avg 1033) well past the 2x cap.
    const moderatelyExtreme = calculateContributionScores(makeTeam(3000));
    // 30000 is 10x further beyond the cap threshold.
    const wayMoreExtreme = calculateContributionScores(makeTeam(30000));

    // Alice's own score-premium term is clamped to the same capped value in
    // both cases. Her final % share can still drift by a point or two
    // because Bob/Carol's (uncapped) shares shrink as the team average
    // balloons with Alice's score — but a 10x increase in Alice's score
    // should NOT meaningfully increase her share once she's past the cap.
    const alice3k = moderatelyExtreme.get("alice")!;
    const alice30k = wayMoreExtreme.get("alice")!;
    expect(Math.abs(alice30k - alice3k)).toBeLessThanOrEqual(1);
    // The cap still leaves teammates with a real (non-zero) share.
    expect(moderatelyExtreme.get("bob")).toBeGreaterThan(0);
  });

  it("rewards saves relative to the opposing team's shot volume", () => {
    const withHighPressure = calculateContributionScores([
      player({ name: "Keeper", team: "blue", score: 300, saves: 5 }),
      player({ name: "Mate", team: "blue", score: 300 }),
      player({ name: "O1", team: "orange", score: 300, shots: 10 }),
      player({ name: "O2", team: "orange", score: 300, shots: 10 }),
    ]);
    const withLowPressure = calculateContributionScores([
      player({ name: "Keeper", team: "blue", score: 300, saves: 5 }),
      player({ name: "Mate", team: "blue", score: 300 }),
      player({ name: "O1", team: "orange", score: 300, shots: 2 }),
      player({ name: "O2", team: "orange", score: 300, shots: 2 }),
    ]);
    // Same 5 saves is worth more when the opposing team barely shot at all.
    expect(withLowPressure.get("keeper")!).toBeGreaterThan(withHighPressure.get("keeper")!);
  });

  it("is case-insensitive and keys results by lowercase name", () => {
    const result = calculateContributionScores([
      player({ name: "AlIcE", team: "blue", score: 500 }),
      player({ name: "bob", team: "blue", score: 500 }),
    ]);
    expect(result.has("alice")).toBe(true);
    expect(result.has("bob")).toBe(true);
  });

  it("never assigns a negative or zero share to a participating player", () => {
    const result = calculateContributionScores([
      player({ name: "Alice", team: "blue", score: 0 }),
      player({ name: "Bob", team: "blue", score: 1000 }),
    ]);
    expect(result.get("alice")!).toBeGreaterThanOrEqual(1);
  });

  it("handles a team with all-zero stats without dividing by zero", () => {
    const result = calculateContributionScores([
      player({ name: "Alice", team: "blue" }),
      player({ name: "Bob", team: "blue" }),
    ]);
    expect((result.get("alice") ?? 0) + (result.get("bob") ?? 0)).toBe(100);
  });
});

describe("normalizeContribution", () => {
  it("returns null for 1v1 (team size 1)", () => {
    expect(normalizeContribution(100, 1)).toBeNull();
  });

  it("returns null for team size 0", () => {
    expect(normalizeContribution(50, 0)).toBeNull();
  });

  it("maps equal contribution in 2v2 (50%) to 100", () => {
    expect(normalizeContribution(50, 2)).toBe(100);
  });

  it("maps equal contribution in 3v3 (33%) to ~100", () => {
    expect(normalizeContribution(33, 3)).toBe(99);
  });

  it("scores above equal share normalize above 100 (carried the team)", () => {
    expect(normalizeContribution(65, 2)).toBe(130);
  });

  it("scores below equal share normalize below 100 (below average)", () => {
    expect(normalizeContribution(35, 2)).toBe(70);
  });
});
