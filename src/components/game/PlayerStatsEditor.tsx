import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";

interface PlayerStat {
  name: string;
  team: "blue" | "orange";
  score: number;
  goals: number;
  assists: number;
  saves: number;
  shots: number;
  is_mvp: boolean;
}

interface PlayerStatsEditorProps {
  players: PlayerStat[];
  onChange: (players: PlayerStat[]) => void;
  userRlName?: string | null;
}

const PlayerStatsEditor = ({ players, onChange, userRlName }: PlayerStatsEditorProps) => {
  const updatePlayer = (index: number, field: keyof PlayerStat, value: any) => {
    const updated = [...players];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const blueTeam = players.filter((p) => p.team === "blue");
  const orangeTeam = players.filter((p) => p.team === "orange");

  const renderTeam = (team: PlayerStat[], teamName: string, teamColor: string) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${teamColor}`} />
        <h4 className="font-display font-semibold text-sm uppercase tracking-wider">
          {teamName} Team
        </h4>
      </div>

      {team.map((player) => {
        const globalIndex = players.indexOf(player);
        const isUser = userRlName && player.name.toLowerCase() === userRlName.toLowerCase();

        return (
          <div
            key={globalIndex}
            className={`rounded-lg border p-3 space-y-3 ${
              isUser
                ? "border-primary/50 bg-primary/5"
                : "border-border/50 bg-card/50"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Input
                  value={player.name}
                  onChange={(e) => updatePlayer(globalIndex, "name", e.target.value)}
                  className="h-8 w-40 text-sm font-semibold"
                />
                {isUser && (
                  <Badge variant="secondary" className="text-xs">You</Badge>
                )}
              </div>
              <button
                type="button"
                onClick={() => updatePlayer(globalIndex, "is_mvp", !player.is_mvp)}
                className={`p-1 rounded transition-colors ${
                  player.is_mvp ? "text-secondary" : "text-muted-foreground hover:text-secondary"
                }`}
                title="MVP"
              >
                <Star className={`w-5 h-5 ${player.is_mvp ? "fill-current" : ""}`} />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {(["score", "goals", "assists", "saves", "shots"] as const).map((stat) => (
                <div key={stat} className="space-y-1">
                  <Label className="text-xs text-muted-foreground capitalize">{stat}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={player[stat]}
                    onChange={(e) => updatePlayer(globalIndex, stat, parseInt(e.target.value) || 0)}
                    className="h-8 text-sm text-center"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Review and correct the parsed stats before saving. Click the star to toggle MVP.
      </p>
      {blueTeam.length > 0 && renderTeam(blueTeam, "Blue", "bg-primary")}
      {orangeTeam.length > 0 && renderTeam(orangeTeam, "Orange", "bg-secondary")}
    </div>
  );
};

export default PlayerStatsEditor;
