/**
 * Lightweight, client-side content guard for user-generated free text
 * (RL account names, bios, squad names). This is a *basic* deterrent — a
 * length cap plus a profanity/slur screen — not a full moderation system.
 * Pair it with the manual takedown process described in the Terms.
 *
 * Design notes
 * ────────────
 * - We normalize before matching so simple evasions (leetspeak, spacing,
 *   punctuation) don't trivially bypass the screen.
 * - The block list is intentionally short and focused on the most severe
 *   slurs/profanity. Substring matching on a curated list keeps false
 *   positives low while catching the obvious cases. Extend BLOCKLIST as needed.
 */

export const RL_NAME_MAX = 32;
export const SQUAD_NAME_MAX = 40;
export const BIO_MAX = 160;

// Where abuse reports and data requests go. Replace before launch.
export const SUPPORT_EMAIL = "support@scoreboardrl.app";

// Map common leetspeak/look-alike characters to their letter so "n1gg3r",
// "f u c k", "$h!t" etc. normalize to the same token.
const LEET: Record<string, string> = {
  "0": "o", "1": "i", "!": "i", "|": "i", "3": "e", "4": "a", "@": "a",
  "5": "s", "$": "s", "7": "t", "8": "b", "9": "g",
};

/** Lowercase, fold leetspeak, and strip anything that isn't a-z/0-9. */
export function normalizeForModeration(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((ch) => LEET[ch] ?? ch)
    .join("")
    .replace(/[^a-z0-9]/g, "");
}

// Severe slurs + hard profanity. Kept deliberately small; matched as
// substrings of the normalized string. (This is a basic guard, not exhaustive.)
const BLOCKLIST = [
  "nigger", "nigga", "faggot", "fag", "retard", "kike", "spic", "chink",
  "coon", "cunt", "rape", "rapist", "tranny",
  "fuck", "shit", "bitch", "asshole", "dick", "pussy", "whore", "slut",
];

/** True if the text contains a blocked term after normalization. */
export function containsProfanity(input: string): boolean {
  const normalized = normalizeForModeration(input);
  if (!normalized) return false;
  return BLOCKLIST.some((bad) => normalized.includes(bad));
}

export type ModerationResult = { ok: true } | { ok: false; message: string };

/**
 * Validate a piece of user-facing text: non-empty (optional), within maxLen,
 * and free of blocked terms. Returns a user-friendly message on failure.
 */
export function validateUserText(
  input: string,
  opts: { label: string; maxLen: number; required?: boolean }
): ModerationResult {
  const trimmed = input.trim();
  if (opts.required && !trimmed) {
    return { ok: false, message: `${opts.label} is required.` };
  }
  if (trimmed.length > opts.maxLen) {
    return { ok: false, message: `${opts.label} must be ${opts.maxLen} characters or fewer.` };
  }
  if (containsProfanity(trimmed)) {
    return { ok: false, message: `Please choose a different ${opts.label.toLowerCase()} — that one isn't allowed.` };
  }
  return { ok: true };
}

/** Build a prefilled mailto: URL for reporting a profile to support. */
export function buildReportMailto(profileUrl: string, displayName: string): string {
  const subject = encodeURIComponent("Report a ScoreboardRL profile");
  const body = encodeURIComponent(
    `I'd like to report the following profile:\n\n` +
      `Profile: ${displayName}\n` +
      `URL: ${profileUrl}\n\n` +
      `Reason (please describe):\n`
  );
  return `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
}
