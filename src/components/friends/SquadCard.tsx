import { useMemo, useState } from "react";
import { Users2, ChevronDown, ChevronUp, Loader2, Pencil, Trash2, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CarryMeter } from "@/components/game/CarryMeter";
import { relativeDate } from "@/lib/relativeDate";
import { getGameCategory, GAME_CATEGORY_SHORT_LABELS, isSeriousCategory } from "@/lib/gameModes";
import RecentTournaments, { type RecentTournament } from "@/components/profile/RecentTournaments";
import { cn } from "@/lib/utils";

export type SquadCardData = {
  id: string;
  name: string;
  members: Array<{
    userId: string;
    rlName: string;
    avatarUrl: string | null;
  }>;
};

type GamePlayer = {
  user_id: string | null;
  player_name: string;
  team: string | null;
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  is_mvp: boolean;
  contribution_score: number | null;
};

type GameRow = {
  id: string;
  result: string;
  played_at: string;
  game_mode: string;
  game_type: string;
  tournament_type: string | null;
  game_players: GamePlayer[];
};

interface Props {
  squad: SquadCardData;
  /** The viewer (squad owner) — used for "subject row" highlighting + team detection. */
  viewerUserId: string;
  onEdit: () => void;
  onDelete: () => void;
}

const DEFAULT_TEAM_SIZE = 3; // best-effort guess; refined per game when known

export default function SquadCard({ squad, viewerUserId, onEdit, onDelete }: Props) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [detailLoaded, setDetailLoaded] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [games, setGames] = useState<GameRow[]>([]);
  const [tournaments, setTournaments] = useState<RecentTournament[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [visibleGames, setVisibleGames] = useState(5);

  const memberIds = useMemo(
    () => [viewerUserId, ...squad.members.map((m) => m.userId)],
    [viewerUserId, squad.members]
  );

  const loadDetail = async () => {
    if (detailLoaded) return;
    setLoadingDetail(true);
    try {
      // 1. Find game_ids where the viewer played
      const { data: viewerRows } = await supabase
        .from("game_players")
        .select("game_id, team")
        .eq("user_id", viewerUserId);
      const candidateGameIds = (viewerRows ?? []).map((r) => r.game_id);
      if (candidateGameIds.length === 0) {
        setGames([]);
        setDetailLoaded(true);
        return;
      }

      // 2. Find all game_players rows for any squad member in those games
      const { data: memberRows } = await supabase
        .from("game_players")
        .select("game_id, user_id, team")
        .in("game_id", candidateGameIds)
        .in("user_id", memberIds);

      // 3. Filter to games where ALL squad members appeared on the SAME team
      const byGame = new Map<string, Map<string, string | null>>();
      (memberRows ?? []).forEach((r: any) => {
        if (!byGame.has(r.game_id)) byGame.set(r.game_id, new Map());
        byGame.get(r.game_id)!.set(r.user_id, r.team ?? null);
      });
      const togetherGameIds: string[] = [];
      byGame.forEach((memberTeams, gameId) => {
        if (memberTeams.size !== memberIds.length) return; // not all members present
        const teams = new Set(memberTeams.values());
        if (teams.size === 1 && !teams.has(null)) togetherGameIds.push(gameId);
      });

      if (togetherGameIds.length === 0) {
        setGames([]);
        setDetailLoaded(true);
        return;
      }

      // 4. Fetch the full games + players for chemistry stats and recent list
      const { data: gamesData } = await supabase
        .from("games")
        .select("id, result, played_at, game_mode, game_type, tournament_type, game_players(user_id, player_name, team, score, goals, assists, saves, shots, is_mvp, contribution_score)")
        .in("id", togetherGameIds)
        .order("played_at", { ascending: false });

      setGames((gamesData ?? []) as GameRow[]);

      // 5. Find tournaments where the squad played together. A tournament
      // counts when at least one of its games is in our togetherGameIds set.
      const { data: tgRows } = await supabase
        .from("tournament_games")
        .select("tournament_id")
        .in("game_id", togetherGameIds);
      const tournamentIds = Array.from(new Set((tgRows ?? []).map((r) => r.tournament_id))).filter(Boolean) as string[];
      if (tournamentIds.length > 0) {
        const { data: tList } = await supabase
          .from("tournaments")
          .select("id, game_mode, tournament_type, status, outcome, current_round, created_at")
          .in("id", tournamentIds)
          .order("created_at", { ascending: false });
        setTournaments((tList ?? []) as RecentTournament[]);
      } else {
        setTournaments([]);
      }

      setDetailLoaded(true);
    } catch (err: any) {
      toast({ title: "Failed to load squad stats", description: err.message, variant: "destructive" });
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleToggle = () => {
    if (!expanded) loadDetail();
    setExpanded((v) => !v);
  };

  // ── Aggregate chemistry stats across together-games ─────────────────────
  const { teamTotals, roster, totalGames, wins, wlHistory, teamSize, goalsFor, goalsAgainst } = useMemo(() => {
    type RosterEntry = {
      userId: string;
      displayName: string;
      isViewer: boolean;
      goals: number;
      assists: number;
      saves: number;
      shots: number;
      mvps: number;
      contribTotal: number;
      contribCount: number;
      gamesCount: number;
      _scoreSort: number;
    };
    const rosterMap = new Map<string, RosterEntry>();
    const teamTotals = { goals: 0, assists: 0, saves: 0, shots: 0, mvps: 0 };
    const memberSet = new Set(memberIds);
    let teamSize = DEFAULT_TEAM_SIZE;
    let goalsFor = 0;
    let goalsAgainst = 0;

    games.forEach((g) => {
      // Filter to squad members on the team they shared in this game
      const memberRows = g.game_players.filter(
        (p) => p.user_id && memberSet.has(p.user_id)
      );
      if (memberRows.length === 0) return;
      const team = memberRows[0]?.team;
      // game-level team size hint
      const sameTeamCount = g.game_players.filter((p) => p.team === team).length;
      if (sameTeamCount > 0) teamSize = sameTeamCount;

      // Team-level goal totals (squad's team vs opponents)
      g.game_players.forEach((p) => {
        if (p.team === team) {
          goalsFor += p.goals ?? 0;
        } else if (p.team) {
          goalsAgainst += p.goals ?? 0;
        }
      });

      memberRows.forEach((p) => {
        if (!p.user_id) return;
        const isMvp = !!p.is_mvp;
        const cs = p.contribution_score;
        const hasCs = typeof cs === "number" && !Number.isNaN(cs);
        const existing = rosterMap.get(p.user_id);
        if (existing) {
          existing.goals      += p.goals   ?? 0;
          existing.assists    += p.assists ?? 0;
          existing.saves      += p.saves   ?? 0;
          existing.shots      += p.shots   ?? 0;
          existing.mvps       += isMvp ? 1 : 0;
          existing._scoreSort += p.score   ?? 0;
          existing.gamesCount += 1;
          if (hasCs) { existing.contribTotal += cs as number; existing.contribCount += 1; }
        } else {
          rosterMap.set(p.user_id, {
            userId: p.user_id,
            displayName: p.player_name,
            isViewer: p.user_id === viewerUserId,
            goals:      p.goals   ?? 0,
            assists:    p.assists ?? 0,
            saves:      p.saves   ?? 0,
            shots:      p.shots   ?? 0,
            mvps:       isMvp ? 1 : 0,
            _scoreSort: p.score   ?? 0,
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

    const roster = Array.from(rosterMap.values()).sort((a, b) => {
      if (a.isViewer !== b.isViewer) return a.isViewer ? -1 : 1;
      return b._scoreSort - a._scoreSort;
    });

    const totalGames = games.length;
    const wins = games.filter((g) => g.result === "win").length;

    // W/L history dots — last 10 games together, oldest -> newest visually
    const wlHistory = games.slice(0, 10).map((g) => g.result as "win" | "loss" | string).reverse();

    return { teamTotals, roster, totalGames, wins, wlHistory, teamSize, goalsFor, goalsAgainst };
  }, [games, memberIds, viewerUserId]);

  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const memberPreview = squad.members.map((m) => m.rlName).join(" · ");

  return (
    <Card className={cn(
      "overflow-hidden transition-colors border-border/40",
      expanded && "ring-1 ring-primary/20"
    )}>
      {/* Top stripe */}
      <div className="h-0.5 w-full bg-gradient-to-r from-primary/60 via-primary/20 to-transparent" />

      <button
        onClick={handleToggle}
        className="w-full text-left hover:bg-muted/10 transition-colors"
      >
        <CardContent className="py-3 px-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <span className="w-1.5 h-8 rounded-full flex-shrink-0 mt-0.5 bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <Users2 className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="font-display font-bold text-sm">{squad.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-border/50">
                    You + {squad.members.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                  <span className="truncate">{memberPreview || "No teammates yet"}</span>
                  <span className="ml-auto text-xs text-muted-foreground shrink-0 font-mono">
                    {totalGames > 0 ? (
                      <>
                        <span className="text-rl-green font-bold">{wins}W</span>{" "}
                        <span className="text-rl-red font-bold">{totalGames - wins}L</span>{" "}
                        · {winRate}% WR
                      </>
                    ) : detailLoaded ? (
                      "No games yet"
                    ) : null}
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

      {expanded && (
        <div className="border-t border-border/40 px-4 py-4 space-y-5">
          {/* Edit / Delete actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Delete this squad?</span>
                <button
                  onClick={() => { onDelete(); setConfirmDelete(false); }}
                  className="text-xs font-bold text-rl-red hover:text-rl-red/80 transition-colors px-1"
                >Yes</button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
                >No</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-rl-red transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
          </div>

          {/* ── Empty state ─────────────────────────────────────────────────── */}
          {detailLoaded && games.length === 0 && (
            <div className="rounded-lg border border-dashed border-border/40 px-4 py-6 text-center">
              <Users2 className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                No games yet where all squad members played on the same team.
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                Log a game with this lineup to start tracking chemistry.
              </p>
            </div>
          )}

          {/* ── Hero Squad Recap ───────────────────────────────────────────── */}
          {games.length > 0 && (
            <div className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-primary/8 to-transparent p-5">
              {/* Decorative shield watermark */}
              <Users2 className="absolute -right-3 -top-3 w-24 h-24 opacity-[0.06] text-primary" />

              <div className="relative flex items-end justify-between gap-3 mb-4 flex-wrap">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1 text-primary">
                    Squad Recap
                  </p>
                  <p className="font-display text-3xl font-bold leading-none">
                    <span className="text-rl-green">{wins}</span>
                    <span className="text-muted-foreground/60 mx-1.5">–</span>
                    <span className="text-rl-red">{totalGames - wins}</span>
                  </p>
                  {/* Team goal differential — meaningful at the squad level */}
                  <p className="mt-2 text-xs font-mono text-muted-foreground tabular-nums">
                    <span className="text-rl-green font-bold">{goalsFor}</span> scored ·{" "}
                    <span className="text-rl-red font-bold">{goalsAgainst}</span> allowed{" "}
                    <span className={cn(
                      "ml-1 font-bold",
                      goalsFor > goalsAgainst ? "text-rl-green"
                        : goalsFor < goalsAgainst ? "text-rl-red"
                        : "text-muted-foreground"
                    )}>
                      ({goalsFor >= goalsAgainst ? "+" : ""}{goalsFor - goalsAgainst})
                    </span>
                  </p>
                </div>
                {/* W/L history dots — most recent on the right */}
                <div className="flex items-center gap-1.5 self-start mt-1">
                  {wlHistory.map((res, i) => (
                    <span
                      key={i}
                      className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        res === "win"
                          ? "bg-rl-green shadow-[0_0_6px_hsl(var(--rl-green)/0.5)]"
                          : "bg-rl-red shadow-[0_0_6px_hsl(var(--rl-red)/0.5)]"
                      )}
                      title={res === "win" ? "Win" : "Loss"}
                    />
                  ))}
                </div>
              </div>

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
          )}

          {/* ── Roster ─────────────────────────────────────────────────────── */}
          {games.length > 0 && roster.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">Roster</p>
              <div className="space-y-1.5">
                {roster.map((p) => {
                  const avgContrib = p.contribCount > 0 ? p.contribTotal / p.contribCount : null;
                  return (
                    <div
                      key={p.userId}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 transition-colors",
                        p.isViewer ? "bg-primary/5 border-primary/30" : "bg-card/40 border-border/30"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn("w-1 h-5 rounded-full shrink-0", p.isViewer ? "bg-primary" : "bg-border")} />
                          <span className={cn(
                            "text-sm font-display font-bold truncate",
                            p.isViewer ? "text-primary" : "text-foreground"
                          )}>
                            {p.displayName || <span className="italic text-muted-foreground">Unknown</span>}
                          </span>
                          {p.isViewer && (
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
          )}

          {/* ── Tournaments together (if any) ──────────────────────────────── */}
          {tournaments.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5 flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-yellow-400" />
                Tournaments Together
              </p>
              <RecentTournaments
                tournaments={tournaments}
                profileUserId={viewerUserId}
                isOwnProfile={true}
              />
            </div>
          )}

          {/* ── Recent games together ──────────────────────────────────────── */}
          {games.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">
                Recent Games Together
              </p>
              <div className="space-y-1.5">
                {games.slice(0, visibleGames).map((g) => {
                  const isWin = g.result === "win";
                  const cat = getGameCategory(g as any);
                  const serious = isSeriousCategory(cat);
                  const myRow = g.game_players.find((p) => p.user_id === viewerUserId);
                  const myTeam = myRow?.team ?? null;
                  const teamGoals = myTeam
                    ? g.game_players.filter((p) => p.team === myTeam).reduce((s, p) => s + (p.goals ?? 0), 0)
                    : null;
                  const oppGoals = myTeam
                    ? g.game_players.filter((p) => p.team !== myTeam && p.team != null).reduce((s, p) => s + (p.goals ?? 0), 0)
                    : null;
                  const isGameExpanded = expandedGameId === g.id;

                  // For the expanded scoreboard, group players by team relative
                  // to the viewer's team
                  const myTeamPlayers = myTeam
                    ? g.game_players.filter((p) => p.team === myTeam).sort((a, b) => b.score - a.score)
                    : [];
                  const oppPlayers = myTeam
                    ? g.game_players.filter((p) => p.team !== myTeam && p.team != null).sort((a, b) => b.score - a.score)
                    : [];

                  return (
                    <div
                      key={g.id}
                      className={cn(
                        "rounded-lg border overflow-hidden",
                        isWin ? "border-rl-green/20" : "border-rl-red/20"
                      )}
                    >
                      <div className={cn(
                        "h-0.5 w-full",
                        isWin
                          ? "bg-gradient-to-r from-rl-green/80 via-rl-green/40 to-transparent"
                          : "bg-gradient-to-r from-rl-red/80 via-rl-red/40 to-transparent"
                      )} />
                      <button
                        onClick={() => setExpandedGameId(isGameExpanded ? null : g.id)}
                        className="w-full text-left hover:bg-muted/10 transition-colors"
                      >
                        <div className="px-3 py-2.5">
                          <div className="flex items-start gap-3">
                            <span className={cn(
                              "w-1.5 h-7 rounded-full flex-shrink-0 mt-0.5",
                              isWin
                                ? "bg-rl-green shadow-[0_0_8px_hsl(var(--rl-green)/0.6)]"
                                : "bg-rl-red shadow-[0_0_8px_hsl(var(--rl-red)/0.6)]"
                            )} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-nowrap min-w-0 overflow-hidden mb-0.5">
                                <span className={cn(
                                  "font-display font-bold text-xs flex-shrink-0",
                                  isWin ? "text-rl-green" : "text-rl-red"
                                )}>{isWin ? "WIN" : "LOSS"}</span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">{g.game_mode}</Badge>
                                <span className={cn(
                                  "text-[10px] truncate",
                                  serious ? "text-foreground/70 font-semibold" : "text-muted-foreground"
                                )}>
                                  {GAME_CATEGORY_SHORT_LABELS[cat]}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                {teamGoals !== null && oppGoals !== null && (
                                  <>
                                    <span className="font-display font-bold text-sm leading-none">
                                      <span className={isWin ? "text-rl-green" : "text-rl-red"}>{teamGoals}</span>
                                      <span className="text-muted-foreground mx-0.5">–</span>
                                      <span className="text-muted-foreground">{oppGoals}</span>
                                    </span>
                                    <span className="text-border/60">·</span>
                                  </>
                                )}
                                <span className="shrink-0">{relativeDate(g.played_at)}</span>
                              </div>
                            </div>
                            <div className="text-muted-foreground/60 shrink-0 mt-1">
                              {isGameExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Expanded scoreboard */}
                      {isGameExpanded && myTeam && (
                        <div className="border-t border-border/20 px-2 pb-2 pt-2 bg-background/40">
                          {/* Column headers */}
                          <div className="grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_2rem] gap-x-1 px-2 pb-1.5 mb-0.5 border-b border-border/20">
                            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Player</span>
                            <span className="text-[9px] text-muted-foreground font-semibold text-right">Score</span>
                            <span className="text-[9px] text-muted-foreground font-semibold text-right">G</span>
                            <span className="text-[9px] text-muted-foreground font-semibold text-right">A</span>
                            <span className="text-[9px] text-muted-foreground font-semibold text-right">SV</span>
                            <span className="text-[9px] text-muted-foreground font-semibold text-right">SH</span>
                          </div>
                          {[
                            { label: isWin ? "Squad · WIN" : "Squad · LOSS", players: myTeamPlayers, isMyTeam: true },
                            { label: isWin ? "Opponents · LOSS" : "Opponents · WIN", players: oppPlayers, isMyTeam: false },
                          ].map((group, gi) => (
                            <div key={gi} className="mb-1">
                              <p className={cn(
                                "text-[10px] font-bold uppercase tracking-wider mt-1.5 mb-0.5 px-2",
                                group.isMyTeam ? "text-primary/80" : "text-muted-foreground"
                              )}>
                                {group.label}
                              </p>
                              {group.players.map((p, pi) => {
                                const isMember = p.user_id ? memberIds.includes(p.user_id) : false;
                                return (
                                  <div
                                    key={pi}
                                    className={cn(
                                      "grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_2rem] gap-x-1 px-2 py-1.5 items-start text-xs rounded-md",
                                      isMember && "bg-primary/5"
                                    )}
                                  >
                                    <div className="flex items-start gap-1.5 flex-wrap min-w-0">
                                      <span className={cn(
                                        "text-xs font-medium leading-snug break-words",
                                        isMember ? "text-primary font-semibold" : "text-foreground"
                                      )}>
                                        {p.player_name || "—"}
                                      </span>
                                      {p.is_mvp && (
                                        <span className="shrink-0 text-[9px] text-yellow-400 font-bold leading-snug">MVP</span>
                                      )}
                                    </div>
                                    <span className={cn("font-mono font-bold text-right leading-snug", isMember ? "text-foreground" : "text-foreground/80")}>{p.score}</span>
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
              {games.length > visibleGames && (
                <button
                  onClick={() => setVisibleGames((n) => n + 10)}
                  className="w-full mt-2 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
                >
                  Show {Math.min(games.length - visibleGames, 10)} more
                </button>
              )}
              {visibleGames > 5 && games.length > 5 && (
                <button
                  onClick={() => setVisibleGames(5)}
                  className="w-full py-1 text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors text-center"
                >
                  Show less
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
