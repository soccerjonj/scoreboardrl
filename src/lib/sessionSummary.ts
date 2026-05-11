/**
 * Pure stat aggregation for the home-tab Session Summary recap.
 *
 * Given the contiguous block of games that constitute the current session
 * (from `getSessionGames`), the viewer's `PlayerMatchTarget`, and an
 * optional friend-profile map, build the typed object the recap UI renders.
 * No fetches, no React, no Supabase — keep it cheap and testable.
 */

import type { Database } from "@/integrations/supabase/types";
import { findPlayer, matchesTarget, type PlayerMatchTarget } from "@/lib/playerMatch";

type GameRow = Database["public"]["Tables"]["games"]["Row"];
type GamePlayerRow = Database["public"]["Tables"]["game_players"]["Row"];
export type SessionGame = GameRow & { game_players: GamePlayerRow[] };

export type SessionResult = "win" | "loss";

export interface SessionGameMoment {
  gameId: string;
  gameMode: string;
  gameType: string;
  tournamentType: string | null;
  result: SessionResult;
  playedAt: string;
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  isMvp: boolean;
  contributionScore: number;
  teamGoalsFor: number;
  teamGoalsAgainst: number;
}

export interface SessionFriendChemistry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  gamesTogether: number;
  wins: number;
  losses: number;
  winRate: number;
  contributionAvg: number;
  teamSize: number;
  goals: number;
  assists: number;
  saves: number;
  mvps: number;
}

export interface SessionSummary {
  games: number;
  wins: number;
  losses: number;
  winRate: number;
  firstGameAt: string;
  lastGameAt: string;
  durationMs: number;
  /** Oldest → newest, used for the W/L dot history. */
  results: SessionResult[];

  totals: {
    score: number;
    goals: number;
    assists: number;
    saves: number;
    shots: number;
    mvps: number;
    teamGoalsFor: number;
    teamGoalsAgainst: number;
  };
  averages: {
    scorePerGame: number;
    goalsPerGame: number;
    assistsPerGame: number;
    savesPerGame: number;
    shotsPerGame: number;
    mvpRate: number;          // 0..100
    shootingPct: number;      // 0..100
    contributionAvg: number;  // normalized (% share)
  };

  byMode: Array<{
    key: string;
    modeLabel: string;
    categoryLabel: string;
    games: number;
    wins: number;
    losses: number;
    winRate: number;
    results: SessionResult[];
  }>;

  best: SessionGameMoment | null;
  worst: SessionGameMoment | null;

  friends: SessionFriendChemistry[];

  badges: {
    bestStreak: number;
    mvpCount: number;
    hatTrickGames: number;       // games where viewer scored ≥3
    wallGames: number;           // games where viewer ≥5 saves
    sniperShootingPct: number | null; // only set when overall session % ≥ 70
  };
}

export interface FriendProfileInfo {
  displayName: string;
  avatarUrl: string | null;
}

const safeNum = (n: number | null | undefined) =>
  typeof n === "number" && !Number.isNaN(n) ? n : 0;

const teamSizeFor = (gameMode: string): number => {
  if (gameMode === "1v1") return 1;
  if (gameMode === "2v2" || gameMode === "hoops_2v2" || gameMode === "heatseeker_2v2") return 2;
  if (gameMode === "4v4") return 4;
  return 3; // 3v3 + extras
};

const MODE_DISPLAY: Record<string, string> = {
  "1v1": "1v1",
  "2v2": "2v2",
  "3v3": "3v3",
  "4v4": "4v4",
  rumble_3v3: "3v3 Rumble",
  hoops_2v2: "2v2 Hoops",
  snowday_3v3: "3v3 Snow Day",
  dropshot_3v3: "3v3 Dropshot",
  heatseeker_2v2: "2v2 Heatseeker",
};

const CATEGORY_SHORT: Record<string, string> = {
  competitive: "Comp",
  tournament: "Tourny",
  casual: "Casual",
  extra_mode: "Extra",
  special_tournament: "Sp. Tourny",
};

const getCategoryShort = (gameType: string, gameMode: string, tournamentType: string | null) => {
  const STANDARD = ["1v1", "2v2", "3v3"];
  if (gameType === "tournament") {
    if (tournamentType === "soccar" && (gameMode === "2v2" || gameMode === "3v3"))
      return CATEGORY_SHORT.tournament;
    return CATEGORY_SHORT.special_tournament;
  }
  if (gameType === "competitive")
    return STANDARD.includes(gameMode) ? CATEGORY_SHORT.competitive : CATEGORY_SHORT.extra_mode;
  return CATEGORY_SHORT.casual;
};

export function buildSessionSummary(
  games: SessionGame[],
  userTarget: PlayerMatchTarget,
  friendProfiles: Map<string, FriendProfileInfo> = new Map()
): SessionSummary {
  // Sort oldest → newest so result history reads naturally
  const sortedAsc = [...games].sort(
    (a, b) => new Date(a.played_at).getTime() - new Date(b.played_at).getTime()
  );

  const totals = {
    score: 0,
    goals: 0,
    assists: 0,
    saves: 0,
    shots: 0,
    mvps: 0,
    teamGoalsFor: 0,
    teamGoalsAgainst: 0,
  };

  const results: SessionResult[] = [];
  const moments: SessionGameMoment[] = [];

  // Per-friend accumulator (keyed by friend user_id)
  type FriendAcc = {
    userId: string;
    gamesTogether: number;
    wins: number;
    losses: number;
    contribTotal: number;
    contribCount: number;
    teamSizeSum: number;
    goals: number;
    assists: number;
    saves: number;
    mvps: number;
  };
  const friendAcc = new Map<string, FriendAcc>();

  // Per-mode accumulator
  type ModeAcc = {
    key: string;
    gameMode: string;
    gameType: string;
    tournamentType: string | null;
    games: number;
    wins: number;
    losses: number;
    results: SessionResult[];
  };
  const modeAcc = new Map<string, ModeAcc>();

  let bestMoment: SessionGameMoment | null = null;
  let worstMoment: SessionGameMoment | null = null;
  let contribTotal = 0;
  let contribCount = 0;

  let hatTrickGames = 0;
  let wallGames = 0;

  for (const game of sortedAsc) {
    const players = game.game_players ?? [];
    const userRow = findPlayer(players, userTarget);
    if (!userRow) continue; // viewer not in this game — skip

    const result: SessionResult = game.result === "win" ? "win" : "loss";
    results.push(result);

    const userTeam = userRow.team;
    const teamSize = teamSizeFor(game.game_mode);

    const teamGoalsFor = userTeam
      ? players.filter((p) => p.team === userTeam).reduce((s, p) => s + safeNum(p.goals), 0)
      : 0;
    const teamGoalsAgainst = userTeam
      ? players.filter((p) => p.team !== userTeam && p.team != null).reduce((s, p) => s + safeNum(p.goals), 0)
      : 0;

    const score   = safeNum(userRow.score);
    const goals   = safeNum(userRow.goals);
    const assists = safeNum(userRow.assists);
    const saves   = safeNum(userRow.saves);
    const shots   = safeNum(userRow.shots);
    const isMvp   = !!userRow.is_mvp;
    const cs      = safeNum(userRow.contribution_score);

    totals.score   += score;
    totals.goals   += goals;
    totals.assists += assists;
    totals.saves   += saves;
    totals.shots   += shots;
    if (isMvp) totals.mvps += 1;
    totals.teamGoalsFor     += teamGoalsFor;
    totals.teamGoalsAgainst += teamGoalsAgainst;

    if (cs > 0) {
      // Normalize to "% share of equal-contribution" (matches CarryMeter math)
      contribTotal += cs * teamSize;
      contribCount += 1;
    }

    if (goals >= 3) hatTrickGames += 1;
    if (saves >= 5) wallGames += 1;

    const moment: SessionGameMoment = {
      gameId: game.id,
      gameMode: game.game_mode,
      gameType: game.game_type,
      tournamentType: (game as any).tournament_type ?? null,
      result,
      playedAt: game.played_at,
      score, goals, assists, saves, shots,
      isMvp,
      contributionScore: cs,
      teamGoalsFor,
      teamGoalsAgainst,
    };
    moments.push(moment);

    // Best = highest cs (fallback score). Worst = lowest cs (fallback score).
    const rank = (m: SessionGameMoment) =>
      m.contributionScore > 0 ? m.contributionScore : m.score / 100;
    if (!bestMoment  || rank(moment) > rank(bestMoment))  bestMoment  = moment;
    if (!worstMoment || rank(moment) < rank(worstMoment)) worstMoment = moment;

    // Mode breakdown
    const modeKey = `${game.game_mode}__${game.game_type}__${(game as any).tournament_type ?? ""}`;
    let modeRow = modeAcc.get(modeKey);
    if (!modeRow) {
      modeRow = {
        key: modeKey,
        gameMode: game.game_mode,
        gameType: game.game_type,
        tournamentType: (game as any).tournament_type ?? null,
        games: 0, wins: 0, losses: 0,
        results: [],
      };
      modeAcc.set(modeKey, modeRow);
    }
    modeRow.games += 1;
    modeRow.results.push(result);
    if (result === "win") modeRow.wins += 1;
    else modeRow.losses += 1;

    // Friend chemistry — only count friends ON the viewer's team
    if (userTeam) {
      for (const p of players) {
        if (!p.user_id) continue;
        if (matchesTarget(p, userTarget)) continue;          // skip self
        if (p.team !== userTeam) continue;                   // same team only
        if (!friendProfiles.has(p.user_id)) continue;        // accepted friends only

        let acc = friendAcc.get(p.user_id);
        if (!acc) {
          acc = {
            userId: p.user_id,
            gamesTogether: 0,
            wins: 0,
            losses: 0,
            contribTotal: 0,
            contribCount: 0,
            teamSizeSum: 0,
            goals: 0,
            assists: 0,
            saves: 0,
            mvps: 0,
          };
          friendAcc.set(p.user_id, acc);
        }
        acc.gamesTogether += 1;
        if (result === "win") acc.wins += 1;
        else acc.losses += 1;
        acc.teamSizeSum += teamSize;
        const pcs = safeNum(p.contribution_score);
        if (pcs > 0) {
          acc.contribTotal += pcs * teamSize;
          acc.contribCount += 1;
        }
        acc.goals   += safeNum(p.goals);
        acc.assists += safeNum(p.assists);
        acc.saves   += safeNum(p.saves);
        if (p.is_mvp) acc.mvps += 1;
      }
    }
  }

  const gamesCount = moments.length;
  const wins   = results.filter((r) => r === "win").length;
  const losses = gamesCount - wins;

  // Longest streak of any single result (W or L)
  let bestStreak = 0;
  let cur = 0;
  let prev: SessionResult | null = null;
  for (const r of results) {
    if (r === prev) cur += 1;
    else { cur = 1; prev = r; }
    if (cur > bestStreak) bestStreak = cur;
  }

  const avg = (n: number) => (gamesCount ? n / gamesCount : 0);
  const shootingPct = totals.shots ? (totals.goals / totals.shots) * 100 : 0;
  const contributionAvg = contribCount ? contribTotal / contribCount : 0;

  const friends: SessionFriendChemistry[] = Array.from(friendAcc.values())
    .map((f) => {
      const prof = friendProfiles.get(f.userId);
      return {
        userId: f.userId,
        displayName: prof?.displayName ?? "Friend",
        avatarUrl: prof?.avatarUrl ?? null,
        gamesTogether: f.gamesTogether,
        wins: f.wins,
        losses: f.losses,
        winRate: f.gamesTogether ? (f.wins / f.gamesTogether) * 100 : 0,
        contributionAvg: f.contribCount ? f.contribTotal / f.contribCount : 0,
        teamSize: f.gamesTogether ? Math.round(f.teamSizeSum / f.gamesTogether) : 3,
        goals: f.goals,
        assists: f.assists,
        saves: f.saves,
        mvps: f.mvps,
      };
    })
    .sort((a, b) => {
      if (b.gamesTogether !== a.gamesTogether) return b.gamesTogether - a.gamesTogether;
      return b.winRate - a.winRate;
    });

  const byMode = Array.from(modeAcc.values())
    .map((m) => ({
      key: m.key,
      modeLabel: MODE_DISPLAY[m.gameMode] ?? m.gameMode,
      categoryLabel: getCategoryShort(m.gameType, m.gameMode, m.tournamentType),
      games: m.games,
      wins: m.wins,
      losses: m.losses,
      winRate: m.games ? (m.wins / m.games) * 100 : 0,
      results: m.results,
    }))
    .sort((a, b) => b.games - a.games);

  const firstGameAt = sortedAsc[0]?.played_at ?? new Date().toISOString();
  const lastGameAt  = sortedAsc[sortedAsc.length - 1]?.played_at ?? firstGameAt;
  const durationMs =
    new Date(lastGameAt).getTime() - new Date(firstGameAt).getTime();

  return {
    games: gamesCount,
    wins,
    losses,
    winRate: gamesCount ? (wins / gamesCount) * 100 : 0,
    firstGameAt,
    lastGameAt,
    durationMs,
    results,
    totals,
    averages: {
      scorePerGame:   avg(totals.score),
      goalsPerGame:   avg(totals.goals),
      assistsPerGame: avg(totals.assists),
      savesPerGame:   avg(totals.saves),
      shotsPerGame:   avg(totals.shots),
      mvpRate:        gamesCount ? (totals.mvps / gamesCount) * 100 : 0,
      shootingPct,
      contributionAvg,
    },
    byMode,
    best: bestMoment,
    worst: worstMoment,
    friends,
    badges: {
      bestStreak,
      mvpCount: totals.mvps,
      hatTrickGames,
      wallGames,
      sniperShootingPct: shootingPct >= 70 && totals.shots >= 5 ? shootingPct : null,
    },
  };
}

/** Format an elapsed duration as "2h 47m" / "47m" / "0m". */
export function formatSessionDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Build a chat-pasteable text summary (used by the Copy fallback). */
export function buildSessionSummaryText(s: SessionSummary, rlName: string | null): string {
  const lines: string[] = [];
  lines.push(`ScoreboardRL session · ${formatSessionDuration(s.durationMs)} · ${s.games} game${s.games === 1 ? "" : "s"}`);
  lines.push(
    `${s.wins}W-${s.losses}L · ${Math.round(s.winRate)}% · ` +
    `${s.totals.goals}G ${s.totals.assists}A ${s.totals.saves}SV · ${s.totals.mvps} MVP${s.totals.mvps === 1 ? "" : "s"}`
  );
  if (s.friends.length > 0) {
    const friendStr = s.friends
      .slice(0, 3)
      .map((f) => `${f.displayName} (${f.wins}-${f.losses})`)
      .join(", ");
    lines.push(`Played with ${friendStr}`);
  }
  if (rlName) lines.push(`— ${rlName}`);
  return lines.join("\n");
}
