import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Trophy, ChevronDown, ChevronUp, Loader2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BracketTree, { RoundResult } from "@/components/tournament/BracketTree";
import { CarryMeter } from "@/components/game/CarryMeter";
import { ROUND_LABELS, ROUND_ORDER, TOURNAMENT_TYPE_LABELS, RoundKey } from "@/hooks/useTournamentSession";
import { cn } from "@/lib/utils";

type Tournament = {
  id: string;
  game_mode: string;
  tournament_type: string;
  status: string;
  outcome: string | null;
  current_round: string;
  created_at: string;
};

type TournamentGame = {
  id: string;
  tournament_id: string;
  game_id: string;
  round: string;
  game_number: number;
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

function highestRound(rounds: RoundResult[]): string {
  for (let i = ROUND_ORDER.length - 1; i >= 0; i--) {
    if (rounds.find((r) => r.round === ROUND_ORDER[i])) {
      return ROUND_LABELS[ROUND_ORDER[i]];
    }
  }
  return "Round 1";
}

function TournamentCard({ tournament, userId, autoExpand = false }: { tournament: Tournament; userId: string; autoExpand?: boolean }) {
  const [expanded, setExpanded] = useState(autoExpand);
  const [bracketRounds, setBracketRounds] = useState<RoundResult[]>([]);
  const [games, setGames] = useState<GameResult[]>([]);
  const [tgRows, setTgRows] = useState<TournamentGame[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<{ name: string; avatarUrl: string | null } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Auto-expand + scroll into view when this card is the deep-link target
  useEffect(() => {
    if (autoExpand) {
      setExpanded(true);
      loadDetail();
      requestAnimationFrame(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoExpand]);

  // Load the tournament owner's display name + avatar so the card is
  // self-explanatory when viewing someone else's tournament socially.
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("profiles")
      .select("user_id, username, rl_account_name, avatar_url")
      .eq("user_id", tournament.user_id)
      .single()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const d = data as any;
        setOwnerProfile({
          name: d.rl_account_name ?? d.username ?? "Unknown",
          avatarUrl: d.avatar_url ?? null,
        });
      });
    return () => { cancelled = true; };
  }, [tournament.user_id]);

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
      const gameIds = rows.map((r) => r.game_id);

      if (gameIds.length === 0) {
        setTgRows(rows);
        setDetailLoaded(true);
        return;
      }

      const { data: gamesData } = await supabase
        .from("games")
        .select("id, result, played_at, game_mode, game_players(id, player_name, score, goals, assists, saves, shots, team, is_mvp, user_id, contribution_score)")
        .in("id", gameIds);

      const gd = (gamesData ?? []) as GameResult[];
      const resultMap = new Map(gd.map((g) => [g.id, g.result as "win" | "loss"]));

      // Build bracket rounds
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

      setTgRows(rows);
      setGames(gd);
      setBracketRounds(Array.from(roundsMap.values()));
    } finally {
      setLoadingDetail(false);
      setDetailLoaded(true);
    }
  };

  const handleToggle = () => {
    if (!expanded) loadDetail();
    setExpanded((p) => !p);
  };

  const isWinner = tournament.outcome === "winner";
  const isEliminated = tournament.outcome === "eliminated";
  const isActive = tournament.status === "active";

  const totalGames = games.length;
  const wins = games.filter((g) => g.result === "win").length;

  // Aggregate ONLY players on the user's team (same team as user in each game),
  // grouped by user_id when available, falling back to normalized name.
  const playerMap = new Map<string, {
    displayName: string;
    isUser: boolean;
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

  // Team totals (everyone on user's team combined). Total score isn't surfaced
  // anymore (it's a derived meta-metric that just sums goals/assists/saves);
  // MVPs replaces it as a more meaningful headline stat.
  const teamTotals = {
    goals: 0, assists: 0, saves: 0, shots: 0, mvps: 0,
    contribTotal: 0, contribCount: 0,
  };

  // Subject of the team stats: the viewer if they played in this tournament,
  // otherwise the tournament owner. So when you click into a friend's
  // tournament you didn't play in, you see THEIR team's stats — not empty.
  const viewerInGames = games.some((g) => g.game_players.some((p) => p.user_id === userId));
  const subjectId = viewerInGames ? userId : tournament.user_id;
  const isViewerSubject = subjectId === userId;

  games.forEach((g) => {
    // Find the subject's row in this game to determine which team is "their team"
    const subjectRow = g.game_players.find((p) => p.user_id === subjectId);
    if (!subjectRow) return; // subject not in this game's roster — skip
    const subjectTeam = subjectRow.team;
    if (!subjectTeam) return;

    // Only count players on the same team as the subject for this game
    g.game_players
      .filter((p) => p.team === subjectTeam)
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
          if (hasCs) {
            existing.contribTotal += cs as number;
            existing.contribCount += 1;
          }
        } else {
          playerMap.set(key, {
            displayName: p.player_name,
            isUser: p.user_id === subjectId,
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

        // Add to team totals
        teamTotals.goals   += p.goals   ?? 0;
        teamTotals.assists += p.assists ?? 0;
        teamTotals.saves   += p.saves   ?? 0;
        teamTotals.shots   += p.shots   ?? 0;
        if (isMvp) teamTotals.mvps += 1;
        if (hasCs) {
          teamTotals.contribTotal += cs as number;
          teamTotals.contribCount += 1;
        }
      });
  });

  // Sort: user first, then by total raw score desc (for stable ordering even
  // though we no longer surface the score)
  const aggregatedPlayers = Array.from(playerMap.values()).sort((a, b) => {
    if (a.isUser !== b.isUser) return a.isUser ? -1 : 1;
    return b._scoreSort - a._scoreSort;
  });

  // Tournament team size — derive from games (use mode count, fallback to 3)
  const teamSize = (() => {
    const firstGame = games[0];
    if (!firstGame) return 3;
    const mode = firstGame.game_mode;
    return mode === "1v1" ? 1
         : mode === "2v2" || mode === "hoops_2v2" || mode === "heatseeker_2v2" ? 2
         : mode === "4v4" ? 4
         : 3;
  })();


  return (
    <Card ref={cardRef as any} className={cn(
      "overflow-hidden transition-all scroll-mt-20",
      isWinner && "border-yellow-400/30",
      isEliminated && "border-border/40",
      isActive && "border-primary/30",
      autoExpand && "ring-2 ring-primary/30",
    )}>
      {/* Top stripe */}
      <div className={cn(
        "h-0.5 w-full",
        isWinner && "bg-gradient-to-r from-yellow-400/80 via-yellow-400/40 to-transparent",
        isEliminated && "bg-gradient-to-r from-rl-red/60 via-rl-red/20 to-transparent",
        isActive && "bg-gradient-to-r from-primary/60 via-primary/20 to-transparent",
      )} />

      <CardContent className="py-3 px-4">
        <button onClick={handleToggle} className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className={cn(
              "w-4 h-4 shrink-0",
              isWinner ? "text-yellow-400" : isActive ? "text-primary" : "text-muted-foreground"
            )} />
            <div className="text-left min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display font-bold text-sm">
                  {tournament.game_mode} {TOURNAMENT_TYPE_LABELS[tournament.tournament_type as keyof typeof TOURNAMENT_TYPE_LABELS] ?? tournament.tournament_type}
                </span>
                {tournament.tournament_type !== "soccar" && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-border/50">
                    Special
                  </Badge>
                )}
                {isWinner && (
                  <Badge className="text-[10px] px-1.5 py-0 bg-yellow-400/20 text-yellow-400 border-yellow-400/30">
                    Champion
                  </Badge>
                )}
                {isEliminated && bracketRounds.length > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-rl-red border-rl-red/30">
                    Out · {highestRound(bracketRounds)}
                  </Badge>
                )}
                {isActive && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-primary border-primary/30 animate-pulse">
                    Live
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                {!isViewerSubject && ownerProfile && (
                  <>
                    <span className="inline-flex items-center gap-1 text-foreground/80">
                      {ownerProfile.avatarUrl ? (
                        <img src={ownerProfile.avatarUrl} alt="" className="w-3.5 h-3.5 rounded-full object-cover" />
                      ) : (
                        <User className="w-3 h-3" />
                      )}
                      <span className="font-medium">{ownerProfile.name}</span>
                    </span>
                    <span className="text-muted-foreground/50">·</span>
                  </>
                )}
                <span>{format(new Date(tournament.created_at), "MMM d, yyyy")}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {totalGames > 0 && (
              <span className="text-xs text-muted-foreground font-mono">{wins}/{totalGames}</span>
            )}
            {loadingDetail ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </button>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-4 space-y-5">

            {/* Section 1 — Bracket */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Bracket</p>
              {bracketRounds.length > 0 ? (
                <BracketTree rounds={bracketRounds} outcome={tournament.outcome} />
              ) : (
                <p className="text-xs text-muted-foreground">No games logged yet.</p>
              )}
            </div>

            {/* Section 2 — Team Stats */}
            {games.length > 0 && aggregatedPlayers.length > 0 && (() => {
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
                          {isViewerSubject ? "Team Recap" : `${ownerProfile?.name ?? "Their"} Team Recap`}
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

                    {/* Big stats line — horizontal split, scoreboard-style */}
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
                    {aggregatedPlayers.map((p, i) => {
                      const avgContrib = p.contribCount > 0 ? p.contribTotal / p.contribCount : null;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "rounded-lg border px-3 py-2.5 transition-colors",
                            p.isUser ? "bg-primary/5 border-primary/30" : "bg-card/40 border-border/30"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={cn(
                                "w-1 h-5 rounded-full shrink-0",
                                p.isUser ? "bg-primary" : "bg-border"
                              )} />
                              <span className={cn(
                                "text-sm font-display font-bold truncate",
                                p.isUser ? "text-primary" : "text-foreground"
                              )}>
                                {p.displayName || <span className="italic text-muted-foreground">Unknown</span>}
                              </span>
                              {p.isUser && isViewerSubject && (
                                <span className="text-[9px] uppercase tracking-wider text-primary/70 font-bold shrink-0">You</span>
                              )}
                            </div>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold shrink-0">
                              {p.gamesCount}{p.gamesCount === 1 ? " game" : " games"}
                            </span>
                          </div>

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

            {/* Section 3 — Games */}
            {games.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Games</p>
                <div className="space-y-2">
                  {games.map((g) => {
                    const tgRow = tgRows.find((r) => r.game_id === g.id);
                    const roundLabel = tgRow ? (ROUND_LABELS[tgRow.round as RoundKey] ?? tgRow.round) : "";
                    const isWin = g.result === "win";
                    const isExpanded = expandedGameId === g.id;

                    // Determine the SUBJECT's team in this game so we can group as Their Team / Opponents
                    const subjectRow = g.game_players.find((p) => p.user_id === subjectId);
                    const subjectTeam = subjectRow?.team ?? null;
                    const myTeamLabel = isViewerSubject ? "Your Team" : `${ownerProfile?.name ?? "Owner"}'s Team`;
                    const myTeamPlayers = subjectTeam ? g.game_players.filter((p) => p.team === subjectTeam).sort((a, b) => b.score - a.score) : [];
                    const opponentPlayers = subjectTeam ? g.game_players.filter((p) => p.team !== subjectTeam).sort((a, b) => b.score - a.score) : [];
                    const groups = subjectTeam
                      ? [
                          { label: isWin ? `${myTeamLabel}  ·  WIN` : `${myTeamLabel}  ·  LOSS`, isMyTeam: true,  players: myTeamPlayers },
                          { label: isWin ? "Opponents  ·  LOSS" : "Opponents  ·  WIN", isMyTeam: false, players: opponentPlayers },
                        ]
                      : [{ label: "", isMyTeam: false, players: [...g.game_players].sort((a, b) => b.score - a.score) }];

                    return (
                      <div key={g.id} className="rounded-lg border border-border/30 overflow-hidden">
                        <button
                          onClick={() => setExpandedGameId(isExpanded ? null : g.id)}
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
                            {roundLabel && (
                              <span className="text-xs text-muted-foreground">{roundLabel}</span>
                            )}
                            <span className="text-xs text-muted-foreground/60">
                              {format(new Date(g.played_at), "h:mm a")}
                            </span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="border-t border-border/20 px-2 pb-2 pt-2">
                            {/* Column headers — match ActivityFeed scoreboard layout */}
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
                                  <p className={cn(
                                    "text-[10px] font-bold uppercase tracking-wider mt-1.5 mb-0.5 px-2",
                                    group.isMyTeam ? "text-primary/80" : "text-muted-foreground"
                                  )}>
                                    {group.label}
                                  </p>
                                )}
                                {group.players.map((p) => {
                                  const isMe = p.user_id === subjectId;
                                  const cs = p.contribution_score;
                                  const showMeter = typeof cs === "number" && cs > 0 && teamSize > 1;
                                  return (
                                    <div
                                      key={p.id}
                                      className={cn(
                                        "grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_2rem] gap-x-1 px-2 py-1.5 items-start text-xs rounded-md",
                                        isMe ? "bg-primary/5" : ""
                                      )}
                                    >
                                      <div className="flex flex-col gap-0.5 min-w-0">
                                        <div className="flex items-start gap-1.5 flex-wrap">
                                          <span className={cn(
                                            "text-xs font-medium leading-snug break-words",
                                            isMe ? "text-primary font-semibold" : "text-foreground"
                                          )}>
                                            {p.player_name || "—"}
                                          </span>
                                          {p.is_mvp && (
                                            <span className="shrink-0 text-[9px] text-yellow-400 font-bold leading-snug">MVP</span>
                                          )}
                                        </div>
                                        {showMeter && (
                                          <CarryMeter score={cs as number} teamSize={teamSize} size="sm" />
                                        )}
                                      </div>
                                      <span className={cn("font-mono font-bold text-right leading-snug", isMe ? "text-foreground" : "text-foreground/80")}>{p.score}</span>
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
      </CardContent>
    </Card>
  );
}

export default function TournamentHistoryPanel({
  userId,
  focusTournamentId,
}: {
  userId: string;
  focusTournamentId?: string | null;
}) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      // Tournaments where I'm a participant (owner or partner)
      let rows: Tournament[] = [];

      const { data: participantRows, error: participantErr } = await supabase
        .from("tournament_participants")
        .select("tournaments!inner(*)")
        .eq("user_id", userId)
        .in("status", ["joined"]);

      const seen = new Set<string>();
      if (!participantErr && participantRows) {
        rows = (participantRows as any[])
          .map((r) => r.tournaments as Tournament)
          .filter((t) => t && !seen.has(t.id) && (seen.add(t.id), true));
      }

      // Defensive: tournaments where I'm the owner (covers rows missing a
      // participant entry from the backfill)
      const { data: ownerRows } = await supabase
        .from("tournaments")
        .select("*")
        .eq("user_id", userId);
      if (ownerRows) {
        for (const r of ownerRows as Tournament[]) {
          if (!seen.has(r.id)) { seen.add(r.id); rows.push(r); }
        }
      }

      // If a deep-link points at a tournament I'm not in, fetch it directly.
      // RLS allows any authenticated user to SELECT tournaments, so this
      // succeeds for friends' tournaments too — enabling the social view.
      if (focusTournamentId && !seen.has(focusTournamentId)) {
        const { data: t } = await supabase
          .from("tournaments")
          .select("*")
          .eq("id", focusTournamentId)
          .single();
        if (t) rows.push(t as Tournament);
      }

      // Sort newest first, but pin the focused tournament to the top
      rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      if (focusTournamentId) {
        rows.sort((a, b) => (a.id === focusTournamentId ? -1 : b.id === focusTournamentId ? 1 : 0));
      }

      setTournaments(rows);
      setLoading(false);
    })();
  }, [userId, focusTournamentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (tournaments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <Trophy className="w-10 h-10 text-muted-foreground/30" />
        <p className="text-muted-foreground">No tournaments yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tournaments.map((t) => (
        <TournamentCard
          key={t.id}
          tournament={t}
          userId={userId}
          autoExpand={focusTournamentId === t.id}
        />
      ))}
    </div>
  );
}
