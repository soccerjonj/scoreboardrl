import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type TournamentType = "soccar" | "pentathlon" | "heatseeker" | "rumble";
export type RoundKey = "round_1" | "round_2" | "quarter_final" | "semi_final" | "final";
export type GameMode = Database["public"]["Enums"]["game_mode"];

export type Tournament = Database["public"]["Tables"]["tournaments"]["Row"];
export type TournamentGame = Database["public"]["Tables"]["tournament_games"]["Row"];

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
  const [loading, setLoading] = useState(true);

  // ── Load active tournament on mount ─────────────────────────────────────
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const storedId = localStorage.getItem(ACTIVE_TOURNAMENT_KEY);
    if (!storedId) { setLoading(false); return; }

    const load = async () => {
      const { data: t } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", storedId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (!t) {
        localStorage.removeItem(ACTIVE_TOURNAMENT_KEY);
        setLoading(false);
        return;
      }
      setActiveTournament(t);

      const { data: tg } = await supabase
        .from("tournament_games")
        .select("*")
        .eq("tournament_id", storedId);
      setTournamentGames(tg ?? []);
      setLoading(false);
    };
    load();
  }, [user]);

  // ── Start a new tournament ───────────────────────────────────────────────
  const startTournament = useCallback(
    async (gameMode: GameMode, tournamentType: TournamentType) => {
      if (!user) return;
      const { data, error } = await supabase
        .from("tournaments")
        .insert({ user_id: user.id, game_mode: gameMode, tournament_type: tournamentType })
        .select()
        .single();
      if (error || !data) throw error;
      localStorage.setItem(ACTIVE_TOURNAMENT_KEY, data.id);
      setActiveTournament(data);
      setTournamentGames([]);
    },
    [user]
  );

  // ── Link a game to the active tournament and advance/eliminate ───────────
  const linkGame = useCallback(
    async (gameId: string, result: "win" | "loss"): Promise<LinkGameResult> => {
      if (!activeTournament) throw new Error("No active tournament");
      const round = activeTournament.current_round as RoundKey;

      // Count existing games in this round
      const roundGames = tournamentGames.filter((tg) => tg.round === round);
      const gameNumber = roundGames.length + 1;

      // Insert tournament_games row
      const { data: tgRow } = await supabase
        .from("tournament_games")
        .insert({ tournament_id: activeTournament.id, game_id: gameId, round, game_number: gameNumber })
        .select()
        .single();

      const newTournamentGames = tgRow ? [...tournamentGames, tgRow] : tournamentGames;
      setTournamentGames(newTournamentGames);

      if (isBo3(round)) {
        // Count wins/losses in this round after this game
        const roundResults = newTournamentGames.filter((tg) => tg.round === round);
        // We need game results — fetch them
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
            // Won the Final
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
        // Single-match round
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
          // Shouldn't happen (Final is Bo3), but guard
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

  // ── End session manually (abandon) ──────────────────────────────────────
  const endSession = useCallback(async () => {
    if (!activeTournament) return;
    await supabase
      .from("tournaments")
      .update({ status: "completed", outcome: "eliminated" })
      .eq("id", activeTournament.id);
    setActiveTournament(null);
    setTournamentGames([]);
    localStorage.removeItem(ACTIVE_TOURNAMENT_KEY);
  }, [activeTournament]);

  // ── Series score for current Bo3 round ──────────────────────────────────
  const currentRound = activeTournament?.current_round as RoundKey | undefined;
  const currentRoundGames = tournamentGames.filter(
    (tg) => activeTournament && tg.tournament_id === activeTournament.id && tg.round === currentRound
  );

  return {
    activeTournament,
    tournamentGames,
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
