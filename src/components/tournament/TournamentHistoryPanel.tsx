import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Trophy, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import BracketTree, { RoundResult } from "@/components/tournament/BracketTree";
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

function TournamentCard({ tournament, userId }: { tournament: Tournament; userId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [bracketRounds, setBracketRounds] = useState<RoundResult[]>([]);
  const [games, setGames] = useState<GameResult[]>([]);
  const [tgRows, setTgRows] = useState<TournamentGame[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);

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
        .select("id, result, played_at, game_mode, game_players(id, player_name, score, goals, assists, saves, shots, team, is_mvp, user_id)")
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

  // Aggregate all players across games, grouped by name
  const playerMap = new Map<string, {
    displayName: string;
    isUser: boolean;
    score: number;
    goals: number;
    assists: number;
    saves: number;
    shots: number;
    gamesCount: number;
  }>();

  games.forEach((g) => {
    g.game_players.forEach((p) => {
      const key = p.user_id ?? p.player_name.trim().toLowerCase();
      const existing = playerMap.get(key);
      if (existing) {
        existing.score += p.score ?? 0;
        existing.goals += p.goals ?? 0;
        existing.assists += p.assists ?? 0;
        existing.saves += p.saves ?? 0;
        existing.shots += p.shots ?? 0;
        existing.gamesCount += 1;
      } else {
        playerMap.set(key, {
          displayName: p.player_name,
          isUser: p.user_id === userId,
          score: p.score ?? 0,
          goals: p.goals ?? 0,
          assists: p.assists ?? 0,
          saves: p.saves ?? 0,
          shots: p.shots ?? 0,
          gamesCount: 1,
        });
      }
    });
  });

  const aggregatedPlayers = Array.from(playerMap.values()).sort((a, b) => b.score - a.score);

  return (
    <Card className={cn(
      "overflow-hidden transition-all",
      isWinner && "border-yellow-400/30",
      isEliminated && "border-border/40",
      isActive && "border-primary/30",
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
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(new Date(tournament.created_at), "MMM d, yyyy")}
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
            {games.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Your Stats This Tournament</p>
                <div className="space-y-1.5">
                  {aggregatedPlayers.map((p, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-lg border px-3 py-2",
                        p.isUser
                          ? "bg-primary/5 border-primary/40"
                          : "bg-card/40 border-border/30"
                      )}
                    >
                      {/* Top row: name + games count */}
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className={cn(
                          "text-sm font-display font-bold truncate min-w-0",
                          p.isUser ? "text-primary" : "text-foreground"
                        )}>
                          {p.displayName || <span className="italic text-muted-foreground">Unknown</span>}
                          {p.isUser && <span className="ml-1.5 text-[9px] font-sans uppercase tracking-wider text-primary/70">You</span>}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                          {p.gamesCount} game{p.gamesCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      {/* Stats row */}
                      <div className="flex items-center gap-3 font-mono text-xs">
                        <span className="font-bold text-foreground/90">{p.score}</span>
                        <span className="text-rl-orange">{p.goals}G</span>
                        <span className="text-rl-blue">{p.assists}A</span>
                        <span className="text-cyan-400">{p.saves}SV</span>
                        <span className="text-muted-foreground">{p.shots}SH</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

                    const bluePlayers = g.game_players.filter((p) => p.team === "blue");
                    const orangePlayers = g.game_players.filter((p) => p.team === "orange");

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
                          <div className="border-t border-border/20 px-3 pb-3 pt-2">
                            {/* Column headers */}
                            <div className="grid grid-cols-[1fr_3rem_2rem_3rem_2rem_3rem] gap-x-1 pb-1.5 mb-1 border-b border-border/20">
                              <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Name</span>
                              <span className="text-[9px] font-semibold text-muted-foreground text-right">Score</span>
                              <span className="text-[9px] font-semibold text-muted-foreground text-right">G</span>
                              <span className="text-[9px] font-semibold text-muted-foreground text-right">Assists</span>
                              <span className="text-[9px] font-semibold text-muted-foreground text-right">Sv</span>
                              <span className="text-[9px] font-semibold text-muted-foreground text-right">Shots</span>
                            </div>

                            {/* Blue team */}
                            {bluePlayers.length > 0 && (
                              <div className="mb-1">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-0.5">Blue</p>
                                {bluePlayers.map((p) => {
                                  const isUser = p.user_id === userId;
                                  return (
                                    <div
                                      key={p.id}
                                      className={cn(
                                        "grid grid-cols-[1fr_3rem_2rem_3rem_2rem_3rem] gap-x-1 items-center py-1.5 rounded-md",
                                        isUser && "bg-primary/5 px-1.5 -mx-1.5"
                                      )}
                                    >
                                      <div className="flex items-center gap-1 min-w-0">
                                        <span className={cn("text-xs font-medium truncate", isUser ? "text-primary" : "text-foreground")}>
                                          {p.player_name}
                                        </span>
                                        {p.is_mvp && <span className="text-[9px] text-yellow-400 font-bold shrink-0">MVP</span>}
                                      </div>
                                      <span className="text-xs font-mono font-bold text-right">{p.score}</span>
                                      <span className="text-xs font-mono text-muted-foreground text-right">{p.goals}</span>
                                      <span className="text-xs font-mono text-muted-foreground text-right">{p.assists}</span>
                                      <span className="text-xs font-mono text-muted-foreground text-right">{p.saves}</span>
                                      <span className="text-xs font-mono text-muted-foreground text-right">{p.shots}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Orange team */}
                            {orangePlayers.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-400 mb-0.5">Orange</p>
                                {orangePlayers.map((p) => {
                                  const isUser = p.user_id === userId;
                                  return (
                                    <div
                                      key={p.id}
                                      className={cn(
                                        "grid grid-cols-[1fr_3rem_2rem_3rem_2rem_3rem] gap-x-1 items-center py-1.5 rounded-md",
                                        isUser && "bg-primary/5 px-1.5 -mx-1.5"
                                      )}
                                    >
                                      <div className="flex items-center gap-1 min-w-0">
                                        <span className={cn("text-xs font-medium truncate", isUser ? "text-primary" : "text-foreground")}>
                                          {p.player_name}
                                        </span>
                                        {p.is_mvp && <span className="text-[9px] text-yellow-400 font-bold shrink-0">MVP</span>}
                                      </div>
                                      <span className="text-xs font-mono font-bold text-right">{p.score}</span>
                                      <span className="text-xs font-mono text-muted-foreground text-right">{p.goals}</span>
                                      <span className="text-xs font-mono text-muted-foreground text-right">{p.assists}</span>
                                      <span className="text-xs font-mono text-muted-foreground text-right">{p.saves}</span>
                                      <span className="text-xs font-mono text-muted-foreground text-right">{p.shots}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
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

export default function TournamentHistoryPanel({ userId }: { userId: string }) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("tournaments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTournaments((data ?? []) as Tournament[]);
        setLoading(false);
      });
  }, [userId]);

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
        <TournamentCard key={t.id} tournament={t} userId={userId} />
      ))}
    </div>
  );
}
