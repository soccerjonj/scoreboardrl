import type { RoundKey } from "@/hooks/useTournamentSession";

export type BestGame = {
  date: string;
  gameMode: string;
  gameType: string;
  score: number;
  goals: number;
  assists: number;
  saves: number;
  contributionScore: number;
  isMvp: boolean;
};

export type ActivityGame = {
  id: string;
  result: "win" | "loss";
  gameMode: string;
  gameType: string;
  playedAt: string;
  score: number;
  goals: number;
  assists: number;
  saves: number;
  isMvp: boolean;
};

export type TournamentSummary = {
  totalEntered: number;
  wins: number;
  highestRoundReached: RoundKey | null;
};

export type LeaderboardStanding = {
  stat: string;
  rank: number;
  window: string;
};
