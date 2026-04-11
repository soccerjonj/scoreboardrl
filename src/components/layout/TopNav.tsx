import { Home, PlusCircle, Users, User, LogOut } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const tabs = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/log-game", label: "Log Game", icon: PlusCircle },
  { to: "/friends", label: "Friends", icon: Users },
  { to: "/profile", label: "Profile", icon: User },
];

const TopNav = () => {
  const location = useLocation();
  const { signOut } = useAuth();

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
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </NavLink>
            );
          })}
        </nav>

        <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-2 text-muted-foreground">
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </header>
  );
};

export default TopNav;
