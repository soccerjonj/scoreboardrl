import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Crown, Users2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";

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
  game_players: GamePlayer[];
};

type MemberAgg = {
  userId: string;
  displayName: string;
  isViewer: boolean;
  gamesCount: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  mvps: number;
  scoreTotal: number;
  contribTotal: number;
  contribCount: number;
};

type StatDef = {
  key: string;
  label: string;
  description: string;
  /** Compute this member's value for the stat. Returns null if not computable (e.g. divide-by-zero). */
  compute: (m: MemberAgg) => number | null;
  /** Pretty-print the value. */
  format: (v: number) => string;
};

const STAT_DEFS: StatDef[] = [
  {
    key: "scorePerGame",
    label: "Score / game",
    description: "Average game score — RL's overall performance metric.",
    compute: (m) => m.gamesCount > 0 ? m.scoreTotal / m.gamesCount : null,
    format: (v) => v.toFixed(0),
  },
  {
    key: "contribAvg",
    label: "Avg contribution",
    description: "Share of team contribution per game (~33% is fair share in a 3v3, ~50% in a 2v2).",
    compute: (m) => m.contribCount > 0 ? m.contribTotal / m.contribCount : null,
    format: (v) => `${v.toFixed(1)}%`,
  },
  {
    key: "goalsPerGame",
    label: "Goals / game",
    description: "Average goals scored each game.",
    compute: (m) => m.gamesCount > 0 ? m.goals / m.gamesCount : null,
    format: (v) => v.toFixed(2),
  },
  {
    key: "assistsPerGame",
    label: "Assists / game",
    description: "Average assists each game.",
    compute: (m) => m.gamesCount > 0 ? m.assists / m.gamesCount : null,
    format: (v) => v.toFixed(2),
  },
  {
    key: "savesPerGame",
    label: "Saves / game",
    description: "Average saves each game.",
    compute: (m) => m.gamesCount > 0 ? m.saves / m.gamesCount : null,
    format: (v) => v.toFixed(2),
  },
  {
    key: "shotsPerGame",
    label: "Shots / game",
    description: "Average shots on goal each game.",
    compute: (m) => m.gamesCount > 0 ? m.shots / m.gamesCount : null,
    format: (v) => v.toFixed(2),
  },
  {
    key: "shootingAccuracy",
    label: "Shooting accuracy",
    description: "Goals as a percentage of shots taken.",
    compute: (m) => m.shots > 0 ? (m.goals / m.shots) * 100 : null,
    format: (v) => `${v.toFixed(0)}%`,
  },
  {
    key: "mvpRate",
    label: "MVP rate",
    description: "Percentage of games this teammate earned MVP.",
    compute: (m) => m.gamesCount > 0 ? (m.mvps / m.gamesCount) * 100 : null,
    format: (v) => `${v.toFixed(0)}%`,
  },
];

const SquadCompare = () => {
  const { id: squadId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [squadName, setSquadName] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberAgg[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [wins, setWins] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || !squadId) return;
    (async () => {
      setLoading(true);
      try {
        // 1. Fetch squad metadata + members
        const { data: squad, error: squadErr } = await supabase
          .from("squads")
          .select("id, name, squad_members(member_user_id)")
          .eq("id", squadId)
          .single();
        if (squadErr || !squad) throw squadErr ?? new Error("Squad not found");
        setSquadName(squad.name);

        const memberIds: string[] = [
          user.id,
          ...((squad as any).squad_members ?? []).map((m: any) => m.member_user_id),
        ];

        // 2. Fetch profile names
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, rl_account_name, username")
          .in("user_id", memberIds);
        const nameMap = new Map<string, string>();
        (profiles ?? []).forEach((p: any) =>
          nameMap.set(p.user_id, p.rl_account_name ?? p.username ?? "Unknown")
        );

        // 3. Find together-games (same logic as SquadCard.loadDetail)
        const { data: viewerRows } = await supabase
          .from("game_players")
          .select("game_id")
          .eq("user_id", user.id);
        const candidateIds = (viewerRows ?? []).map((r) => r.game_id);
        if (candidateIds.length === 0) {
          setMembers(memberIds.map((uid) => emptyAgg(uid, nameMap.get(uid) ?? "Unknown", uid === user.id)));
          setTotalGames(0); setWins(0);
          return;
        }

        const { data: memberRows } = await supabase
          .from("game_players")
          .select("game_id, user_id, team")
          .in("game_id", candidateIds)
          .in("user_id", memberIds);

        const byGame = new Map<string, Map<string, string | null>>();
        (memberRows ?? []).forEach((r: any) => {
          if (!byGame.has(r.game_id)) byGame.set(r.game_id, new Map());
          byGame.get(r.game_id)!.set(r.user_id, r.team ?? null);
        });
        const togetherIds: string[] = [];
        byGame.forEach((teams, gid) => {
          if (teams.size !== memberIds.length) return;
          const teamSet = new Set(teams.values());
          if (teamSet.size === 1 && !teamSet.has(null)) togetherIds.push(gid);
        });

        if (togetherIds.length === 0) {
          setMembers(memberIds.map((uid) => emptyAgg(uid, nameMap.get(uid) ?? "Unknown", uid === user.id)));
          setTotalGames(0); setWins(0);
          return;
        }

        // 4. Fetch the full together-games with all player rows
        const { data: gamesData } = await supabase
          .from("games")
          .select("id, result, played_at, game_players(user_id, player_name, team, score, goals, assists, saves, shots, is_mvp, contribution_score)")
          .in("id", togetherIds);
        const games = (gamesData ?? []) as GameRow[];

        // 5. Aggregate per member across together-games
        const aggMap = new Map<string, MemberAgg>();
        memberIds.forEach((uid) => {
          aggMap.set(uid, emptyAgg(uid, nameMap.get(uid) ?? "Unknown", uid === user.id));
        });
        games.forEach((g) => {
          g.game_players.forEach((p) => {
            if (!p.user_id) return;
            const m = aggMap.get(p.user_id);
            if (!m) return;
            m.gamesCount += 1;
            m.goals      += p.goals   ?? 0;
            m.assists    += p.assists ?? 0;
            m.saves      += p.saves   ?? 0;
            m.shots      += p.shots   ?? 0;
            m.mvps       += p.is_mvp ? 1 : 0;
            m.scoreTotal += p.score   ?? 0;
            const cs = p.contribution_score;
            if (typeof cs === "number" && !Number.isNaN(cs)) {
              m.contribTotal += cs;
              m.contribCount += 1;
            }
            // displayName fallback to whatever name appears in the games
            if (m.displayName === "Unknown" && p.player_name) {
              m.displayName = p.player_name;
            }
          });
        });

        setMembers(Array.from(aggMap.values()));
        setTotalGames(games.length);
        setWins(games.filter((g) => g.result === "win").length);
      } catch (err: any) {
        toast({ title: "Couldn't load comparison", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [user, squadId, toast]);

  const eligibleMembers = useMemo(
    () => members.filter((m) => m.gamesCount > 0),
    [members]
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

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Users2 className="w-5 h-5 text-primary shrink-0" />
            <h1 className="font-display text-2xl font-bold truncate">
              {squadName ? `${squadName} · Comparison` : "Squad Comparison"}
            </h1>
          </div>
          {totalGames > 0 ? (
            <p className="text-xs text-muted-foreground">
              {totalGames} game{totalGames === 1 ? "" : "s"} together ·{" "}
              <span className="text-rl-green font-bold">{wins}W</span>{" "}
              <span className="text-rl-red font-bold">{totalGames - wins}L</span>
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No together-games yet.</p>
          )}
        </div>

        {/* Empty state */}
        {eligibleMembers.length === 0 ? (
          <Card className="border-border/50 bg-card/80 border-dashed">
            <CardContent className="py-10 text-center space-y-2">
              <Users2 className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">No data to compare yet</p>
              <p className="text-xs text-muted-foreground/60">
                Log a game with this lineup to start tracking head-to-head stats.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {STAT_DEFS.map((stat) => (
              <StatSection key={stat.key} stat={stat} members={eligibleMembers} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

function emptyAgg(userId: string, displayName: string, isViewer: boolean): MemberAgg {
  return {
    userId, displayName, isViewer,
    gamesCount: 0, goals: 0, assists: 0, saves: 0, shots: 0, mvps: 0,
    scoreTotal: 0, contribTotal: 0, contribCount: 0,
  };
}

function StatSection({ stat, members }: { stat: StatDef; members: MemberAgg[] }) {
  // Compute each member's value, filter out non-applicable, sort desc
  const rows = members
    .map((m) => ({ member: m, value: stat.compute(m) }))
    .filter((r): r is { member: MemberAgg; value: number } => r.value !== null);
  rows.sort((a, b) => b.value - a.value);

  if (rows.length === 0) return null;

  const max = rows[0].value;
  const leaderId = rows[0].member.userId;

  return (
    <Card className="border-border/40 bg-card/60">
      <CardContent className="py-4 px-4 space-y-3">
        <div>
          <p className="text-xs font-display font-bold uppercase tracking-wider text-foreground">
            {stat.label}
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{stat.description}</p>
        </div>

        <div className="space-y-2">
          {rows.map(({ member, value }) => {
            const pct = max > 0 ? (value / max) * 100 : 0;
            const isLeader = member.userId === leaderId;
            return (
              <div
                key={member.userId}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg border",
                  member.isViewer ? "bg-primary/5 border-primary/30" : "bg-card/40 border-border/30"
                )}
              >
                {/* Name + leader crown */}
                <div className="flex items-center gap-1.5 w-24 sm:w-32 shrink-0 min-w-0">
                  {isLeader && <Crown className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                  <span className={cn(
                    "text-xs sm:text-sm font-display font-bold truncate",
                    member.isViewer ? "text-primary" : "text-foreground"
                  )}>
                    {member.displayName}
                  </span>
                </div>

                {/* Bar */}
                <div className="flex-1 min-w-0 h-5 sm:h-6 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      isLeader
                        ? "bg-gradient-to-r from-yellow-400/90 to-yellow-400/60"
                        : member.isViewer
                          ? "bg-gradient-to-r from-primary/80 to-primary/40"
                          : "bg-gradient-to-r from-foreground/40 to-foreground/20"
                    )}
                    style={{ width: `${Math.max(pct, 4)}%` }}
                  />
                </div>

                {/* Value */}
                <span className="text-sm sm:text-base font-mono font-bold tabular-nums text-foreground/90 w-14 sm:w-20 text-right shrink-0">
                  {stat.format(value)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default SquadCompare;
