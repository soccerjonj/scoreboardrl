import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, ChevronDown, ChevronUp, Loader2, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ROUND_LABELS, ROUND_ORDER, TOURNAMENT_TYPE_LABELS, type RoundKey } from "@/hooks/useTournamentSession";
import BracketTree, { type RoundResult } from "@/components/tournament/BracketTree";
import { CarryMeter } from "@/components/game/CarryMeter";
import { relativeDate } from "@/lib/relativeDate";
import { cn } from "@/lib/utils";

export type RecentTournament = {
  id: string;
  game_mode: string;
  tournament_type: string;
  status: string;
  outcome: string | null;
  current_round: string;
  created_at: string;
};

type GamePlayer = {
  id: string;
  player_name: string;
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  team: string | null;
  is_mvp: boolean;
  user_id: string | null;
  contribution_score: number | null;
};

type GameResult = {
  id: string;
  result: string;
  played_at: string;
  game_mode: string;
  game_players: GamePlayer[];
};

type TournamentGame = {
  id: string;
  game_id: string;
  round: string;
  game_number: number;
  tournament_id: string;
};

type Props = {
  tournaments: RecentTournament[];
  /** The profile owner's user_id — used to center team-stats on their team. */
  profileUserId: string;
  isOwnProfile: boolean;
};

/**
 * Recent Tournaments feed — mirrors the Recent Games card layout but for
 * tournaments. Each entry is expandable inline (bracket, team stats,
 * per-game scoreboards) so users stay on the profile they're viewing.
 *
 * For the deep-link entry point (the "View full tournament stats" button
 * on recent games), navigation still goes to /stats?view=tournaments where
 * the dedicated panel lives.
 */
export default function RecentTournaments({ tournaments, profileUserId, isOwnProfile }: Props) {
  const [showAll, setShowAll] = useState(false);

  if (tournaments.length === 0) {
    if (!isOwnProfile) return null;
    return (
      <Card className="border-border/50 bg-card/80 border-dashed">
        <CardContent className="pt-4 pb-3 text-center space-y-1.5">
          <Trophy className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No tournaments yet</p>
          <Link to="/tournaments" className="text-xs text-primary hover:underline">
            Start a tournament →
          </Link>
        </CardContent>
      </Card>
    );
  }

  const wins = tournaments.filter((t) => t.outcome === "winner").length;
  const visible = showAll ? tournaments : tournaments.slice(0, 5);

  return (
    <div className="space-y-1.5">
      <div className="px-0.5 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-yellow-400" />
          Tournaments
        </p>
        <p className="text-[10px] text-muted-foreground font-mono">
          {tournaments.length} entered
          {wins > 0 && <span className="text-yellow-400 font-bold"> · {wins} {wins === 1 ? "win" : "wins"}</span>}
        </p>
      </div>

      <div className="space-y-2">
        {visible.map((t) => (
          <TournamentRow key={t.id} tournament={t} profileUserId={profileUserId} />
        ))}
      </div>

      {tournaments.length > 5 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          {showAll ? "Show less" : `Show ${tournaments.length - 5} more`}
        </button>
      )}
    </div>
  );
}

function TournamentRow({ tournament, profileUserId }: { tournament: RecentTournament; profileUserId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [games, setGames] = useState<GameResult[]>([]);
  const [tgRows, setTgRows] = useState<TournamentGame[]>([]);
  const [bracketRounds, setBracketRounds] = useState<RoundResult[]>([]);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);

  const isWinner = tournament.outcome === "winner";
  const isEliminated = tournament.outcome === "eliminated";
  const isActive = tournament.status === "active";
  const isSpecial = tournament.tournament_type !== "soccar";

  const roundIdx = ROUND_ORDER.indexOf(tournament.current_round as RoundKey);
  const reachedRoundLabel = roundIdx >= 0 ? ROUND_LABELS[ROUND_ORDER[roundIdx]] : "Round 1";

  const stripeColor = isWinner
    ? "bg-gradient-to-r from-yellow-400/80 via-yellow-400/40 to-transparent"
    : isActive
      ? "bg-gradient-to-r from-primary/60 via-primary/20 to-transparent"
      : isEliminated
        ? "bg-gradient-to-r from-rl-red/60 via-rl-red/20 to-transparent"
        : "bg-gradient-to-r from-border/60 via-border/20 to-transparent";

  const cardBorder = isWinner
    ? "border-yellow-400/30"
    : isActive
      ? "border-primary/30"
      : "border-border/30";

  const barColor = isWinner
    ? "bg-yellow-400 shadow-[0_0_8px_rgb(250_204_21_/_0.6)]"
    : isActive
      ? "bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
      : isEliminated
        ? "bg-rl-red shadow-[0_0_8px_hsl(var(--rl-red)/0.6)]"
        : "bg-border";

  const typeLabel = TOURNAMENT_TYPE_LABELS[tournament.tournament_type as keyof typeof TOURNAMENT_TYPE_LABELS] ?? tournament.tournament_type;

  const loadDetail = async () => {
    if (detailLoaded) return;
    setLoadingDetail(true);
    try {
      const { data: tgData } = await supabase
        .from("tournament_games")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("created_at", { ascending: true });
      const rows = (tgData ?? []) as TournamentGame[];
      setTgRows(rows);

      if (rows.length === 0) { setDetailLoaded(true); return; }

      const { data: gamesData } = await supabase
        .from("games")
        .select("id, result, played_at, game_mode, game_players(id, player_name, score, goals, assists, saves, shots, team, is_mvp, user_id, contribution_score)")
        .in("id", rows.map((r) => r.game_id));
      const gd = (gamesData ?? []) as GameResult[];
      setGames(gd);

      // Build bracket
      const resultMap = new Map(gd.map((g) => [g.id, g.result as "win" | "loss"]));
      const roundsMap = new Map<string, RoundResult>();
      rows.forEach((tg) => {
        const res = resultMap.get(tg.game_id);
        if (!res) return;
        const existing = roundsMap.get(tg.round);
        if (existing) {
          existing.games.push({ result: res, game_number: tg.game_number });
        } else {
          roundsMap.set(tg.round, {
            round: tg.round as RoundKey,
            games: [{ result: res, game_number: tg.game_number }],
            isCurrentRound: tournament.status === "active" && tg.round === tournament.current_round,
          });
        }
      });
      setBracketRounds(Array.from(roundsMap.values()));
    } finally {
      setLoadingDetail(false);
      setDetailLoaded(true);
    }
  };

  const handleToggle = () => {
    if (!expanded) loadDetail();
    setExpanded((v) => !v);
  };

  // Aggregate the profile-owner's team stats across all logged tournament games
  const { teamTotals, teammates, totalGames, wins, teamSize } = useMemo(() => {
    const playerMap = new Map<string, {
      displayName: string;
      isSubject: boolean;
      goals: number;
      assists: number;
      saves: number;
      shots: number;
      mvps: number;
      contribTotal: number;
      contribCount: number;
      gamesCount: number;
      // Used internally for sort stability — total score is no longer surfaced in the UI
      _scoreSort: number;
    }>();
    const teamTotals = { goals: 0, assists: 0, saves: 0, shots: 0, mvps: 0 };

    games.forEach((g) => {
      const subjectRow = g.game_players.find((p) => p.user_id === profileUserId);
      if (!subjectRow || !subjectRow.team) return;
      g.game_players
        .filter((p) => p.team === subjectRow.team)
        .forEach((p) => {
          const key = p.user_id ?? p.player_name.trim().toLowerCase();
          const cs = p.contribution_score;
          const hasCs = typeof cs === "number" && !Number.isNaN(cs);
          const isMvp = !!p.is_mvp;
          const existing = playerMap.get(key);
          if (existing) {
            existing.goals   += p.goals   ?? 0;
            existing.assists += p.assists ?? 0;
            existing.saves   += p.saves   ?? 0;
            existing.shots   += p.shots   ?? 0;
            existing.mvps    += isMvp ? 1 : 0;
            existing._scoreSort += p.score ?? 0;
            existing.gamesCount += 1;
            if (hasCs) { existing.contribTotal += cs as number; existing.contribCount += 1; }
          } else {
            playerMap.set(key, {
              displayName: p.player_name,
              isSubject: p.user_id === profileUserId,
              goals:   p.goals   ?? 0,
              assists: p.assists ?? 0,
              saves:   p.saves   ?? 0,
              shots:   p.shots   ?? 0,
              mvps:    isMvp ? 1 : 0,
              _scoreSort: p.score ?? 0,
              contribTotal: hasCs ? (cs as number) : 0,
              contribCount: hasCs ? 1 : 0,
              gamesCount: 1,
            });
          }
          teamTotals.goals   += p.goals   ?? 0;
          teamTotals.assists += p.assists ?? 0;
          teamTotals.saves   += p.saves   ?? 0;
          teamTotals.shots   += p.shots   ?? 0;
          if (isMvp) teamTotals.mvps += 1;
        });
    });

    const teammates = Array.from(playerMap.values()).sort((a, b) => {
      if (a.isSubject !== b.isSubject) return a.isSubject ? -1 : 1;
      return b._scoreSort - a._scoreSort;
    });
    const totalGames = games.length;
    const wins = games.filter((g) => g.result === "win").length;
    const mode = tournament.game_mode;
    const teamSize = mode === "1v1" ? 1 : mode === "2v2" ? 2 : 3;
    return { teamTotals, teammates, totalGames, wins, teamSize };
  }, [games, profileUserId, tournament.game_mode]);

  return (
    <Card className={cn("overflow-hidden transition-colors", cardBorder, expanded && "ring-1 ring-primary/20")}>
      <div className={cn("h-0.5 w-full", stripeColor)} />
      <button
        onClick={handleToggle}
        className="w-full text-left hover:bg-muted/10 transition-colors"
      >
        <CardContent className="py-3 px-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <span className={cn("w-1.5 h-8 rounded-full flex-shrink-0 mt-0.5", barColor)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-nowrap min-w-0 overflow-hidden mb-1">
                  <span className="font-display font-bold text-sm flex-shrink-0">
                    {tournament.game_mode} {typeLabel}
                  </span>
                  {isSpecial && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-border/50 flex-shrink-0">
                      Special
                    </Badge>
                  )}
                  {isWinner && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-yellow-400/20 text-yellow-400 border-yellow-400/30 flex-shrink-0 font-bold">
                      Champion
                    </Badge>
                  )}
                  {isActive && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary border-primary/30 animate-pulse flex-shrink-0">
                      Live
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {isWinner ? (
                    <span className="text-yellow-400/80 font-semibold">Won the final</span>
                  ) : isActive ? (
                    <span className="text-primary/80 font-semibold">In progress · {reachedRoundLabel}</span>
                  ) : isEliminated ? (
                    <span className="text-rl-red/80 font-semibold">Out in {reachedRoundLabel}</span>
                  ) : (
                    <span>{reachedRoundLabel}</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">
                    {relativeDate(tournament.created_at)}
                  </span>
                </div>
              </div>
            </div>
            {loadingDetail ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0 mt-1" />
            ) : expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground/50 shrink-0 mt-1" />
            )}
          </div>
        </CardContent>
      </button>

      {/* Expanded detail — bracket + team stats + games. Lazy-loaded on first open. */}
      {expanded && (
        <div className="border-t border-border/40 px-4 py-4 space-y-5">
          {/* Bracket */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Bracket</p>
            {bracketRounds.length > 0 ? (
              <BracketTree rounds={bracketRounds} outcome={tournament.outcome} />
            ) : !loadingDetail ? (
              <p className="text-xs text-muted-foreground">No games logged yet.</p>
            ) : null}
          </div>

          {/* Team Stats */}
          {games.length > 0 && teammates.length > 0 && (() => {
            // Outcome-themed accent for the hero banner
            const heroBg = isWinner
              ? "bg-gradient-to-br from-yellow-400/20 via-yellow-400/10 to-transparent border-yellow-400/40"
              : isEliminated
                ? "bg-gradient-to-br from-rl-red/15 via-rl-red/8 to-transparent border-rl-red/30"
                : "bg-gradient-to-br from-primary/15 via-primary/8 to-transparent border-primary/40";
            const heroAccent = isWinner ? "text-yellow-400" : isEliminated ? "text-rl-red" : "text-primary";

            return (
              <div>
                {/* ── HERO TEAM BANNER ──────────────────────────────────────── */}
                <div className={cn("relative overflow-hidden rounded-2xl border-2 p-5 mb-4", heroBg)}>
                  {/* Decorative trophy watermark */}
                  <Trophy className={cn("absolute -right-3 -top-3 w-24 h-24 opacity-[0.06]", heroAccent)} />

                  {/* Top line: Title + win/loss tally + per-game W/L history */}
                  <div className="relative flex items-end justify-between gap-3 mb-4 flex-wrap">
                    <div>
                      <p className={cn("text-[10px] uppercase tracking-[0.2em] font-bold mb-1", heroAccent)}>
                        Team Recap
                      </p>
                      <p className="font-display text-3xl font-bold leading-none">
                        <span className="text-rl-green">{wins}</span>
                        <span className="text-muted-foreground/60 mx-1.5">–</span>
                        <span className="text-rl-red">{totalGames - wins}</span>
                      </p>
                    </div>
                    {/* Per-game W/L dot history */}
                    <div className="flex items-center gap-1.5">
                      {games.map((g, i) => (
                        <span
                          key={i}
                          className={cn(
                            "w-2.5 h-2.5 rounded-full",
                            g.result === "win"
                              ? "bg-rl-green shadow-[0_0_6px_hsl(var(--rl-green)/0.5)]"
                              : "bg-rl-red shadow-[0_0_6px_hsl(var(--rl-red)/0.5)]"
                          )}
                          title={g.result === "win" ? "Win" : "Loss"}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Big stats line — horizontal split, no individual tile boxes */}
                  <div className="relative grid grid-cols-5 divide-x divide-foreground/[0.06]">
                    {[
                      { label: "Goals",   value: teamTotals.goals,   color: "text-rl-orange" },
                      { label: "Assists", value: teamTotals.assists, color: "text-rl-blue" },
                      { label: "Saves",   value: teamTotals.saves,   color: "text-cyan-400" },
                      { label: "Shots",   value: teamTotals.shots,   color: "text-muted-foreground/80" },
                      { label: "MVPs",    value: teamTotals.mvps,    color: "text-yellow-400" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex flex-col items-center justify-center px-1">
                        <span className={cn("font-display font-bold text-2xl leading-none tabular-nums", color)}>{value}</span>
                        <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground mt-1.5">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── ROSTER ────────────────────────────────────────────────── */}
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">Roster</p>
                <div className="space-y-1.5">
                  {teammates.map((p, i) => {
                    const avgContrib = p.contribCount > 0 ? p.contribTotal / p.contribCount : null;
                    return (
                      <div
                        key={i}
                        className={cn(
                          "rounded-lg border px-3 py-2.5 transition-colors",
                          p.isSubject ? "bg-primary/5 border-primary/30" : "bg-card/40 border-border/30"
                        )}
                      >
                        {/* Top row: name + games count */}
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={cn(
                              "w-1 h-5 rounded-full shrink-0",
                              p.isSubject ? "bg-primary" : "bg-border"
                            )} />
                            <span className={cn(
                              "text-sm font-display font-bold truncate",
                              p.isSubject ? "text-primary" : "text-foreground"
                            )}>
                              {p.displayName || <span className="italic text-muted-foreground">Unknown</span>}
                            </span>
                          </div>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold shrink-0">
                            {p.gamesCount}{p.gamesCount === 1 ? " game" : " games"}
                          </span>
                        </div>

                        {/* Inline horizontal stats row + avg carry */}
                        <div className="flex items-center gap-3 font-mono text-xs flex-wrap pl-3">
                          <span className="text-rl-orange tabular-nums">{p.goals}G</span>
                          <span className="text-rl-blue tabular-nums">{p.assists}A</span>
                          <span className="text-cyan-400 tabular-nums">{p.saves}SV</span>
                          <span className="text-muted-foreground tabular-nums">{p.shots}SH</span>
                          {p.mvps > 0 && (
                            <span className="text-yellow-400 font-bold tabular-nums">{p.mvps} MVP</span>
                          )}
                          {avgContrib !== null && teamSize > 1 && (
                            <div className="ml-auto flex items-center gap-1.5 min-w-0">
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 shrink-0">Carry</span>
                              <div className="w-16 shrink-0">
                                <CarryMeter score={avgContrib} teamSize={teamSize} size="sm" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Games list */}
          {games.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Games</p>
              <div className="space-y-2">
                {games.map((g) => {
                  const tgRow = tgRows.find((r) => r.game_id === g.id);
                  const roundLabel = tgRow ? (ROUND_LABELS[tgRow.round as RoundKey] ?? tgRow.round) : "";
                  const isWin = g.result === "win";
                  const isGameExpanded = expandedGameId === g.id;
                  const subjectRow = g.game_players.find((p) => p.user_id === profileUserId);
                  const subjectTeam = subjectRow?.team ?? null;
                  const myTeamPlayers = subjectTeam ? g.game_players.filter((p) => p.team === subjectTeam).sort((a, b) => b.score - a.score) : [];
                  const opponentPlayers = subjectTeam ? g.game_players.filter((p) => p.team !== subjectTeam).sort((a, b) => b.score - a.score) : [];
                  const groups = subjectTeam
                    ? [
                        { label: isWin ? "Team · WIN" : "Team · LOSS", isMyTeam: true, players: myTeamPlayers },
                        { label: isWin ? "Opponents · LOSS" : "Opponents · WIN", isMyTeam: false, players: opponentPlayers },
                      ]
                    : [{ label: "", isMyTeam: false, players: [...g.game_players].sort((a, b) => b.score - a.score) }];

                  return (
                    <div key={g.id} className="rounded-lg border border-border/30 overflow-hidden">
                      <button
                        onClick={() => setExpandedGameId(isGameExpanded ? null : g.id)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5 py-0 font-bold",
                              isWin ? "text-rl-green border-rl-green/30" : "text-rl-red border-rl-red/30"
                            )}
                          >
                            {isWin ? "WIN" : "LOSS"}
                          </Badge>
                          {roundLabel && <span className="text-xs text-muted-foreground">{roundLabel}</span>}
                        </div>
                        {isGameExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                      </button>
                      {isGameExpanded && (
                        <div className="border-t border-border/20 px-2 pb-2 pt-2">
                          <div className="grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_2rem] gap-x-1 px-2 pb-1.5 mb-0.5 border-b border-border/20">
                            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Player</span>
                            <span className="text-[9px] text-muted-foreground font-semibold text-right">Score</span>
                            <span className="text-[9px] text-muted-foreground font-semibold text-right">G</span>
                            <span className="text-[9px] text-muted-foreground font-semibold text-right">A</span>
                            <span className="text-[9px] text-muted-foreground font-semibold text-right">SV</span>
                            <span className="text-[9px] text-muted-foreground font-semibold text-right">SH</span>
                          </div>
                          {groups.map((group, gi) => (
                            <div key={gi} className="mb-1">
                              {group.label && (
                                <p className={cn("text-[10px] font-bold uppercase tracking-wider mt-1.5 mb-0.5 px-2", group.isMyTeam ? "text-primary/80" : "text-muted-foreground")}>
                                  {group.label}
                                </p>
                              )}
                              {group.players.map((p) => {
                                const isSubject = p.user_id === profileUserId;
                                const cs = p.contribution_score;
                                const showMeter = typeof cs === "number" && cs > 0 && teamSize > 1;
                                return (
                                  <div
                                    key={p.id}
                                    className={cn(
                                      "grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_2rem] gap-x-1 px-2 py-1.5 items-start text-xs rounded-md",
                                      isSubject && "bg-primary/5"
                                    )}
                                  >
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                      <div className="flex items-start gap-1.5 flex-wrap">
                                        <span className={cn("text-xs font-medium leading-snug break-words", isSubject ? "text-primary font-semibold" : "text-foreground")}>
                                          {p.player_name || "—"}
                                        </span>
                                        {p.is_mvp && <span className="shrink-0 text-[9px] text-yellow-400 font-bold leading-snug">MVP</span>}
                                      </div>
                                      {showMeter && <CarryMeter score={cs as number} teamSize={teamSize} size="sm" />}
                                    </div>
                                    <span className={cn("font-mono font-bold text-right leading-snug", isSubject ? "text-foreground" : "text-foreground/80")}>{p.score}</span>
                                    <span className="font-mono text-muted-foreground text-right leading-snug">{p.goals}</span>
                                    <span className="font-mono text-muted-foreground text-right leading-snug">{p.assists}</span>
                                    <span className="font-mono text-muted-foreground text-right leading-snug">{p.saves}</span>
                                    <span className="font-mono text-muted-foreground text-right leading-snug">{p.shots}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
