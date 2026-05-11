import { Input } from "@/components/ui/input";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerStat {
  name: string;
  team: "blue" | "orange";
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  damage: number;
  is_mvp: boolean;
}

interface PlayerStatsEditorProps {
  players: PlayerStat[];
  onChange: (players: PlayerStat[]) => void;
  userRlName?: string | null;
  /** When true, replaces the "shots" field with a "damage" field (Dropshot mode) */
  showDamage?: boolean;
}

const STAT_COLS: Array<{ key: keyof PlayerStat; label: string }> = [
  { key: "score",   label: "SCR" },
  { key: "goals",   label: "G"   },
  { key: "assists", label: "A"   },
  { key: "saves",   label: "SV"  },
  { key: "shots",   label: "SH"  },
];

const PlayerStatsEditor = ({ players, onChange, userRlName, showDamage = false }: PlayerStatsEditorProps) => {
  const updatePlayer = (index: number, field: keyof PlayerStat, value: any) => {
    const updated = [...players];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const blueTeam   = players.filter((p) => p.team === "blue");
  const orangeTeam = players.filter((p) => p.team === "orange");

  const lastColKey: keyof PlayerStat = showDamage ? "damage" : "shots";
  const lastColLabel = showDamage ? "DMG" : "SH";

  const renderTeam = (
    team: PlayerStat[],
    teamLabel: string,
    accent: { stripe: string; label: string; bg: string },
  ) => (
    <div className={cn("rounded-xl border border-border/40 overflow-hidden", accent.bg)}>
      {/* Team header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-card/60">
        <div className="flex items-center gap-2">
          <div className={cn("w-1.5 h-4 rounded-sm", accent.stripe)} />
          <span className={cn("text-[11px] font-semibold uppercase tracking-wider", accent.label)}>
            {teamLabel}
          </span>
        </div>
        {/* Column labels — aligned with the stat inputs in each row below */}
        <div className="grid grid-cols-5 gap-1 text-[9px] uppercase tracking-wider text-muted-foreground/70 w-[180px] sm:w-[210px] text-center">
          {STAT_COLS.slice(0, 4).map((c) => (
            <span key={c.key}>{c.label}</span>
          ))}
          <span>{lastColLabel}</span>
        </div>
      </div>

      {/* Players */}
      <div className="divide-y divide-border/30">
        {team.map((player) => {
          const globalIndex = players.indexOf(player);
          const isUser =
            !!userRlName && player.name.toLowerCase() === userRlName.toLowerCase();

          return (
            <div
              key={globalIndex}
              className={cn(
                "px-2.5 py-2 flex items-center gap-2",
                isUser && "bg-primary/5",
              )}
            >
              {/* MVP toggle */}
              <button
                type="button"
                onClick={() => updatePlayer(globalIndex, "is_mvp", !player.is_mvp)}
                className={cn(
                  "shrink-0 p-1 rounded transition-colors",
                  player.is_mvp
                    ? "text-yellow-400"
                    : "text-muted-foreground/40 hover:text-muted-foreground"
                )}
                title="MVP"
                aria-label="Toggle MVP"
              >
                <Star className={cn("w-4 h-4", player.is_mvp && "fill-current")} />
              </button>

              {/* Name */}
              <Input
                value={player.name}
                onChange={(e) => updatePlayer(globalIndex, "name", e.target.value)}
                className={cn(
                  "h-7 min-w-0 flex-1 text-xs px-2 font-semibold",
                  isUser && "border-primary/40"
                )}
                placeholder="Player name"
              />

              {/* Stat inputs — fixed width grid lines up with the header labels */}
              <div className="grid grid-cols-5 gap-1 shrink-0 w-[180px] sm:w-[210px]">
                {STAT_COLS.slice(0, 4).map((col) => (
                  <Input
                    key={col.key}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={player[col.key] as number}
                    onChange={(e) =>
                      updatePlayer(globalIndex, col.key, parseInt(e.target.value) || 0)
                    }
                    className="h-7 px-1 text-xs text-center tabular-nums"
                  />
                ))}
                {/* Shots OR Damage */}
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={(player[lastColKey] as number) ?? 0}
                  onChange={(e) =>
                    updatePlayer(globalIndex, lastColKey, parseInt(e.target.value) || 0)
                  }
                  className="h-7 px-1 text-xs text-center tabular-nums"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground leading-snug">
        Review parsed stats before saving. Tap the star to flag MVP.
      </p>
      {blueTeam.length > 0 &&
        renderTeam(blueTeam, "Blue Team", {
          stripe: "bg-primary",
          label: "text-primary",
          bg: "bg-primary/[0.03]",
        })}
      {orangeTeam.length > 0 &&
        renderTeam(orangeTeam, "Orange Team", {
          stripe: "bg-rl-orange",
          label: "text-rl-orange",
          bg: "bg-rl-orange/[0.04]",
        })}
    </div>
  );
};

export default PlayerStatsEditor;
