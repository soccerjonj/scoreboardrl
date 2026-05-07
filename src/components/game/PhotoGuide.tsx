import { useState, useEffect } from "react";
import { X, Camera, CheckCircle2, Info } from "lucide-react";

const STORAGE_KEY = "srl_photo_guide_dismissed";

const CALLOUT_COLORS = ["#fbbf24", "#34d399", "#fb923c", "#a78bfa"];

const tips = [
  {
    title: "Full scoreboard visible",
    detail: "All players' Score, Goals, Assists, Saves, and Shots columns must be readable.",
  },
  {
    title: "MMR numbers at the bottom",
    detail: "The +/− MMR change next to each player's current MMR (e.g. +9 968) must be in frame.",
  },
  {
    title: "Rank badge on the right",
    detail: 'The "Current Tier" rank (e.g. Diamond II Division I) on the right side must be visible.',
  },
  {
    title: "Hold steady & fill the frame",
    detail: "Point your camera straight at the screen. Keep the phone still and get close enough that the scoreboard fills most of the shot.",
  },
];

const ScoreboardIllustration = () => (
  <svg
    viewBox="0 0 360 185"
    width="100%"
    xmlns="http://www.w3.org/2000/svg"
    style={{ display: "block" }}
    aria-hidden="true"
  >
    {/* Background */}
    <rect width="360" height="185" fill="#0b1121" />

    {/* Top bar */}
    <rect width="360" height="18" fill="#111827" />
    <text x="180" y="12" textAnchor="middle" fill="#4b5e80" fontSize="7" fontFamily="sans-serif" letterSpacing="3">POST-MATCH</text>

    {/* Column headers — MMR far left, SHOTS far right */}
    <rect x="0" y="18" width="360" height="10" fill="#0e1520" />
    <text x="8"   y="26" fill="#3a4a66" fontSize="6" fontFamily="sans-serif">MMR</text>
    <text x="68"  y="26" fill="#3a4a66" fontSize="6" fontFamily="sans-serif">PLAYER</text>
    <text x="182" y="26" textAnchor="middle" fill="#3a4a66" fontSize="6" fontFamily="sans-serif">SCR</text>
    <text x="214" y="26" textAnchor="middle" fill="#3a4a66" fontSize="6" fontFamily="sans-serif">GLS</text>
    <text x="244" y="26" textAnchor="middle" fill="#3a4a66" fontSize="6" fontFamily="sans-serif">AST</text>
    <text x="274" y="26" textAnchor="middle" fill="#3a4a66" fontSize="6" fontFamily="sans-serif">SVS</text>
    <text x="308" y="26" textAnchor="middle" fill="#3a4a66" fontSize="6" fontFamily="sans-serif">SHT</text>

    {/* Blue team header */}
    <rect x="0" y="28" width="360" height="11" fill="#1a3357" />
    <text x="12" y="36.5" fill="#5b9bd5" fontSize="7" fontFamily="sans-serif" fontWeight="bold">BLUE  2 – 1  ORANGE</text>
    <text x="208" y="36.5" fill="#4ade80" fontSize="7" fontFamily="sans-serif">▲ WIN</text>

    {/* Blue player 1 (y 39–61) — MMR on far left */}
    <rect x="0" y="39" width="360" height="22" fill="#172035" />
    <text x="8"  y="50" fill="#4ade80" fontSize="7.5" fontFamily="sans-serif">+9</text>
    <text x="8"  y="59" fill="#8899aa" fontSize="7.5" fontFamily="sans-serif">958</text>
    <rect x="49" y="42" width="14" height="14" rx="2" fill="#1d4ed8" />
    <polygon points="56,44 60,48 56,52 52,48" fill="#60a5fa" />
    <text x="68" y="53" fill="white" fontSize="8.5" fontFamily="sans-serif">Soccerjonj</text>
    <text x="182" y="53" textAnchor="middle" fill="white" fontSize="8.5" fontFamily="sans-serif">450</text>
    <text x="214" y="53" textAnchor="middle" fill="white" fontSize="8.5" fontFamily="sans-serif">2</text>
    <text x="244" y="53" textAnchor="middle" fill="white" fontSize="8.5" fontFamily="sans-serif">1</text>
    <text x="274" y="53" textAnchor="middle" fill="white" fontSize="8.5" fontFamily="sans-serif">3</text>
    <text x="308" y="53" textAnchor="middle" fill="white" fontSize="8.5" fontFamily="sans-serif">5</text>
    <text x="336" y="53" fill="#fbbf24" fontSize="11" fontFamily="sans-serif">★</text>

    {/* Blue player 2 (y 61–83) */}
    <rect x="0" y="61" width="360" height="22" fill="#101828" />
    <text x="8"  y="72" fill="#4ade80" fontSize="7.5" fontFamily="sans-serif">+9</text>
    <text x="8"  y="81" fill="#8899aa" fontSize="7.5" fontFamily="sans-serif">924</text>
    <rect x="49" y="64" width="14" height="14" rx="2" fill="#1d4ed8" />
    <polygon points="56,66 60,70 56,74 52,70" fill="#60a5fa" />
    <text x="68" y="75" fill="#aac4ff" fontSize="8.5" fontFamily="sans-serif">Teammate</text>
    <text x="182" y="75" textAnchor="middle" fill="#aac4ff" fontSize="8.5" fontFamily="sans-serif">290</text>
    <text x="214" y="75" textAnchor="middle" fill="#aac4ff" fontSize="8.5" fontFamily="sans-serif">0</text>
    <text x="244" y="75" textAnchor="middle" fill="#aac4ff" fontSize="8.5" fontFamily="sans-serif">2</text>
    <text x="274" y="75" textAnchor="middle" fill="#aac4ff" fontSize="8.5" fontFamily="sans-serif">5</text>
    <text x="308" y="75" textAnchor="middle" fill="#aac4ff" fontSize="8.5" fontFamily="sans-serif">2</text>

    {/* Orange team header */}
    <rect x="0" y="83" width="360" height="11" fill="#3d1c0a" />
    <text x="12" y="91.5" fill="#f97316" fontSize="7" fontFamily="sans-serif" fontWeight="bold">ORANGE  1 – 2  BLUE</text>
    <text x="208" y="91.5" fill="#f87171" fontSize="7" fontFamily="sans-serif">▼ LOSS</text>

    {/* Orange player 1 (y 94–116) */}
    <rect x="0" y="94" width="360" height="22" fill="#1c1008" />
    <text x="8"  y="105" fill="#f87171" fontSize="7.5" fontFamily="sans-serif">−9</text>
    <text x="8"  y="114" fill="#8899aa" fontSize="7.5" fontFamily="sans-serif">912</text>
    <rect x="49" y="97" width="14" height="14" rx="2" fill="#c2410c" />
    <polygon points="56,99 60,103 56,107 52,103" fill="#fb923c" />
    <text x="68" y="108" fill="#ffd0b0" fontSize="8.5" fontFamily="sans-serif">Opponent1</text>
    <text x="182" y="108" textAnchor="middle" fill="#ffd0b0" fontSize="8.5" fontFamily="sans-serif">420</text>
    <text x="214" y="108" textAnchor="middle" fill="#ffd0b0" fontSize="8.5" fontFamily="sans-serif">1</text>
    <text x="244" y="108" textAnchor="middle" fill="#ffd0b0" fontSize="8.5" fontFamily="sans-serif">0</text>
    <text x="274" y="108" textAnchor="middle" fill="#ffd0b0" fontSize="8.5" fontFamily="sans-serif">2</text>
    <text x="308" y="108" textAnchor="middle" fill="#ffd0b0" fontSize="8.5" fontFamily="sans-serif">6</text>

    {/* Orange player 2 (y 116–138) */}
    <rect x="0" y="116" width="360" height="22" fill="#150c05" />
    <text x="8"  y="127" fill="#f87171" fontSize="7.5" fontFamily="sans-serif">−9</text>
    <text x="8"  y="136" fill="#8899aa" fontSize="7.5" fontFamily="sans-serif">926</text>
    <rect x="49" y="119" width="14" height="14" rx="2" fill="#c2410c" />
    <polygon points="56,121 60,125 56,129 52,125" fill="#fb923c" />
    <text x="68" y="130" fill="#ffb890" fontSize="8.5" fontFamily="sans-serif">Opponent2</text>
    <text x="182" y="130" textAnchor="middle" fill="#ffb890" fontSize="8.5" fontFamily="sans-serif">310</text>
    <text x="214" y="130" textAnchor="middle" fill="#ffb890" fontSize="8.5" fontFamily="sans-serif">0</text>
    <text x="244" y="130" textAnchor="middle" fill="#ffb890" fontSize="8.5" fontFamily="sans-serif">1</text>
    <text x="274" y="130" textAnchor="middle" fill="#ffb890" fontSize="8.5" fontFamily="sans-serif">4</text>
    <text x="308" y="130" textAnchor="middle" fill="#ffb890" fontSize="8.5" fontFamily="sans-serif">3</text>

    {/* Separator */}
    <line x1="0" y1="138" x2="360" y2="138" stroke="#1e2d45" strokeWidth="1" />

    {/* Bottom area — rank badge centered */}
    <rect x="0" y="138" width="360" height="47" fill="#070d1a" />
    <rect x="100" y="142" width="160" height="38" rx="4" fill="#121e33" stroke="#1e3050" strokeWidth="1" />
    <text x="180" y="154" textAnchor="middle" fill="#4a5a80" fontSize="6" fontFamily="sans-serif" letterSpacing="1">CURRENT TIER</text>
    <polygon points="118,168 124,162 130,168 124,174" fill="#3b82f6" />
    <text x="180" y="168" textAnchor="middle" fill="white" fontSize="10" fontFamily="sans-serif" fontWeight="bold">DIAMOND II</text>
    <text x="180" y="177" textAnchor="middle" fill="#6a7a99" fontSize="7.5" fontFamily="sans-serif">DIVISION I</text>

    {/* ── CALLOUT ANNOTATIONS ── */}

    {/* ① Stats columns (gold) — SCR through SHT */}
    <rect x="161" y="18" width="162" height="120" rx="2" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4,3" />
    <circle cx="171" cy="18" r="7" fill="#fbbf24" />
    <text x="171" y="22" textAnchor="middle" fill="#0b1121" fontSize="9" fontWeight="bold" fontFamily="sans-serif">1</text>

    {/* ② MMR column (green) — far left of player rows */}
    <rect x="2" y="39" width="44" height="99" rx="2" fill="none" stroke="#34d399" strokeWidth="1.5" strokeDasharray="4,3" />
    <circle cx="11" cy="49" r="7" fill="#34d399" />
    <text x="11" y="53" textAnchor="middle" fill="#0b1121" fontSize="9" fontWeight="bold" fontFamily="sans-serif">2</text>

    {/* ③ Rank badge at bottom (orange) */}
    <rect x="96" y="138" width="168" height="47" rx="2" fill="none" stroke="#fb923c" strokeWidth="1.5" strokeDasharray="4,3" />
    <circle cx="106" cy="148" r="7" fill="#fb923c" />
    <text x="106" y="152" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">3</text>

    {/* ④ Outer framing (purple) */}
    <rect x="1" y="1" width="358" height="183" rx="7" fill="none" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="5,4" />
    <circle cx="348" cy="10" r="7" fill="#a78bfa" />
    <text x="348" y="14" textAnchor="middle" fill="white" fontSize="9" fontWeight="bold" fontFamily="sans-serif">4</text>
  </svg>
);

const PhotoGuide = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  const reopen = () => {
    localStorage.removeItem(STORAGE_KEY);
    setVisible(true);
  };

  if (!visible) return (
    <div className="flex justify-end">
      <button
        onClick={reopen}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        aria-label="Show photo guide"
      >
        <Info className="w-3.5 h-3.5" />
        Photo tips
      </button>
    </div>
  );

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">How to take a good scoreboard photo</p>
        </div>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Illustration */}
      <div className="rounded-lg overflow-hidden border border-border/30">
        <ScoreboardIllustration />
      </div>

      {/* Tips */}
      <div className="grid gap-2 sm:grid-cols-2">
        {tips.map((tip, i) => (
          <div
            key={tip.title}
            className="flex gap-2.5 rounded-lg bg-card/60 border border-border/40 p-3"
          >
            <span
              className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
              style={{
                backgroundColor: CALLOUT_COLORS[i],
                color: i < 2 ? "#0b1121" : "white",
              }}
            >
              {i + 1}
            </span>
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs font-semibold text-foreground/90">{tip.title}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{tip.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Dismiss */}
      <button
        onClick={dismiss}
        className="w-full flex items-center justify-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors py-1"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        Got it, don't show again
      </button>
    </div>
  );
};

export default PhotoGuide;
