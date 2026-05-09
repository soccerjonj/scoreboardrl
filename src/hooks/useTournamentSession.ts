import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type TournamentType = "soccar" | "pentathlon" | "heatseeker" | "rumble";
export type RoundKey = "round_1" | "round_2" | "quarter_final" | "semi_final" | "final";
export type GameMode = Database["public"]["Enums"]["game_mode"];

export type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];
export type TournamentGame = Database["public"]["Tables"]["tournament_games"]["Row"];
export type TournamentParticipant = Database["public"]["Tables"]["tournament_participants"]["Row"];

export const ROUND_ORDER: RoundKey[] = [
  "round_1",
  "round_2",
  "quarter_final",
  "semi_final",
  "final",
];

export const ROUND_LABELS: Record<RoundKey, string> = {
  round_1: "Round 1",
  round_2: "Round 2",
  quarter_final: "Quarter-Final",
  semi_final: "Semi-Final",
  final: "Final",
};

export const ROUND_SHORT: Record<RoundKey, string> = {
  round_1: "R1",
  round_2: "R2",
  quarter_final: "QF",
  semi_final: "SF",
  final: "F",
};

export const TOURNAMENT_TYPE_LABELS: Record<TournamentType, string> = {
  soccar: "Soccar",
  pentathlon: "Pentathlon",
  heatseeker: "Heatseeker",
  rumble: "Rumble",
};

const BO3_ROUNDS: RoundKey[] = ["semi_final", "final"];
const ACTIVE_TOURNAMENT_KEY = "activeTournamentId";

function nextRound(round: RoundKey): RoundKey | null {
  const idx = ROUND_ORDER.indexOf(round);
  return idx < ROUND_ORDER.length - 1 ? ROUND_ORDER[idx + 1] : null;
}

function isBo3(round: RoundKey) {
  return BO3_ROUNDS.includes(round);
}

export type LinkGameResult =
  | { action: "advanced"; nextRound: RoundKey }
  | { action: "eliminated"; round: RoundKey }
  | { action: "bo3_continue"; wins: number; losses: number; round: RoundKey }
  | { action: "champion" };

export function useTournamentSession() {
  const { user } = useAuth();
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [tournamentGames, setTournamentGames] = useState<TournamentGame[]>([]);
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  const activeTournamentRef = useRef<Tournament | null>(null);
  activeTournamentRef.current = activeTournament;

  // ── Helper: load a specific tournament + its games + roster ──────────────
  const loadTournament = useCallback(async (tournamentId: string) => {
    const [{ data: t }, { data: tg }, { data: tp }] = await Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).single(),
      supabase.from("tournament_games").select("*").eq("tournament_id", tournamentId),
      supabase.from("tournament_participants").select("*").eq("tournament_id", tournamentId),
    ]);
    if (!t || t.status !== "active") {
      localStorage.removeItem(ACTIVE_TOURNAMENT_KEY);
      setActiveTournament(null);
      setTournamentGames([]);
      setParticipants([]);
      return;
    }
    localStorage.setItem(ACTIVE_TOURNAMENT_KEY, t.id);
    setActiveTournament(t);
    setTournamentGames(tg ?? []);
    setParticipants(tp ?? []);
  }, []);

  // ── Bootstrap: find any active tournament where I'm a participant ────────
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const load = async () => {
      // Find tournaments where I'm a participant; pick the most recent active
      const { data: tps } = await supabase
        .from("tournament_participants")
        .select("tournament_id, tournaments!inner(id, status, created_at)")
        .eq("user_id", user.id)
        .eq("tournaments.status", "active")
        .order("created_at", { foreignTable: "tournaments", ascending: false })
        .limit(1);

      const tournamentId = tps?.[0]?.tournament_id;
      if (!tournamentId) {
        localStorage.removeItem(ACTIVE_TOURNAMENT_KEY);
        setActiveTournament(null);
        setTournamentGames([]);
        setParticipants([]);
        setLoading(false);
        return;
      }
      await loadTournament(tournamentId);
      setLoading(false);
    };
    load();
  }, [user, loadTournament]);

  // ── Realtime: react to participant additions, tournament updates, new games
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`tournament-${user.id}`)
      // 1. I was just added to a new tournament → activate it
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "tournament_participants",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const tournamentId = payload?.new?.tournament_id;
          if (tournamentId) loadTournament(tournamentId);
        }
      )
      // 2. Active tournament's status / current_round / outcome changed
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tournaments" },
        (payload: any) => {
          const t = activeTournamentRef.current;
          if (!t || payload?.new?.id !== t.id) return;
          if (payload.new.status === "completed") {
            localStorage.removeItem(ACTIVE_TOURNAMENT_KEY);
            setActiveTournament(null);
            setTournamentGames([]);
            setParticipants([]);
          } else {
            setActiveTournament(payload.new);
          }
        }
      )
      // 3. New game linked to my active tournament → append
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tournament_games" },
        (payload: any) => {
          const t = activeTournamentRef.current;
          if (!t || payload?.new?.tournament_id !== t.id) return;
          setTournamentGames((prev) =>
            prev.some((tg) => tg.id === payload.new.id) ? prev : [...prev, payload.new as TournamentGame]
          );
        }
      )
      // 4. Roster change → keep participants in sync
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tournament_participants" },
        (payload: any) => {
          const t = activeTournamentRef.current;
          const tournamentId = (payload?.new?.tournament_id ?? payload?.old?.tournament_id) as string | undefined;
          if (!t || !tournamentId || tournamentId !== t.id) return;
          if (payload.eventType === "INSERT") {
            setParticipants((prev) =>
              prev.some((p) => p.id === payload.new.id) ? prev : [...prev, payload.new as TournamentParticipant]
            );
          } else if (payload.eventType === "DELETE") {
            setParticipants((prev) => prev.filter((p) => p.id !== payload.old.id));
            // If I was the one removed, clear local state
            if (payload.old.user_id === user.id) {
              localStorage.removeItem(ACTIVE_TOURNAMENT_KEY);
              setActiveTournament(null);
              setTournamentGames([]);
              setParticipants([]);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, loadTournament]);

  // ── Start a new tournament (optionally with friend partners) ─────────────
  const startTournament = useCallback(
    async (gameMode: GameMode, tournamentType: TournamentType, partnerUserIds: string[] = []) => {
      if (!user) return;

      // 1. Insert tournament row
      const { data: t, error: tErr } = await supabase
        .from("tournaments")
        .insert({ user_id: user.id, game_mode: gameMode, tournament_type: tournamentType })
        .select()
        .single();
      if (tErr || !t) throw tErr;

      // 2. Insert participant rows: owner + partners
      const participantRows = [
        { tournament_id: t.id, user_id: user.id, is_owner: true },
        ...partnerUserIds.map((pid) => ({ tournament_id: t.id, user_id: pid, is_owner: false })),
      ];
      const { data: tps } = await supabase
        .from("tournament_participants")
        .insert(participantRows)
        .select();

      // 3. Send invite notifications to partners (best-effort, fire-and-forget)
      if (partnerUserIds.length > 0) {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("rl_account_name, username")
          .eq("user_id", user.id)
          .single();
        const ownerName = ownerProfile?.rl_account_name ?? ownerProfile?.username ?? "A friend";
        const typeLabel = TOURNAMENT_TYPE_LABELS[tournamentType];
        await Promise.all(
          partnerUserIds.map((pid) =>
            supabase.from("notifications").insert({
              user_id: pid,
              type: "tournament_invite",
              title: `${ownerName} started a tournament with you`,
              body: `${gameMode} ${typeLabel} — Tournament Mode is now active.`,
              payload: { tournament_id: t.id },
            })
          )
        );
      }

      localStorage.setItem(ACTIVE_TOURNAMENT_KEY, t.id);
      setActiveTournament(t);
      setTournamentGames([]);
      setParticipants(tps ?? []);
    },
    [user]
  );

  // ── Link a game to the active tournament and advance/eliminate ───────────
  const linkGame = useCallback(
    async (gameId: string, result: "win" | "loss"): Promise<LinkGameResult> => {
      if (!activeTournament) throw new Error("No active tournament");
      const round = activeTournament.current_round as RoundKey;

      // Refetch the tournament_games for this round so we get a server-truth
      // game_number even if our local state is stale (e.g. partner just inserted)
      const { data: serverRoundGames } = await supabase
        .from("tournament_games")
        .select("*")
        .eq("tournament_id", activeTournament.id)
        .eq("round", round);
      const gameNumber = (serverRoundGames?.length ?? 0) + 1;

      const { data: tgRow } = await supabase
        .from("tournament_games")
        .insert({ tournament_id: activeTournament.id, game_id: gameId, round, game_number: gameNumber })
        .select()
        .single();

      const newTournamentGames = tgRow ? [...tournamentGames, tgRow] : tournamentGames;
      setTournamentGames(newTournamentGames);

      if (isBo3(round)) {
        const roundResults = newTournamentGames.filter((tg) => tg.round === round);
        const roundGameIds = roundResults.map((tg) => tg.game_id);
        const { data: roundGamesData } = await supabase
          .from("games")
          .select("id, result")
          .in("id", roundGameIds);
        const wins = (roundGamesData ?? []).filter((g) => g.result === "win").length;
        const losses = (roundGamesData ?? []).filter((g) => g.result === "loss").length;

        if (wins >= 2) {
          const next = nextRound(round);
          if (!next) {
            await supabase
              .from("tournaments")
              .update({ status: "completed", outcome: "winner" })
              .eq("id", activeTournament.id);
            setActiveTournament(null);
            localStorage.removeItem(ACTIVE_TOURNAMENT_KEY);
            return { action: "champion" };
          }
          await supabase
            .from("tournaments")
            .update({ current_round: next })
            .eq("id", activeTournament.id);
          setActiveTournament((prev) => prev ? { ...prev, current_round: next } : prev);
          return { action: "advanced", nextRound: next };
        } else if (losses >= 2) {
          await supabase
            .from("tournaments")
            .update({ status: "completed", outcome: "eliminated" })
            .eq("id", activeTournament.id);
          setActiveTournament(null);
          localStorage.removeItem(ACTIVE_TOURNAMENT_KEY);
          return { action: "eliminated", round };
        } else {
          return { action: "bo3_continue", wins, losses, round };
        }
      } else {
        if (result === "win") {
          const next = nextRound(round);
          if (next) {
            await supabase
              .from("tournaments")
              .update({ current_round: next })
              .eq("id", activeTournament.id);
            setActiveTournament((prev) => prev ? { ...prev, current_round: next } : prev);
            return { action: "advanced", nextRound: next };
          }
          await supabase
            .from("tournaments")
            .update({ status: "completed", outcome: "winner" })
            .eq("id", activeTournament.id);
          setActiveTournament(null);
          localStorage.removeItem(ACTIVE_TOURNAMENT_KEY);
          return { action: "champion" };
        } else {
          await supabase
            .from("tournaments")
            .update({ status: "completed", outcome: "eliminated" })
            .eq("id", activeTournament.id);
          setActiveTournament(null);
          localStorage.removeItem(ACTIVE_TOURNAMENT_KEY);
          return { action: "eliminated", round };
        }
      }
    },
    [activeTournament, tournamentGames]
  );

  // ── End session (owner only) ──────────────────────────────────────────────
  // For partners, this becomes a "leave" — we delete their own participant row.
  const endSession = useCallback(async () => {
    if (!activeTournament || !user) return;
    const isOwner = activeTournament.user_id === user.id;
    if (isOwner) {
      // Owner ends the whole tournament for everyone
      await supabase
        .from("tournaments")
        .update({ status: "completed", outcome: "eliminated" })
        .eq("id", activeTournament.id);
    } else {
      // Partner leaves — owner + remaining partners continue
      await supabase
        .from("tournament_participants")
        .delete()
        .eq("tournament_id", activeTournament.id)
        .eq("user_id", user.id);
    }
    setActiveTournament(null);
    setTournamentGames([]);
    setParticipants([]);
    localStorage.removeItem(ACTIVE_TOURNAMENT_KEY);
  }, [activeTournament, user]);

  // ── Series score for current Bo3 round ──────────────────────────────────
  const currentRound = activeTournament?.current_round as RoundKey | undefined;
  const currentRoundGames = tournamentGames.filter(
    (tg) => activeTournament && tg.tournament_id === activeTournament.id && tg.round === currentRound
  );

  const isOwner = !!(activeTournament && user && activeTournament.user_id === user.id);

  return {
    activeTournament,
    tournamentGames,
    participants,
    isOwner,
    currentRound: currentRound ?? null,
    currentRoundGameCount: currentRoundGames.length,
    isActive: !!activeTournament,
    isBo3Round: currentRound ? isBo3(currentRound) : false,
    loading,
    startTournament,
    linkGame,
    endSession,
  };
}
