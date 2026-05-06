import { useState, useEffect } from "react";
import { X, Camera, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "srl_photo_guide_dismissed";

const tips = [
  {
    icon: "📊",
    title: "Full scoreboard visible",
    detail: "All players' Score, Goals, Assists, Saves, and Shots columns must be readable.",
  },
  {
    icon: "🏅",
    title: "MMR numbers at the bottom",
    detail: "The +/− MMR change next to each player's current MMR (e.g. +9 968) must be in frame.",
  },
  {
    icon: "💎",
    title: "Rank badge on the right",
    detail: 'The "Current Tier" rank (e.g. Diamond II Division I) on the right side must be visible.',
  },
  {
    icon: "📸",
    title: "Hold steady & fill the frame",
    detail: "Point your camera straight at the screen. Keep the phone still and get close enough that the scoreboard fills most of the shot.",
  },
];

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

      {/* Tips */}
      <div className="grid gap-2 sm:grid-cols-2">
        {tips.map((tip) => (
          <div
            key={tip.title}
            className="flex gap-2.5 rounded-lg bg-card/60 border border-border/40 p-3"
          >
            <span className="text-lg leading-none mt-0.5 shrink-0">{tip.icon}</span>
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
