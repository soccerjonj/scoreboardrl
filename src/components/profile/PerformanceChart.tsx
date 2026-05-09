import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

const MODE_COLORS: Record<string, string> = {
  "1v1": "hsl(271, 81%, 65%)",
  "2v2": "hsl(212, 95%, 58%)",
  "3v3": "hsl(142, 71%, 45%)",
};

type Point = Record<string, string | number | null>;

type Props = {
  points: Point[];
  activeModes: string[];
};

function CustomTooltip({ active, payload, color }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  if (p.value == null) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 backdrop-blur-sm px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-bold" style={{ color }}>{p.value} MMR</p>
      <p className="text-muted-foreground">{p.payload?.fullLabel ?? p.payload?.label}</p>
    </div>
  );
}

function ModeChart({ mode, points }: { mode: string; points: Point[] }) {
  // Only the dates where this mode actually had a game — no carry-forward filler.
  // This means the chart spans exactly first→last game for this mode.
  const modePoints = points
    .filter((p) => p[mode] != null)
    .map((p) => ({
      label:     p.label     as string,
      fullLabel: p.fullLabel as string,
      mmr:       p[mode]     as number,
    }));

  if (modePoints.length < 2) return null;

  const color = MODE_COLORS[mode] ?? "hsl(var(--primary))";
  const vals  = modePoints.map((p) => p.mmr);
  const minY  = Math.max(0, Math.min(...vals) - 30);
  const maxY  = Math.max(...vals) + 30;

  const recent   = vals.slice(-3).reduce((s, v) => s + v, 0) / Math.min(3, vals.length);
  const prior    = vals.slice(-6, -3);
  const priorAvg = prior.length > 0 ? prior.reduce((s, v) => s + v, 0) / prior.length : recent;
  const trending = recent >= priorAvg;
  const delta    = Math.round(vals[vals.length - 1] - vals[0]);

  return (
    <div className="space-y-1">
      {/* Mode header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-xs font-semibold text-foreground">{mode}</span>
          <span className="text-[10px] text-muted-foreground">{modePoints.length} games</span>
        </div>
        <div className="flex items-center gap-1">
          {trending
            ? <TrendingUp  className="w-3 h-3 text-rl-green" />
            : <TrendingDown className="w-3 h-3 text-rl-red" />}
          <span className={`text-[10px] font-bold ${delta >= 0 ? "text-rl-green" : "text-rl-red"}`}>
            {delta >= 0 ? "+" : ""}{delta}
          </span>
        </div>
      </div>

      {/* Chart — spans exactly the dates this mode was played */}
      <div className="h-20">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={modePoints} margin={{ top: 2, right: 2, left: -40, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${mode}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" hide />
            <YAxis domain={[minY, maxY]} hide />
            <Tooltip
              content={<CustomTooltip color={color} />}
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="mmr"
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${mode})`}
              dot={false}
              activeDot={{ r: 3, fill: color, stroke: "hsl(var(--card))", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Min / current / max footnote */}
      <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
        <span>{Math.min(...vals)}</span>
        <span className="font-semibold" style={{ color }}>{vals[vals.length - 1]} MMR</span>
        <span>{Math.max(...vals)}</span>
      </div>
    </div>
  );
}

export default function PerformanceChart({ points, activeModes }: Props) {
  if (activeModes.length === 0 || points.length < 2) return null;

  // Only render modes that actually have ≥2 data points
  const renderableModes = activeModes.filter((mode) => {
    const count = points.filter((p) => p[mode] != null).length;
    return count >= 2;
  });

  if (renderableModes.length === 0) return null;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="pt-4 pb-3 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          MMR History
        </p>
        {renderableModes.map((mode, i) => (
          <div key={mode}>
            {i > 0 && <div className="border-t border-border/20 pt-4" />}
            <ModeChart mode={mode} points={points} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
