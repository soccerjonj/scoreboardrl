import { Home, PlusCircle, Users, User, LogOut, Bell, BarChart2, Trophy, Zap, Settings } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import Logo from "@/components/ui/Logo";
import { useQuota } from "@/hooks/useQuota";
import { useState } from "react";
import UpgradeSheet from "@/components/billing/UpgradeSheet";

const tabs = [
  { to: "/dashboard",   label: "Home",        icon: Home },
  { to: "/stats",       label: "Stats",       icon: BarChart2 },
  { to: "/log-game",    label: "Log Game",    icon: PlusCircle },
  { to: "/friends",     label: "Friends",     icon: Users },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/profile",     label: "Profile",     icon: User },
];

const TopNav = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const quota = useQuota();
  const [showUpgrade, setShowUpgrade] = useState(false);

  return (
    <>
    <header className="hidden md:block sticky top-0 z-50 border-b border-border/50 bg-card/95 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <NavLink to="/dashboard"><Logo size="md" /></NavLink>

        <nav className="flex items-center gap-0.5">
          {tabs.map((tab) => {
            const active = location.pathname === tab.to;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors relative",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          {quota.tier === "free" && !quota.isLoading && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUpgrade(true)}
              className="gap-1.5 text-muted-foreground hover:text-primary text-xs px-2.5"
            >
              <Zap className="w-3.5 h-3.5" />
              Go Pro
            </Button>
          )}
          <NavLink
            to="/settings"
            className={cn(
              "relative flex items-center justify-center w-9 h-9 rounded-md transition-colors",
              location.pathname === "/settings"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Settings className="w-4 h-4" />
          </NavLink>
          <NavLink
            to="/notifications"
            className={cn(
              "relative flex items-center justify-center w-9 h-9 rounded-md transition-colors",
              location.pathname === "/notifications"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <div className="relative">
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-rl-red text-[9px] font-bold text-white flex items-center justify-center px-0.5 leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
          </NavLink>

          <Button variant="ghost" size="icon" onClick={() => signOut()} className="text-muted-foreground w-9 h-9">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
    <UpgradeSheet
      open={showUpgrade}
      onOpenChange={setShowUpgrade}
      currentTier={quota.tier}
      parsesUsed={quota.parsesUsed}
      quota={quota.quota}
    />
    </>
  );
};

export default TopNav;
