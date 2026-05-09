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

export type ActivityGamePlayer = {
  userId: string | null;
  playerName: string;
  score: number;
  goals: number;
  assists: number;
  saves: number;
  isMvp: boolean;
  team: string | null;
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
  allPlayers: ActivityGamePlayer[];
  teamGoals: number | null;
  opponentGoals: number | null;
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

export type ChartPoint = {
  index: number;
  score: number;  // repurposed as the y-axis value (MMR or score depending on context)
  date: string;
  gameMode?: string; // which ranked mode this MMR point belongs to
};

export type TeammateProfile = {
  userId: string;
  name: string;
  games: number;
  wins: number;
  avatarUrl: string | null;
};
