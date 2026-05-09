import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";
import type { ChartPoint } from "@/types/profile";
import { format } from "date-fns";

type Props = {
  data: ChartPoint[];
};

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const point: ChartPoint = payload[0].payload;
  return (
    <div className="rounded-lg border border-border/60 bg-card/95 backdrop-blur-sm px-3 py-2 text-xs shadow-xl">
      <p className="font-bold text-foreground font-display text-sm">{point.score} MMR</p>
      <p className="text-muted-foreground">{format(new Date(point.date), "MMM d, yyyy")}</p>
    </div>
  );
}

export default function PerformanceChart({ data }: Props) {
  if (data.length < 3) return null;

  const gameMode = data[0]?.gameMode ?? "";
  const scores = data.map((d) => d.score);
  const minScore = Math.max(0, Math.min(...scores) - 50);
  const maxScore = Math.max(...scores) + 50;

  // Determine trend: compare avg of last 5 vs prior 5
  const recent = data.slice(-5).reduce((s, d) => s + d.score, 0) / Math.min(5, data.length);
  const prior = data.slice(-10, -5);
  const priorAvg = prior.length > 0 ? prior.reduce((s, d) => s + d.score, 0) / prior.length : recent;
  const trending = recent >= priorAvg;

  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            MMR History{gameMode ? ` · ${gameMode}` : ""}
          </p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            trending
              ? "bg-rl-green/15 text-rl-green"
              : "bg-rl-red/15 text-rl-red"
          }`}>
            {trending ? "▲ Trending up" : "▼ Trending down"}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mb-2">MMR over time · last 30 days</p>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="index" hide />
              <YAxis domain={[minScore, maxScore]} hide />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#scoreGrad)"
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
