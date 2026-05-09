import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import { format } from "date-fns";

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

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const date = payload[0]?.payload?.fullLabel ?? payload[0]?.payload?.label ?? "";
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 backdrop-blur-sm px-3 py-2 text-xs shadow-xl space-y-1">
      <p className="text-muted-foreground">{date}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.stroke }} />
          <span className="font-bold" style={{ color: p.stroke }}>{p.value} MMR</span>
          <span className="text-muted-foreground">{p.dataKey}</span>
        </div>
      ))}
    </div>
  );
}

function CustomLegend({ activeModes }: { activeModes: string[] }) {
  if (activeModes.length <= 1) return null;
  return (
    <div className="flex items-center gap-3 justify-center mt-1">
      {activeModes.map((m) => (
        <div key={m} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="w-2 h-2 rounded-full" style={{ background: MODE_COLORS[m] }} />
          {m}
        </div>
      ))}
    </div>
  );
}

export default function PerformanceChart({ points, activeModes }: Props) {
  if (activeModes.length === 0 || points.length < 2) return null;

  // Trend: compare avg MMR of last 5 points vs prior 5 for the primary mode
  const primaryMode = activeModes[0];
  const vals = points.map((p) => p[primaryMode]).filter((v): v is number => typeof v === "number");
  const recent = vals.slice(-5).reduce((s, v) => s + v, 0) / Math.min(5, vals.length);
  const prior  = vals.slice(-10, -5);
  const priorAvg = prior.length > 0 ? prior.reduce((s, v) => s + v, 0) / prior.length : recent;
  const trending = recent >= priorAvg;

  // Y-axis domain across all modes
  const allVals = points.flatMap((p) => activeModes.map((m) => p[m]).filter((v): v is number => typeof v === "number"));
  const minY = Math.max(0, Math.min(...allVals) - 50);
  const maxY = Math.max(...allVals) + 50;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            MMR History
          </p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            trending ? "bg-rl-green/15 text-rl-green" : "bg-rl-red/15 text-rl-red"
          }`}>
            {trending ? "▲ Trending up" : "▼ Trending down"}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mb-2">Last 30 days</p>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
              <defs>
                {activeModes.map((m) => (
                  <linearGradient key={m} id={`grad-${m}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={MODE_COLORS[m]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={MODE_COLORS[m]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis dataKey="label" hide />
              <YAxis domain={[minY, maxY]} hide />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
              {activeModes.map((m) => (
                <Area
                  key={m}
                  type="monotone"
                  dataKey={m}
                  stroke={MODE_COLORS[m]}
                  strokeWidth={2}
                  fill={`url(#grad-${m})`}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 4, fill: MODE_COLORS[m], stroke: "hsl(var(--card))", strokeWidth: 2 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <CustomLegend activeModes={activeModes} />
      </CardContent>
    </Card>
  );
}
