import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { relativeDate } from "@/lib/relativeDate";
import { Plus, Loader2, Trophy, Target, TrendingUp, ChevronRight, Zap, ChevronDown, ChevronUp, Pencil, Check, X as XIcon, Trash2, Info, Users, ExternalLink } from "lucide-react";
import TournamentBannerCard from "@/components/tournament/TournamentBannerCard";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CarryMeter } from "@/components/game/CarryMeter";
import { calculateContributionScores } from "@/lib/carryScore";
import { getRankIcon } from "@/lib/rankIcons";
import AppLayout from "@/components/layout/AppLayout";
import { isStandardGame, getGameCategory, GAME_CATEGORY_LABELS, GAME_CATEGORY_SHORT_LABELS, EXTRA_MODE_LABELS, isSeriousCategory } from "@/lib/gameModes";
import { linkPlayersByName } from "@/lib/playerLinking";
import { TOURNAMENT_TYPE_LABELS } from "@/hooks/useTournamentSession";

// ─── CountUp component ────────────────────────────────────────────────────────
const CountUp = ({ to, decimals = 0, suffix = "", duration = 700 }: { to: number; decimals?: number; suffix?: string; duration?: number }) => {
  const [val, setVal] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setVal(parseFloat((eased * to).toFixed(decimals)));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [to, decimals, duration]);
  return <>{val.toFixed(decimals)}{suffix}</>;
};

type GameMode     = Database["public"]["Enums"]["game_mode"];
type RankTier     = Database["public"]["Enums"]["rank_tier"];
type RankDivision = Database["public"]["Enums"]["rank_division"];
type GamePlayerRow = Database["public"]["Tables"]["game_players"]["Row"];
type GameRow       = Database["public"]["Tables"]["games"]["Row"];
type GameWithPlayers = GameRow & { game_players: GamePlayerRow[] };

type RankData = {
  game_mode:      GameMode;
  rank_tier:      RankTier;
  rank_division:  RankDivision | null;
  mmr:            number | null;
};

const rankDisplayName = (tier: RankTier): string =>
  tier === "unranked"
    ? "Unranked"
    : tier.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

const gameModeLabels: Record<GameMode, string> = {
  "1v1": "1v1", "2v2": "2v2", "3v3": "3v3", "4v4": "4v4",
  "rumble_3v3": "Rumble", "hoops_2v2": "Hoops", "snowday_3v3": "Snow Day",
  "dropshot_3v3": "Dropshot", "heatseeker_2v2": "Heatseeker",
};
const normalizeName  = (v?: string | null) => v?.trim().toLowerCase() ?? "";

type PlayerEditValues = { player_name: string; score: number; goals: number; assists: number; saves: number; shots: number };

const Dashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [loading, setLoading]             = useState(true);
  const [ranks, setRanks]                 = useState<RankData[]>([]);
  const [games, setGames]                 = useState<GameWithPlayers[]>([]);

  const [ranksExpanded, setRanksExpanded] = useState(false);
  const [rlName, setRlName]               = useState<string | null>(null);
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [editValuesMap, setEditValuesMap] = useState<Record<string, PlayerEditValues>>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [showContribInfo, setShowContribInfo] = useState(false);
  const [visibleCount, setVisibleCount]       = useState(5);
  const [friendIds, setFriendIds]             = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const [profileRes, ranksRes, friendsRes] = await Promise.all([
          supabase.from("profiles").select("rl_account_name, username").eq("user_id", user.id).single(),
          supabase.from("ranks").select("game_mode, rank_tier, rank_division, mmr").eq("user_id", user.id).eq("game_type", "competitive"),
          supabase.from("friend_requests").select("sender_id, receiver_id").eq("status", "accepted").or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`),
        ]);

        if (profileRes.error) throw profileRes.error;
        if (ranksRes.error)   throw ranksRes.error;

        const friendIdSet = new Set<string>();
        (friendsRes.data || []).forEach((r) => {
          const fid = r.sender_id === user.id ? r.receiver_id : r.sender_id;
          if (fid) friendIdSet.add(fid);
        });
        setFriendIds(friendIdSet);

        // Step 1: get all game IDs where user appears as a player
        const { data: playerGameRows } = await supabase
          .from("game_players")
          .select("game_id")
          .eq("user_id", user.id);

        const linkedGameIds = (playerGameRows || []).map((r) => r.game_id);

        // Step 2: fetch games created by user OR where user is a player
        const allIds = Array.from(new Set([...linkedGameIds]));
        let gamesRes;
        if (allIds.length > 0) {
          gamesRes = await supabase
            .from("games")
            .select("id, played_at, game_mode, game_type, tournament_type, result, created_at, created_by, division_change, screenshot_url, tournament_games(tournament_id), game_players (id, user_id, player_name, team, score, goals, assists, saves, shots, is_mvp, contribution_score, submission_status, submitted_by, created_at, game_id)")
            .or(`created_by.eq.${user.id},id.in.(${allIds.join(",")})`)

            .order("played_at", { ascending: false });
        } else {
          gamesRes = await supabase
            .from("games")
            .select("id, played_at, game_mode, game_type, tournament_type, result, created_at, created_by, division_change, screenshot_url, tournament_games(tournament_id), game_players (id, user_id, player_name, team, score, goals, assists, saves, shots, is_mvp, contribution_score, submission_status, submitted_by, created_at, game_id)")
            .eq("created_by", user.id)

            .order("played_at", { ascending: false });
        }

        if (gamesRes.error) throw gamesRes.error;

        setRlName(profileRes.data?.rl_account_name ?? null);
        setRanks((ranksRes.data || []) as RankData[]);
        setGames((gamesRes.data || []) as GameWithPlayers[]);
      } catch (err: any) {
        toast({ title: "Failed to load", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, toast]);

  const userTarget = useMemo(() => {
    const names = [normalizeName(rlName)].filter(Boolean);
    return { userId: user?.id, names };
  }, [user?.id, rlName]);

  // ── Recalculate contribution scores for all games on every load ──────────────
  const backfillCarryScores = useCallback(async (loadedGames: GameWithPlayers[]) => {
    if (!user) return;

    const needsBackfill = loadedGames.filter((game) =>
      (game.game_players ?? []).every((p) => p.team != null)
    );

    if (needsBackfill.length === 0) return;

    // Build a flat map of player_row_id → new contribution_score
    const playerScoreUpdates = new Map<string, number>();

    for (const game of needsBackfill) {
      const playersForCalc = (game.game_players ?? []).map((p) => ({
        name:    p.player_name,
        team:    p.team as "blue" | "orange",
        score:   p.score,
        goals:   p.goals,
        assists: p.assists,
        saves:   p.saves,
        shots:   p.shots,
      }));

      const contributionMap = calculateContributionScores(playersForCalc);

      await Promise.all(
        (game.game_players ?? []).map((row) => {
          const contributionScore = contributionMap.get(normalizeName(row.player_name)) ?? 1;
          playerScoreUpdates.set(row.id, contributionScore);
          return supabase
            .from("game_players")
            .update({ contribution_score: contributionScore })
            .eq("id", row.id);
        })
      );
    }

    // Patch in-memory state directly — no re-fetch, no dataset mismatch
    setGames((prev) =>
      prev.map((game) => ({
        ...game,
        game_players: (game.game_players ?? []).map((p) => {
          const updated = playerScoreUpdates.get(p.id);
          return updated !== undefined ? { ...p, contribution_score: updated } : p;
        }),
      }))
    );
  }, [user]);

  useEffect(() => {
    if (!loading && games.length > 0) {
      backfillCarryScores(games);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-link: ?game=<id> → expand that card and scroll to it
  useEffect(() => {
    if (loading || games.length === 0) return;
    const targetId = searchParams.get("game");
    if (!targetId) return;
    const idx = games.findIndex((g) => g.id === targetId);
    if (idx === -1) return;
    // Ensure the game is rendered (visibleCount may be 5 by default)
    setVisibleCount((prev) => Math.max(prev, idx + 1));
    setExpandedGameId(targetId);
    // Small delay so the DOM has time to render the card at the new visibleCount
    setTimeout(() => {
      document.getElementById(`game-${targetId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  }, [loading, games, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Inline stat editing (whole scoreboard at once) ────────────────────────────
  const handleAllStatsSave = async (game: GameWithPlayers) => {
    if (!user) return;
    try {
      const players = game.game_players ?? [];
      const updatedPlayers = players.map((p) => ({
        ...p,
        ...(editValuesMap[p.id] ?? {}),
      }));

      // Save each player's stats
      await Promise.all(
        updatedPlayers.map((p) => {
          const vals = editValuesMap[p.id];
          if (!vals) return Promise.resolve({ error: null });
          return supabase
            .from("game_players")
            .update({
              player_name: vals.player_name,
              score:       vals.score,
              goals:       vals.goals,
              assists:     vals.assists,
              saves:       vals.saves,
              shots:       vals.shots,
            })
            .eq("id", p.id);
        })
      );

      // Recalculate contribution scores with updated stats (use new names from editValuesMap)
      const contributionMap = calculateContributionScores(
        updatedPlayers.map((p) => ({
          name:    editValuesMap[p.id]?.player_name ?? p.player_name,
          team:    (p.team ?? "blue") as "blue" | "orange",
          score:   p.score,
          goals:   p.goals,
          assists: p.assists,
          saves:   p.saves,
          shots:   p.shots,
        }))
      );
      await Promise.all(
        updatedPlayers.map((row) => {
          const name = (editValuesMap[row.id]?.player_name ?? row.player_name).toLowerCase();
          const contributionScore = contributionMap.get(name) ?? 1;
          return supabase.from("game_players").update({ contribution_score: contributionScore }).eq("id", row.id);
        })
      );

      // ── Re-link user_id for any rows whose player_name changed ──────────
      // Use the same approval logic as log-time: friend with auto-approve →
      // silent link, anyone else → pending + game_shared notification.
      // When a user gets unlinked by an edit, fire a stat_edit notification.
      const renamedRows = players.filter((p) => {
        const newName = editValuesMap[p.id]?.player_name;
        return newName && newName.trim().toLowerCase() !== p.player_name.toLowerCase();
      });
      const userIdUpdates = new Map<string, string | null>(); // game_player id → user_id
      const newlyLinked: Array<{ userId: string; status: "approved" | "pending" }> = [];
      const newlyUnlinked: string[] = [];

      if (renamedRows.length > 0) {
        const newNames = renamedRows.map((p) => editValuesMap[p.id]!.player_name.trim());
        const linkMap = await linkPlayersByName(newNames, user.id, rlName);

        await Promise.all(
          renamedRows.map((p) => {
            const newName = editValuesMap[p.id]!.player_name.trim();
            const link = linkMap.get(newName) ?? { userId: null, status: "approved" as const };
            const previousUserId = p.user_id;
            const newUserId = link.userId;

            userIdUpdates.set(p.id, newUserId);

            // Track diffs for post-write notifications
            if (newUserId && newUserId !== previousUserId && newUserId !== user.id) {
              newlyLinked.push({ userId: newUserId, status: link.status });
            }
            if (previousUserId && previousUserId !== newUserId && previousUserId !== user.id) {
              newlyUnlinked.push(previousUserId);
            }

            return supabase
              .from("game_players")
              .update({ user_id: newUserId, submission_status: link.status })
              .eq("id", p.id);
          })
        );
      }

      // ── Notifications for link changes ──────────────────────────────────
      const editorName = rlName ?? "A teammate";
      const modeLabel = game.game_mode;

      // Newly linked users — game_shared notification ("X tagged you in a game").
      // Approved auto-links don't need a notification (the user already trusts this editor).
      const pendingLinks = newlyLinked.filter((l) => l.status === "pending");
      await Promise.all(
        pendingLinks.map((l) =>
          supabase.from("notifications").insert({
            user_id: l.userId,
            type: "game_shared",
            title: `${editorName} tagged you in a game`,
            body: `A ${modeLabel} game was edited and your gamertag now matches your account.`,
            payload: { game_id: game.id, requires_approval: true },
          })
        )
      );

      // Newly unlinked users — stat_edit notification ("your link was removed")
      await Promise.all(
        newlyUnlinked.map((uid) =>
          supabase.from("notifications").insert({
            user_id: uid,
            type: "stat_edit",
            title: `${editorName} removed your link from a game`,
            body: `A ${modeLabel} game you were tagged in was edited and your account is no longer linked to it.`,
            payload: { game_id: game.id },
          })
        )
      );

      // Update local state
      setGames((prev) =>
        prev.map((g) =>
          g.id !== game.id ? g : {
            ...g,
            game_players: updatedPlayers.map((p) => {
              const newName = editValuesMap[p.id]?.player_name ?? p.player_name;
              const cs = contributionMap.get(newName.toLowerCase());
              // userIdUpdates explicitly sets null for "unlinked" — only fall back
              // to the existing user_id when there was no change for this row.
              const newUserId = userIdUpdates.has(p.id)
                ? (userIdUpdates.get(p.id) ?? null)
                : p.user_id;
              return { ...p, player_name: newName, user_id: newUserId, ...(cs !== undefined ? { contribution_score: cs } : {}) };
            }),
          }
        )
      );

      setEditingGameId(null);
      setEditValuesMap({});
      toast({ title: "Stats updated" });
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    try {
      await supabase.from("game_players").delete().eq("game_id", gameId);
      await supabase.from("games").delete().eq("id", gameId);
      setGames((prev) => prev.filter((g) => g.id !== gameId));
      setConfirmDeleteId(null);
      setExpandedGameId(null);
      toast({ title: "Game deleted" });
    } catch (err: any) {
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" });
    }
  };

  // Detach the current user from a game without deleting it. Sets the user's
  // game_players.user_id to null — preserves the historical scoreboard data
  // for everyone else, and silently removes the game from this user's profile.
  const handleRemoveFromProfile = async (gameId: string) => {
    if (!user) return;
    try {
      await supabase
        .from("game_players")
        .update({ user_id: null })
        .eq("game_id", gameId)
        .eq("user_id", user.id);

      setGames((prev) => prev.map((g) => {
        if (g.id !== gameId) return g;
        return {
          ...g,
          game_players: (g.game_players ?? []).map((p) =>
            p.user_id === user.id ? { ...p, user_id: null } : p
          ),
        };
      }));

      // If the user wasn't the creator, the game won't be in their dashboard
      // feed anymore — drop it from local state for immediate feedback.
      setGames((prev) => prev.filter((g) => g.id !== gameId || g.created_by === user.id));
      setConfirmDeleteId(null);
      setExpandedGameId(null);
      toast({ title: "Removed from your profile", description: "The game stays for other players." });
    } catch (err: any) {
      toast({ title: "Failed to remove", description: err.message, variant: "destructive" });
    }
  };

  // ── Quick stats ─────────────────────────────────────────────────────────────
  const quickStats = useMemo(() => {
    let totalGames = 0, wins = 0, totalScore = 0, totalGoals = 0, mvps = 0;
    let totalContrib = 0, contribGames = 0;
    const results: string[] = [];
    games.forEach((game) => {
      // Only count standard games in quick stats (competitive 1v1/2v2/3v3 + tournament Soccar 2v2/3v3)
      if (!isStandardGame(game as any)) return;
      const userRow = game.game_players?.find(
        (p) => (userTarget.userId && p.user_id === userTarget.userId) || userTarget.names.includes(normalizeName(p.player_name))
      );
      if (!userRow) return;
      totalGames++;
      if (game.result === "win") wins++;
      totalScore += userRow.score;
      totalGoals += userRow.goals;
      if (userRow.is_mvp) mvps++;
      const ts = game.game_mode === "1v1" ? 1 : (game.game_mode === "2v2" || game.game_mode === "hoops_2v2" || game.game_mode === "heatseeker_2v2") ? 2 : 3;
      const cs = userRow.contribution_score ?? 0;
      if (cs > 0 && ts > 1) { totalContrib += cs * ts; contribGames++; }
      results.push(game.result);
    });

    // Current streak: direction + consecutive count from most recent game
    let currentStreakCount = 0;
    let currentStreakType: "win" | "loss" | null = null;
    if (results.length > 0) {
      currentStreakType = results[0] === "win" ? "win" : "loss";
      for (const r of results) {
        if (r === currentStreakType) currentStreakCount++;
        else break;
      }
    }

    return {
      totalGames,
      wins,
      winRate:     totalGames ? Math.round((wins / totalGames) * 100) : 0,
      avgScore:    totalGames ? Math.round(totalScore / totalGames) : 0,
      goalsPerGame: totalGames ? totalGoals / totalGames : 0,
      mvpRate:     totalGames ? Math.round((mvps / totalGames) * 100) : 0,
      currentStreakCount,
      currentStreakType,
      avgContributionScore: contribGames ? totalContrib / contribGames : null,
    };
  }, [games, userTarget]);

  const recentStreak = useMemo(
    () => games.slice(0, 5).map((g) => (g.result === "win" ? "W" : "L")),
    [games]
  );

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!user) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Your Rocket League overview</p>
          </div>
          <Link to="/log-game">
            <Button variant="hero" size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Log Game
            </Button>
          </Link>
        </div>

        {/* Rank Cards */}
        {ranks.length > 0 && (() => {
          const preferredMode = (["2v2", "3v3", "1v1"] as GameMode[]).find(
            (m) => ranks.find((r) => r.game_mode === m && r.mmr != null)
          ) ?? ranks[0]?.game_mode;
          const mainRank = ranks.find((r) => r.game_mode === preferredMode);
          const mainTier = mainRank?.rank_tier ?? "unranked";
          const mainDiv  = mainRank?.rank_division;

          return (
            <div>
              {/* Collapsed summary header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <img src={getRankIcon(mainTier)} alt={rankDisplayName(mainTier)} className="w-8 h-8 object-contain" />
                  <div>
                    <p className="font-display font-bold text-sm leading-tight">
                      {rankDisplayName(mainTier)}{mainDiv && mainTier !== "unranked" ? ` Div ${mainDiv}` : ""}
                    </p>
                    {mainRank?.mmr != null && (
                      <p className="text-xs text-primary font-mono">{mainRank.mmr} MMR · {gameModeLabels[preferredMode]}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setRanksExpanded((v) => !v)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {ranksExpanded ? (
                    <><ChevronUp className="w-4 h-4" /> Hide ranks</>
                  ) : (
                    <><ChevronDown className="w-4 h-4" /> Show all ranks</>
                  )}
                </button>
              </div>

              {/* Expanded rank grid */}
              {ranksExpanded && (
                <div className="grid grid-cols-3 gap-3">
                  {(["1v1", "2v2", "3v3"] as GameMode[]).map((mode) => {
                    const rank = ranks.find((r) => r.game_mode === mode);
                    const tier = rank?.rank_tier ?? "unranked";
                    const div  = rank?.rank_division;
                    return (
                      <Card key={mode} className="border-border/50 bg-gradient-card text-center">
                        <CardContent className="pt-4 pb-3 px-2">
                          <p className="text-xs text-muted-foreground font-medium mb-1">{gameModeLabels[mode]}</p>
                          <div className="flex justify-center mb-1">
                            <img src={getRankIcon(tier)} alt={rankDisplayName(tier)} className="w-10 h-10 object-contain" />
                          </div>
                          <p className="font-display font-bold text-xs leading-tight">{rankDisplayName(tier)}</p>
                          {div && tier !== "unranked" && (
                            <p className="text-xs text-muted-foreground">Div {div}</p>
                          )}
                          {rank?.mmr != null && (
                            <p className="text-xs text-primary font-mono mt-1">{rank.mmr} MMR</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {ranks.length === 0 && (
          <Card className="border-border/50 bg-card/80 border-dashed">
            <CardContent className="py-4 text-center">
              <p className="text-sm text-muted-foreground">No ranks set yet.</p>
              <Link to="/profile">
                <Button variant="link" size="sm" className="text-primary">Set your ranks →</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 stagger-children">
          {/* Win Rate */}
          <Card className="relative overflow-hidden border-primary/10 animate-fade-in-up">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent" />
            <CardContent className="pt-4 pb-3 relative">
              <Target className="absolute top-3 right-3 w-4 h-4 text-primary/30" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Win Rate</p>
              <p className="font-display font-bold text-3xl mt-0.5 text-primary"><CountUp to={quickStats.winRate} suffix="%" /></p>
            </CardContent>
          </Card>

          {/* Avg Score */}
          <Card className="relative overflow-hidden border-secondary/10 animate-fade-in-up">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 via-secondary/5 to-transparent" />
            <CardContent className="pt-4 pb-3 relative">
              <TrendingUp className="absolute top-3 right-3 w-4 h-4 text-secondary/30" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Score</p>
              <p className="font-display font-bold text-3xl mt-0.5 text-secondary"><CountUp to={quickStats.avgScore} /></p>
            </CardContent>
          </Card>

          {/* Goals / Game */}
          <Card className="relative overflow-hidden border-rl-green/10 animate-fade-in-up">
            <div className="absolute inset-0 bg-gradient-to-br from-rl-green/10 via-rl-green/5 to-transparent" />
            <CardContent className="pt-4 pb-3 relative">
              <Zap className="absolute top-3 right-3 w-4 h-4 text-rl-green/30" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Goals / Game</p>
              <p className="font-display font-bold text-3xl mt-0.5 text-rl-green"><CountUp to={quickStats.goalsPerGame} decimals={2} /></p>
            </CardContent>
          </Card>

          {/* MVP Rate */}
          <Card className="relative overflow-hidden border-rl-purple/10 animate-fade-in-up">
            <div className="absolute inset-0 bg-gradient-to-br from-rl-purple/10 via-rl-purple/5 to-transparent" />
            <CardContent className="pt-4 pb-3 relative">
              <Trophy className="absolute top-3 right-3 w-4 h-4 text-rl-purple/30" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">MVP Rate</p>
              <p className="font-display font-bold text-3xl mt-0.5 text-rl-purple"><CountUp to={quickStats.mvpRate} suffix="%" /></p>
            </CardContent>
          </Card>

          {/* Current Streak */}
          <Card className={cn(
            "relative overflow-hidden animate-fade-in-up",
            quickStats.currentStreakType === "win" ? "border-rl-green/10" : "border-rl-red/10"
          )}>
            <div className={cn(
              "absolute inset-0 bg-gradient-to-br to-transparent",
              quickStats.currentStreakType === "win" ? "from-rl-green/10 via-rl-green/5" : "from-rl-red/10 via-rl-red/5"
            )} />
            <CardContent className="pt-4 pb-3 relative">
              <Zap className={cn(
                "absolute top-3 right-3 w-4 h-4",
                quickStats.currentStreakType === "win" ? "text-rl-green/30" : "text-rl-red/30"
              )} />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Streak</p>
              <p className={cn(
                "font-display font-bold text-3xl mt-0.5",
                quickStats.currentStreakType === "win" ? "text-rl-green" : quickStats.currentStreakType === "loss" ? "text-rl-red" : "text-foreground"
              )}>
                {quickStats.currentStreakCount > 0
                  ? `${quickStats.currentStreakCount}${quickStats.currentStreakType === "win" ? "W" : "L"}`
                  : "—"}
              </p>
            </CardContent>
          </Card>

          {/* Avg Contribution */}
          <Card className="relative overflow-hidden border-rl-purple/10 animate-fade-in-up">
            <div className="absolute inset-0 bg-gradient-to-br from-rl-purple/10 via-rl-purple/5 to-transparent" />
            <CardContent className="pt-4 pb-3 relative">
              <button onClick={() => setShowContribInfo(true)} className="absolute top-3 right-3 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                <Info className="w-4 h-4" />
              </button>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Contrib</p>
              <p className="font-display font-bold text-3xl mt-0.5 text-rl-purple">
                {quickStats.avgContributionScore !== null ? <CountUp to={Math.round(quickStats.avgContributionScore)} /> : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        <TournamentBannerCard />

        {/* Recent Form */}
        {recentStreak.length > 0 && (
          <Card>
            <CardContent className="pt-3 pb-3 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">Form</span>
              {recentStreak.map((r, i) => (
                <span
                  key={i}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-display transition-all",
                    r === "W"
                      ? "bg-rl-green/20 text-rl-green border border-rl-green/30 shadow-[0_0_10px_hsl(var(--rl-green)/0.2)]"
                      : "bg-rl-red/20 text-rl-red border border-rl-red/30 shadow-[0_0_10px_hsl(var(--rl-red)/0.2)]"
                  )}
                >
                  {r}
                </span>
              ))}
              <Link to="/stats" className="ml-auto">
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1 h-7">
                  All Stats <ChevronRight className="w-3 h-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Recent Games */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-lg">Recent Games</h2>
            <Link to="/stats">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">View All</Button>
            </Link>
          </div>

          {games.length === 0 ? (
            <Card className="border-border/50 bg-card/80 border-dashed">
              <CardContent className="py-12 text-center space-y-6">
                <p className="text-muted-foreground">No games logged yet</p>
                <Link to="/log-game">
                  <Button variant="hero" className="gap-2">
                    <Plus className="w-4 h-4" />
                    Log your first game
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {games.slice(0, visibleCount).map((game) => {
                const players  = game.game_players ?? [];
                const userRow  = players.find(
                  (p) => (userTarget.userId && p.user_id === userTarget.userId) || userTarget.names.includes(normalizeName(p.player_name))
                );
                const isWin      = game.result === "win";
                const isExpanded = expandedGameId === game.id;
                const isEditing  = editingGameId === game.id;
                const userCarry  = userRow?.contribution_score ?? 0;
                const teamSize   = game.game_mode === "1v1" ? 1 : (game.game_mode === "2v2" || game.game_mode === "hoops_2v2" || game.game_mode === "heatseeker_2v2") ? 2 : 3;
                const userTeam   = userRow?.team ?? null;
                const teamGoals  = userTeam !== null ? players.filter(p => p.team === userTeam).reduce((s, p) => s + (p.goals ?? 0), 0) : null;
                const oppGoals   = userTeam !== null ? players.filter(p => p.team !== userTeam && p.team != null).reduce((s, p) => s + (p.goals ?? 0), 0) : null;
                const hasScore         = teamGoals !== null && oppGoals !== null;
                const hasFriendOnTeam  = userTeam !== null && players.some(
                  (p) => p.team === userTeam && p.user_id && p.user_id !== user?.id && friendIds.has(p.user_id)
                );

                // Sort players: user's team first, then opponents; highest contribution first within team
                const userTeamFirst = userTeam ?? "blue";
                const teamOrder     = [userTeamFirst, userTeamFirst === "blue" ? "orange" : "blue"] as const;
                const sortedPlayers = [...players].sort((a, b) => {
                  const aTeam = a.team ?? "blue", bTeam = b.team ?? "blue";
                  const aIdx  = teamOrder.indexOf(aTeam as typeof teamOrder[number]);
                  const bIdx  = teamOrder.indexOf(bTeam as typeof teamOrder[number]);
                  if (aIdx !== bIdx) return aIdx - bIdx;
                  return (b.contribution_score ?? 0) - (a.contribution_score ?? 0);
                });

                return (
                  <Card key={game.id} id={`game-${game.id}`} className={cn(
                    "overflow-hidden transition-all duration-200",
                    isWin ? "border-rl-green/20" : "border-rl-red/20"
                  )}>
                    {/* Colored top stripe */}
                    <div className={cn(
                      "h-0.5 w-full",
                      isWin
                        ? "bg-gradient-to-r from-rl-green/80 via-rl-green/40 to-transparent"
                        : "bg-gradient-to-r from-rl-red/80 via-rl-red/40 to-transparent"
                    )} />
                    {/* Main row */}
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <span className={cn(
                            "w-1.5 h-8 rounded-full flex-shrink-0 mt-0.5",
                            isWin
                              ? "bg-rl-green shadow-[0_0_8px_hsl(var(--rl-green)/0.6)]"
                              : "bg-rl-red shadow-[0_0_8px_hsl(var(--rl-red)/0.6)]"
                          )} />
                          <div className="min-w-0 flex-1">
                            {/* Row 1: WIN/LOSS, score, mode, Div change — the most essential
                                items only. Category and date moved to lower rows so the Div ↑/↓
                                badge never gets clipped on narrow screens. */}
                            <div className="flex items-center gap-1.5 flex-nowrap min-w-0 overflow-hidden">
                              <span className={cn(
                                "font-display font-bold text-sm flex-shrink-0",
                                isWin ? "text-rl-green" : "text-rl-red"
                              )}>{isWin ? "WIN" : "LOSS"}</span>
                              {hasScore && (
                                <span className="font-display font-bold text-sm flex-shrink-0">
                                  <span className={isWin ? "text-rl-green" : "text-rl-red"}>{teamGoals}</span>
                                  <span className="text-muted-foreground mx-0.5">–</span>
                                  <span className="text-muted-foreground">{oppGoals}</span>
                                </span>
                              )}
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">{gameModeLabels[game.game_mode] ?? game.game_mode}</Badge>
                              {game.division_change && game.division_change !== "none" && (
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${
                                    game.division_change === "up"
                                      ? "border-rl-green/50 text-rl-green"
                                      : "border-rl-red/50 text-rl-red"
                                  }`}
                                >
                                  Div {game.division_change === "up" ? "↑" : "↓"}
                                </Badge>
                              )}
                            </div>
                            {/* Row 2: secondary info — category label + small badges (MVP, friend) */}
                            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                              {(() => {
                                const cat = getGameCategory(game as any);
                                const serious = isSeriousCategory(cat);
                                return (
                                  <span className={cn(
                                    "text-[10px] truncate",
                                    serious ? "text-foreground/70 font-semibold" : "text-muted-foreground"
                                  )}>
                                    {GAME_CATEGORY_SHORT_LABELS[cat]}
                                  </span>
                                );
                              })()}
                              {userRow?.is_mvp && (
                                <>
                                  <span className="text-border/60">·</span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400">MVP</span>
                                </>
                              )}
                              {hasFriendOnTeam && (
                                <>
                                  <span className="text-border/60">·</span>
                                  <Users className="w-3 h-3 text-primary/60" />
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 shrink-0">
                          {userRow && (
                            <div className="text-right">
                              <p className="font-mono text-sm font-bold">{userRow.score} pts</p>
                              <p className="text-xs text-muted-foreground">
                                {userRow.goals}G {userRow.assists}A {userRow.saves}SV {userRow.shots != null ? `${userRow.shots}SH` : ""}
                              </p>
                            </div>
                          )}
                          <button
                            onClick={() => setExpandedGameId(isExpanded ? null : game.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors p-1"
                          >
                            {isExpanded
                              ? <ChevronUp className="w-4 h-4" />
                              : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Row 3: date on the left, contribution meter (when applicable) on
                          the right. Full-width so its size doesn't constrain the right-side
                          score column on rows 1 and 2. */}
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="shrink-0">{relativeDate(game.played_at)}</span>
                        {userRow && userCarry > 0 && (
                          <div className="ml-auto flex items-center gap-1.5">
                            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Contribution</span>
                            <button onClick={(e) => { e.stopPropagation(); setShowContribInfo(true); }} className="text-muted-foreground hover:text-foreground transition-colors">
                              <Info className="w-2.5 h-2.5" />
                            </button>
                            <CarryMeter score={userCarry} teamSize={teamSize} size="sm" />
                          </div>
                        )}
                      </div>

                      {/* Expanded player breakdown */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-border/40">
                          {/* Tournament / extra-mode info chip + View full tournament CTA */}
                          {(() => {
                            const cat = getGameCategory(game as any);
                            const tournamentId = (game as any).tournament_games?.[0]?.tournament_id ?? null;
                            const detailLine = (() => {
                              if (cat === "tournament" || cat === "special_tournament") {
                                const ttLabel = (game as any).tournament_type
                                  ? (TOURNAMENT_TYPE_LABELS[(game as any).tournament_type as keyof typeof TOURNAMENT_TYPE_LABELS] ?? (game as any).tournament_type)
                                  : "Tournament";
                                return `${game.game_mode} ${ttLabel}`;
                              }
                              if (cat === "extra_mode") {
                                return EXTRA_MODE_LABELS[game.game_mode as keyof typeof EXTRA_MODE_LABELS] ?? game.game_mode;
                              }
                              return null;
                            })();
                            if (!detailLine) return null;
                            return (
                              <div className="mb-3 space-y-2">
                                <div className={cn(
                                  "px-3 py-1.5 rounded-md border text-[11px] inline-flex items-center gap-1.5",
                                  cat === "tournament"         && "bg-yellow-400/8 border-yellow-400/25 text-yellow-300",
                                  cat === "special_tournament" && "bg-muted/40 border-border/40 text-muted-foreground",
                                  cat === "extra_mode"         && "bg-muted/40 border-border/40 text-muted-foreground",
                                )}>
                                  <span className="font-semibold">{GAME_CATEGORY_LABELS[cat]}</span>
                                  <span className="opacity-60">·</span>
                                  <span>{detailLine}</span>
                                </div>
                                {(cat === "tournament" || cat === "special_tournament") && tournamentId && (
                                  <Link
                                    to={`/stats?view=tournaments&focus=${tournamentId}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className={cn(
                                      "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border transition-colors",
                                      cat === "tournament"
                                        ? "bg-yellow-400/8 border-yellow-400/30 text-yellow-300 hover:bg-yellow-400/15 hover:border-yellow-400/50"
                                        : "bg-card/60 border-border/50 text-foreground hover:bg-card/90 hover:border-border"
                                    )}
                                  >
                                    <span className="text-xs font-semibold">View full tournament stats</span>
                                    <ChevronRight className="w-4 h-4" />
                                  </Link>
                                )}
                              </div>
                            );
                          })()}

                          {/* Scoreboard column headers */}
                          <div className="grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_2rem] gap-x-1 px-2 pb-1.5 mb-0.5 border-b border-border/20">
                            <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">Player</span>
                            <span className="text-[9px] text-muted-foreground font-semibold text-right">Score</span>
                            <span className="text-[9px] text-muted-foreground font-semibold text-right">Goals</span>
                            <span className="text-[9px] text-muted-foreground font-semibold text-right">Assists</span>
                            <span className="text-[9px] text-muted-foreground font-semibold text-right">Saves</span>
                            <span className="text-[9px] text-muted-foreground font-semibold text-right">Shots</span>
                          </div>
                          {teamOrder.map((teamColor) => {
                            const teamRows = sortedPlayers.filter((p) => (p.team ?? "blue") === teamColor);
                            if (teamRows.length === 0) return null;
                            return (
                              <div key={teamColor} className="mb-1">
                                <p className={`text-[10px] font-bold uppercase tracking-wider mt-1.5 mb-0.5 px-2 ${teamColor === "blue" ? "text-blue-400" : "text-orange-400"}`}>
                                  {teamColor}
                                </p>
                                {teamRows.map((p) => {
                                  const isUser = (userTarget.userId && p.user_id === userTarget.userId) || userTarget.names.includes(normalizeName(p.player_name));
                                  return (
                                    <div key={p.id} className={`grid grid-cols-[1fr_2.5rem_2rem_2.5rem_2rem_2rem] gap-x-1 items-start py-1.5 px-2 rounded-md ${isUser ? "bg-primary/5" : ""}`}>
                                      {/* 1fr column: min-w-0 lets CSS grid shrink it; name wraps rather than overflowing */}
                                      <div className="min-w-0">
                                        {isEditing ? (
                                          <Input
                                            value={editValuesMap[p.id]?.player_name ?? p.player_name}
                                            onChange={(e) => setEditValuesMap((prev) => ({
                                              ...prev,
                                              [p.id]: { ...prev[p.id], player_name: e.target.value }
                                            }))}
                                            className="h-6 text-xs px-1"
                                            placeholder="Player name"
                                          />
                                        ) : (
                                          <>
                                            <div className="flex items-center gap-1.5 min-w-0">
                                              {p.user_id && !isUser ? (
                                                <Link
                                                  to={`/profile/${p.user_id}`}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="inline-flex items-center gap-0.5 text-xs font-medium leading-snug break-words min-w-0 text-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:text-primary hover:decoration-primary/60 transition-colors"
                                                >
                                                  {p.player_name}
                                                  <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />
                                                </Link>
                                              ) : (
                                                <span className={`text-xs font-medium leading-snug break-words min-w-0 ${isUser ? "text-primary" : "text-foreground"}`}>
                                                  {p.player_name}
                                                </span>
                                              )}
                                              {p.is_mvp && (
                                                <span className="text-[9px] text-yellow-400 font-bold leading-snug flex-shrink-0">MVP</span>
                                              )}
                                            </div>
                                            {p.contribution_score != null && p.contribution_score > 0 && (
                                              <div className="mt-0.5">
                                                <CarryMeter score={p.contribution_score} teamSize={teamSize} size="sm" />
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                      {/* Stat columns — always top-aligned with the name line */}
                                      {isEditing ? (
                                        (["score", "goals", "assists", "saves", "shots"] as const).map((field) => (
                                          <Input
                                            key={field}
                                            type="number"
                                            min={0}
                                            value={editValuesMap[p.id]?.[field] ?? 0}
                                            onChange={(e) => setEditValuesMap((prev) => ({
                                              ...prev,
                                              [p.id]: { ...prev[p.id], [field]: Number(e.target.value) }
                                            }))}
                                            className="h-6 w-full text-xs px-1 text-right"
                                            title={field}
                                          />
                                        ))
                                      ) : (
                                        <>
                                          <span className="text-xs font-mono font-bold text-right leading-snug">{p.score}</span>
                                          <span className="text-xs font-mono text-muted-foreground text-right leading-snug">{p.goals}</span>
                                          <span className="text-xs font-mono text-muted-foreground text-right leading-snug">{p.assists}</span>
                                          <span className="text-xs font-mono text-muted-foreground text-right leading-snug">{p.saves}</span>
                                          <span className="text-xs font-mono text-muted-foreground text-right leading-snug">{p.shots}</span>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Bottom action row — edit scoreboard + delete */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
                          {/* Left: edit controls */}
                          {isEditing ? (
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleAllStatsSave(game)}
                                className="flex items-center gap-1 text-xs font-medium text-rl-green hover:text-rl-green/80 transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" /> Save All
                              </button>
                              <button
                                onClick={() => { setEditingGameId(null); setEditValuesMap({}); }}
                                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingGameId(game.id);
                                const map: Record<string, PlayerEditValues> = {};
                                (game.game_players ?? []).forEach((p) => {
                                  map[p.id] = { player_name: p.player_name, score: p.score, goals: p.goals, assists: p.assists, saves: p.saves, shots: p.shots };
                                });
                                setEditValuesMap(map);
                              }}
                              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Edit scoreboard
                            </button>
                          )}

                          {/* Right: delete (creator) OR remove-from-profile (any linked non-creator) */}
                          {!isEditing && (() => {
                            const isCreator = game.created_by === user?.id;
                            const isLinkedHere = !!user && (game.game_players ?? []).some(
                              (p) => p.user_id === user.id
                            );
                            if (isCreator) {
                              return confirmDeleteId === game.id ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">Delete this game?</span>
                                  <button
                                    onClick={() => handleDeleteGame(game.id)}
                                    className="text-xs font-medium text-rl-red hover:text-rl-red/80 transition-colors"
                                  >
                                    Yes, delete
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(game.id)}
                                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-rl-red transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete game
                                </button>
                              );
                            }
                            if (isLinkedHere) {
                              return confirmRemoveId === game.id ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">Remove from your profile?</span>
                                  <button
                                    onClick={() => handleRemoveFromProfile(game.id)}
                                    className="text-xs font-medium text-rl-red hover:text-rl-red/80 transition-colors"
                                  >
                                    Yes, remove
                                  </button>
                                  <button
                                    onClick={() => setConfirmRemoveId(null)}
                                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmRemoveId(game.id)}
                                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-rl-red transition-colors"
                                  title="Removes the game from your profile only — other players keep it."
                                >
                                  <XIcon className="w-3.5 h-3.5" />
                                  Remove from my profile
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {games.length > visibleCount && (
                <button
                  onClick={() => setVisibleCount((n) => n + 10)}
                  className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Show more ({games.length - visibleCount} remaining)
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={showContribInfo} onOpenChange={setShowContribInfo}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Contribution Score</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground pt-1">
                <p>
                  Measures how much you contributed relative to your teammates — based on score, goals, assists, and saves. Normalized so <span className="font-semibold text-foreground">equal contribution = 100</span> in every game mode.
                </p>
                <div className="space-y-1.5 rounded-lg bg-muted/30 p-3">
                  <div className="flex justify-between"><span className="font-semibold text-foreground">{">"} 100</span><span>carried more than your share</span></div>
                  <div className="flex justify-between"><span className="font-semibold text-foreground">100</span><span>pulled your exact weight</span></div>
                  <div className="flex justify-between"><span className="font-semibold text-foreground">{"<"} 100</span><span>teammates covered your slack</span></div>
                </div>
                <p className="text-xs">Not shown in 1v1 — no teammates to compare against.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Dashboard;
