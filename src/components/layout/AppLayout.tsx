import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Bell, ArrowDown, Loader2, Settings } from "lucide-react";
import BottomNav from "./BottomNav";
import TopNav from "./TopNav";
import TournamentLiveBanner from "@/components/tournament/TournamentLiveBanner";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import Logo from "@/components/ui/Logo";

const PULL_THRESHOLD = 72;

const MobileHeader = () => {
  const location = useLocation();
  const { unreadCount } = useNotifications();

  return (
    <header
      className="md:hidden border-b border-border/50 bg-card/95"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="h-12 px-4 flex items-center justify-between">
        <NavLink to="/dashboard"><Logo size="sm" /></NavLink>
        <div className="flex items-center gap-1">
          <NavLink
            to="/notifications"
            className={cn(
              "relative p-2 rounded-md transition-colors",
              location.pathname === "/notifications"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full bg-rl-red text-[9px] font-bold text-white flex items-center justify-center px-0.5 leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </NavLink>
          <NavLink
            to="/settings"
            className={cn(
              "p-2 rounded-md transition-colors",
              location.pathname === "/settings"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Settings className="w-5 h-5" />
          </NavLink>
        </div>
      </div>
    </header>
  );
};

const AppLayout = ({ children }: { children: ReactNode }) => {
  const [pullY, setPullY] = useState(0);
  const [releasing, setReleasing] = useState(false);
  const pullYRef = useRef(0);
  const touchStartY = useRef(0);
  const active = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY > 0) return;
    touchStartY.current = e.touches[0].clientY;
    active.current = true;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!active.current) return;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (dy > 0) {
      const clamped = Math.min(dy * 0.5, PULL_THRESHOLD + 20);
      pullYRef.current = clamped;
      setPullY(clamped);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    if (pullYRef.current >= PULL_THRESHOLD) {
      setReleasing(true);
      setTimeout(() => window.location.reload(), 400);
    } else {
      pullYRef.current = 0;
      setPullY(0);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const ready = pullY >= PULL_THRESHOLD;
  const progress = Math.min(pullY / PULL_THRESHOLD, 1);
  const showIndicator = pullY > 2 || releasing;

  // Indicator emerges from just below the mobile header (48px + safe-area)
  const indicatorTop = releasing
    ? "calc(env(safe-area-inset-top, 0px) + 60px)"
    : `calc(env(safe-area-inset-top, 0px) + ${44 + pullY - 20}px)`;

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <MobileHeader />
      <TournamentLiveBanner />

      {showIndicator && (
        <div
          className="md:hidden fixed left-0 right-0 z-50 pointer-events-none flex justify-center"
          style={{
            top: indicatorTop,
            transition: releasing ? "top 0.2s ease" : "none",
          }}
        >
          <div className="w-8 h-8 rounded-full bg-card border border-border/50 shadow-lg flex items-center justify-center">
            {releasing ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            ) : (
              <ArrowDown
                className="w-4 h-4"
                style={{
                  color: ready ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                  transform: `rotate(${progress * 180}deg)`,
                  transition: "color 0.15s",
                }}
              />
            )}
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 py-6 pb-28 md:pb-6">
        {children}
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
