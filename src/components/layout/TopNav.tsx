import { Home, PlusCircle, Users, User, LogOut, Bell, BarChart2 } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";

const tabs = [
  { to: "/dashboard", label: "Home",     icon: Home },
  { to: "/stats",     label: "Stats",    icon: BarChart2 },
  { to: "/log-game",  label: "Log Game", icon: PlusCircle },
  { to: "/friends",   label: "Friends",  icon: Users },
  { to: "/profile",   label: "Profile",  icon: User },
];

const TopNav = () => {
  const location = useLocation();
  const { signOut } = useAuth();
  const { unreadCount } = useNotifications();

  return (
    <header className="hidden md:block sticky top-0 z-50 border-b border-border/50 bg-card/95 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <NavLink to="/dashboard" className="font-display text-xl font-bold">
          <span className="text-primary">Scoreboard</span>
          <span className="text-secondary">RL</span>
        </NavLink>

        <nav className="flex items-center gap-1">
          {tabs.map((tab) => {
            const active = location.pathname === tab.to;
            const showBadge = false; // badge lives on the bell icon instead
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors relative",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <div className="relative">
                  <tab.icon className="w-4 h-4" />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-rl-red text-[9px] font-bold text-white flex items-center justify-center px-0.5 leading-none">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </div>
                {tab.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <NavLink
            to="/notifications"
            className={cn(
              "relative flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
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
            Notifications
          </NavLink>

          <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2 text-muted-foreground">
            <LogOut className="w-4 h-4" />
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
};

export default TopNav;
