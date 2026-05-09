import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Trophy, Loader2, Plus, Minimize2, X as XIcon, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTournamentSession, ROUND_LABELS, TOURNAMENT_TYPE_LABELS, RoundKey } from "@/hooks/useTournamentSession";
import BracketTree, { RoundResult } from "@/components/tournament/BracketTree";
import { CarryMeter } from "@/components/game/CarryMeter";
import { cn } from "@/lib/utils";

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TournamentModeSheet({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeTournament, tournamentGames, currentRound, isActive, endSession, participants, isOwner } = useTournamentSession();
  const [games, setGames] = useState<GameResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [participantProfiles, setParticipantProfiles] = useState<Record<string, { rl_name: string; avatar_url: string | null }>>({});

  // Fetch profile data for participants so we can show names + avatars
  useEffect(() => {
    if (participants.length === 0) { setParticipantProfiles({}); return; }
    const ids = participants.map((p) => p.user_id);
    supabase
      .from("profiles")
      .select("user_id, username, rl_account_name, avatar_url")
      .in("user_id", ids)
      .then(({ data }) => {
        const map: Record<string, { rl_name: string; avatar_url: string | null }> = {};
        (data ?? []).forEach((p: any) => {
          map[p.user_id] = {
            rl_name: p.rl_account_name ?? p.username ?? "Unknown",
            avatar_url: p.avatar_url ?? null,
          };
        });
        setParticipantProfiles(map);
      });
  }, [participants.map((p) => p.user_id).join(",")]);

  // Refetch game data whenever the sheet opens or the linked games list changes
  useEffect(() => {
    if (!open || !activeTournament || !user) return;
    const gameIds = tournamentGames
      .filter((tg) => tg.tournament_id === activeTournament.id)
      .map((tg) => tg.game_id);
    if (gameIds.length === 0) {
      setGames([]);
      return;
    }
    setLoading(true);
    supabase
      .from("games")
      .select("id, result, played_at, game_mode, game_players(id, player_name, score, goals, assists, saves, shots, team, is_mvp, user_id, contribution_score)")
      .in("id", gameIds)
      .order("played_at", { ascending: true })
      .then(({ data }) => {
        setGames((data ?? []) as GameResult[]);
        setLoading(false);
      });
  }, [open, activeTournament?.id, tournamentGames.length, user?.id]);

  // Build bracket rounds from tournamentGames + game results
  const bracketRounds: RoundResult[] = useMemo(() => {
    if (!activeTournament) return [];
    const resultMap = new Map(games.map((g) => [g.id, g.result as "win" | "loss"]));
    const roundsMap = new Map<string, RoundResult>();
    tournamentGames
      .filter((tg) => tg.tournament_id === activeTournament.id)
      .forEach((tg) => {
        const res = resultMap.get(tg.game_id);
        if (!res) return;
        const existing = roundsMap.get(tg.round);
        if (existing) {
          existing.games.push({ result: res, game_number: tg.game_number });
        } else {
          roundsMap.set(tg.round, {
            round: tg.round as RoundKey,
            games: [{ result: res, game_number: tg.game_number }],
            isCurrentRound: tg.round === activeTournament.current_round,
          });
        }
      });
    return Array.from(roundsMap.values());
  }, [activeTournament, tournamentGames, games]);

  // Aggregate user's team stats across all logged tournament games
  const { teamTotals, teammates, teamSize, totalGames, wins } = useMemo(() => {
    const playerMap = new Map<string, {
      displayName: string;
      isUser: boolean;
      score: number;
      goals: number;
      assists: number;
      saves: number;
      shots: number;
      contribTotal: number;
      contribCount: number;
      gamesCount: number;
    }>();
    const teamTotals = { score: 0, goals: 0, assists: 0, saves: 0, shots: 0 };

    games.forEach((g) => {
      const userRow = g.game_players.find((p) => p.user_id === user?.id);
      if (!userRow || !userRow.team) return;
      g.game_players
        .filter((p) => p.team === userRow.team)
        .forEach((p) => {
          const key = p.user_id ?? p.player_name.trim().toLowerCase();
          const cs = p.contribution_score;
          const hasCs = typeof cs === "number" && !Number.isNaN(cs);
          const existing = playerMap.get(key);
          if (existing) {
            existing.score   += p.score   ?? 0;
            existing.goals   += p.goals   ?? 0;
            existing.assists += p.assists ?? 0;
            existing.saves   += p.saves   ?? 0;
            existing.shots   += p.shots   ?? 0;
            existing.gamesCount += 1;
            if (hasCs) { existing.contribTotal += cs as number; existing.contribCount += 1; }
          } else {
            playerMap.set(key, {
              displayName: p.player_name,
              isUser: p.user_id === user?.id,
              score:   p.score   ?? 0,
              goals:   p.goals   ?? 0,
              assists: p.assists ?? 0,
              saves:   p.saves   ?? 0,
              shots:   p.shots   ?? 0,
              contribTotal: hasCs ? (cs as number) : 0,
              contribCount: hasCs ? 1 : 0,
              gamesCount: 1,
            });
          }
          teamTotals.score   += p.score   ?? 0;
          teamTotals.goals   += p.goals   ?? 0;
          teamTotals.assists += p.assists ?? 0;
          teamTotals.saves   += p.saves   ?? 0;
          teamTotals.shots   += p.shots   ?? 0;
        });
    });

    const teammates = Array.from(playerMap.values()).sort((a, b) => {
      if (a.isUser !== b.isUser) return a.isUser ? -1 : 1;
      return b.score - a.score;
    });

    const mode = activeTournament?.game_mode;
    const teamSize = mode === "1v1" ? 1 : mode === "2v2" ? 2 : 3;
    const totalGames = games.length;
    const wins = games.filter((g) => g.result === "win").length;

    return { teamTotals, teammates, teamSize, totalGames, wins };
  }, [games, user?.id, activeTournament?.game_mode]);

  if (!isActive || !activeTournament) return null;

  const handleLogGame = () => {
    onOpenChange(false);
    navigate("/log-game");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[100dvh] max-h-[100dvh] p-0 flex flex-col rounded-none sm:rounded-t-xl border-t border-yellow-400/30"
      >
        {/* Header */}
        <div className="shrink-0 border-b border-border/40 bg-gradient-to-b from-yellow-400/10 to-transparent px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="w-5 h-5 text-yellow-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-display font-bold text-yellow-300 leading-tight">
                Tournament Mode
              </p>
              <p className="text-xs text-yellow-400/70 leading-tight">
                {activeTournament.game_mode} {TOURNAMENT_TYPE_LABELS[activeTournament.tournament_type as keyof typeof TOURNAMENT_TYPE_LABELS] ?? activeTournament.tournament_type}
                {currentRound && ` · ${ROUND_LABELS[currentRound]}`}
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1">
            {showEndConfirm ? (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-card/80 border border-border/50">
                <span className="text-[11px] text-muted-foreground">{isOwner ? "End session?" : "Leave session?"}</span>
                <button
                  onClick={async () => { await endSession(); setShowEndConfirm(false); onOpenChange(false); }}
                  className="text-[11px] font-bold text-rl-red hover:text-rl-red/80 transition-colors px-1.5"
                >Yes</button>
                <button
                  onClick={() => setShowEndConfirm(false)}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1.5"
                >No</button>
              </div>
            ) : (
              <button
                onClick={() => setShowEndConfirm(true)}
                title={isOwner ? "End tournament session" : "Leave tournament session"}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-rl-red hover:bg-rl-red/10 transition-colors"
              >
                <XIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isOwner ? "End" : "Leave"}</span>
              </button>
            )}
            <button
              onClick={() => onOpenChange(false)}
              title="Minimize"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Minimize</span>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {loading && games.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Co-pilots — only shown when this is a co-op tournament */}
              {participants.length > 1 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Co-pilots</p>
                  <div className="flex flex-wrap gap-2">
                    {participants.map((p) => {
                      const prof = participantProfiles[p.user_id];
                      const name = prof?.rl_name ?? "…";
                      const isMe = p.user_id === user?.id;
                      return (
                        <div
                          key={p.id}
                          className={cn(
                            "flex items-center gap-2 px-2.5 py-1.5 rounded-full border",
                            isMe ? "bg-primary/10 border-primary/40" : "bg-card/50 border-border/40"
                          )}
                        >
                          <div className="w-5 h-5 rounded-full overflow-hidden bg-muted/50 flex items-center justify-center shrink-0">
                            {prof?.avatar_url ? (
                              <img src={prof.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-3 h-3 text-muted-foreground" />
                            )}
                          </div>
                          <span className={cn("text-xs font-medium truncate max-w-[140px]", isMe && "text-primary")}>
                            {name}
                          </span>
                          {p.is_owner && (
                            <span className="text-[9px] uppercase tracking-wider font-bold text-yellow-400">Host</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bracket */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Bracket</p>
                {bracketRounds.length > 0 ? (
                  <BracketTree rounds={bracketRounds} />
                ) : (
                  <div className="rounded-lg border border-dashed border-border/40 px-4 py-6 text-center">
                    <Trophy className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      No games logged yet — log your first game to populate the bracket.
                    </p>
                  </div>
                )}
              </div>

              {/* Team stats */}
              {games.length > 0 && teammates.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Team Stats So Far</p>

                  {/* Team Total hero card */}
                  <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4 mb-3">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-display font-bold uppercase tracking-wider text-primary">
                        Team Total
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                        {totalGames} game{totalGames === 1 ? "" : "s"} · <span className="text-rl-green">{wins}W</span> <span className="text-rl-red">{totalGames - wins}L</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { label: "Score",   value: teamTotals.score,   color: "text-foreground" },
                        { label: "Goals",   value: teamTotals.goals,   color: "text-rl-orange" },
                        { label: "Assists", value: teamTotals.assists, color: "text-rl-blue" },
                        { label: "Saves",   value: teamTotals.saves,   color: "text-cyan-400" },
                        { label: "Shots",   value: teamTotals.shots,   color: "text-muted-foreground" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="flex flex-col items-center justify-center py-2 rounded-lg bg-background/50">
                          <span className={cn("font-display font-bold text-xl leading-none", color)}>{value}</span>
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Per-teammate cards */}
                  <div className="space-y-2">
                    {teammates.map((p, i) => {
                      const avgContrib = p.contribCount > 0 ? p.contribTotal / p.contribCount : null;
                      return (
                        <div
                          key={i}
                          className={cn(
                            "rounded-xl border p-3.5",
                            p.isUser
                              ? "bg-primary/5 border-primary/40 shadow-sm"
                              : "bg-card/40 border-border/40"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className={cn(
                              "text-base font-display font-bold min-w-0 break-words",
                              p.isUser ? "text-primary" : "text-foreground"
                            )}>
                              {p.displayName || <span className="italic text-muted-foreground">Unknown</span>}
                              {p.isUser && <span className="ml-2 text-[10px] font-sans uppercase tracking-wider text-primary/70 align-middle">You</span>}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                              {p.gamesCount} game{p.gamesCount === 1 ? "" : "s"}
                            </span>
                          </div>
                          <div className="grid grid-cols-5 gap-1.5">
                            {[
                              { label: "Score",   value: p.score,   color: "text-foreground" },
                              { label: "Goals",   value: p.goals,   color: "text-rl-orange" },
                              { label: "Assists", value: p.assists, color: "text-rl-blue" },
                              { label: "Saves",   value: p.saves,   color: "text-cyan-400" },
                              { label: "Shots",   value: p.shots,   color: "text-muted-foreground" },
                            ].map(({ label, value, color }) => (
                              <div key={label} className="flex flex-col items-center justify-center py-1.5 rounded-md bg-background/50">
                                <span className={cn("font-display font-bold text-lg leading-none", color)}>{value}</span>
                                <span className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">{label}</span>
                              </div>
                            ))}
                          </div>
                          {avgContrib !== null && teamSize > 1 && (
                            <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-3">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                                Avg Carry
                              </span>
                              <div className="flex-1 min-w-0">
                                <CarryMeter score={avgContrib} teamSize={teamSize} size="sm" />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sticky footer — Log Game button */}
        <div
          className="shrink-0 border-t border-border/40 bg-card/95 px-4 py-3"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
        >
          <button
            onClick={handleLogGame}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-950 font-display font-bold text-sm shadow-lg hover:shadow-xl hover:from-yellow-300 hover:to-yellow-400 transition-all"
          >
            <Plus className="w-4 h-4" />
            Log Next Game
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
