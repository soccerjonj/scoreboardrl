import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { Trophy, ChevronDown, ChevronUp, Plus } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { ROUND_LABELS, ROUND_ORDER, TOURNAMENT_TYPE_LABELS, RoundKey } from "@/hooks/useTournamentSession";
import BracketTree, { RoundResult } from "@/components/tournament/BracketTree";
import StartTournamentSheet from "@/components/tournament/StartTournamentSheet";
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

type GameResult = {
  id: string;
  result: string;
  played_at: string;
  game_mode: string;
  game_players: Array<{
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
  }>;
};

function highestRound(rounds: RoundResult[]): string {
  for (let i = ROUND_ORDER.length - 1; i >= 0; i--) {
    if (rounds.find((r) => r.round === ROUND_ORDER[i])) {
      return ROUND_LABELS[ROUND_ORDER[i]];
    }
  }
  return "Round 1";
}

function TournamentCard({ tournament }: { tournament: Tournament }) {
  const [expanded, setExpanded] = useState(false);
  const [bracketRounds, setBracketRounds] = useState<RoundResult[]>([]);
  const [games, setGames] = useState<GameResult[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailLoaded, setDetailLoaded] = useState(false);

  const loadDetail = async () => {
    if (detailLoaded) return;
    setLoadingDetail(true);
    try {
      const { data: tgRows } = await supabase
        .from("tournament_games")
        .select("*")
        .eq("tournament_id", tournament.id)
        .order("created_at", { ascending: true });

      const rows = (tgRows ?? []) as TournamentGame[];
      const gameIds = rows.map((r) => r.game_id);
      if (gameIds.length === 0) { setDetailLoaded(true); return; }

      const { data: gamesData } = await supabase
        .from("games")
        .select("id, result, played_at, game_mode, game_players(id, player_name, score, goals, assists, saves, shots, team, is_mvp, user_id)")
        .in("id", gameIds);

      const gd = (gamesData ?? []) as GameResult[];
      const resultMap = new Map(gd.map((g) => [g.id, g.result as "win" | "loss"]));
      setGames(gd);

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

  // Aggregate stats
  const allPlayers = games.flatMap((g) => g.game_players);
  const totalGames = games.length;
  const wins = games.filter((g) => g.result === "win").length;

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
          <div className="mt-4 space-y-4">
            {/* Bracket */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Bracket</p>
              {bracketRounds.length > 0 ? (
                <BracketTree rounds={bracketRounds} outcome={tournament.outcome} />
              ) : (
                <p className="text-xs text-muted-foreground">No games logged yet.</p>
              )}
            </div>

            {/* Aggregate stats */}
            {totalGames > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tournament Stats</p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { label: "Games", value: totalGames },
                    { label: "Wins", value: wins },
                    { label: "Goals", value: allPlayers.reduce((s, p) => s + (p.goals ?? 0), 0) },
                    { label: "Assists", value: allPlayers.reduce((s, p) => s + (p.assists ?? 0), 0) },
                    { label: "Saves", value: allPlayers.reduce((s, p) => s + (p.saves ?? 0), 0) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col items-center py-2 rounded-lg bg-background/60">
                      <span className="font-display font-bold text-base">{value}</span>
                      <span className="text-[10px] text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Game list */}
            {games.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Games</p>
                <div className="space-y-2">
                  {games.map((g) => {
                    const tgRow = (bracketRounds.flatMap((r) => r.games).length > 0)
                      ? null : null;
                    const isWin = g.result === "win";
                    return (
                      <div key={g.id} className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg border",
                        isWin ? "border-rl-green/20 bg-rl-green/5" : "border-rl-red/20 bg-rl-red/5"
                      )}>
                        <span className={cn(
                          "text-xs font-display font-bold",
                          isWin ? "text-rl-green" : "text-rl-red"
                        )}>
                          {isWin ? "WIN" : "LOSS"}
                        </span>
                        <span className="text-xs text-muted-foreground">{format(new Date(g.played_at), "h:mm a")}</span>
                        <div className="flex-1 flex flex-wrap gap-1">
                          {g.game_players.map((p) => (
                            <span key={p.id} className="text-[10px] text-muted-foreground">
                              {p.player_name} ({p.score})
                            </span>
                          ))}
                        </div>
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

export default function Tournaments() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStart, setShowStart] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) { navigate("/auth"); return; }
    if (!user) return;

    supabase
      .from("tournaments")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setTournaments((data ?? []) as Tournament[]);
        setLoading(false);
      });
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Tournaments</h1>
            <p className="text-sm text-muted-foreground">Your daily tournament history</p>
          </div>
          <Button variant="hero" size="sm" className="gap-2" onClick={() => setShowStart(true)}>
            <Plus className="w-4 h-4" />
            Start
          </Button>
        </div>

        {tournaments.length === 0 ? (
          <Card className="border-dashed border-border/50">
            <CardContent className="py-12 text-center space-y-4">
              <Trophy className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <div>
                <p className="text-muted-foreground">No tournaments yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Start a tournament session and log your games</p>
              </div>
              <Button variant="hero" className="gap-2" onClick={() => setShowStart(true)}>
                <Plus className="w-4 h-4" />
                Start Tournament
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </div>

      <StartTournamentSheet open={showStart} onOpenChange={setShowStart} />
    </AppLayout>
  );
}
