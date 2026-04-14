import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Bell } from "lucide-react";
import BottomNav from "./BottomNav";
import TopNav from "./TopNav";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

const MobileHeader = () => {
  const location = useLocation();
  const { unreadCount } = useNotifications();

  return (
    <header className="md:hidden sticky top-0 z-50 border-b border-border/50 bg-card/95 backdrop-blur-xl">
      <div className="h-12 px-4 flex items-center justify-between">
        <NavLink to="/dashboard" className="font-display text-lg font-bold">
          <span className="text-primary">Scoreboard</span>
          <span className="text-secondary">RL</span>
        </NavLink>
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
      </div>
    </header>
  );
};

const AppLayout = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-background">
    <TopNav />
    <MobileHeader />
    <main className="max-w-5xl mx-auto px-4 py-6 pb-24 md:pb-6">
      {children}
    </main>
    <BottomNav />
  </div>
);

export default AppLayout;
