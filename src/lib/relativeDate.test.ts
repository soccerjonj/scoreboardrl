import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { format } from "date-fns";
import { relativeDate } from "./relativeDate";

const NOW = new Date("2026-05-15T12:00:00.000Z");

describe("relativeDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows minutes for anything under an hour", () => {
    const twelveMinAgo = new Date(NOW.getTime() - 12 * 60000).toISOString();
    expect(relativeDate(twelveMinAgo)).toBe("12m ago");
  });

  it("shows 0m ago for the current instant", () => {
    expect(relativeDate(NOW.toISOString())).toBe("0m ago");
  });

  it("shows hours for anything under 24 hours but over an hour", () => {
    const fiveHoursAgo = new Date(NOW.getTime() - 5 * 3600000).toISOString();
    expect(relativeDate(fiveHoursAgo)).toBe("5h ago");
  });

  it("shows a full date once 24 hours have passed", () => {
    const twoDaysAgo = new Date(NOW.getTime() - 48 * 3600000);
    // Compare against date-fns formatting the same local Date directly,
    // so this test doesn't depend on the runner's timezone.
    expect(relativeDate(twoDaysAgo.toISOString())).toBe(format(twoDaysAgo, "MMM d, h:mm a"));
  });
});
