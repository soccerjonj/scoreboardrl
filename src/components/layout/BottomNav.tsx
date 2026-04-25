import { Home, BarChart2, PlusCircle, Users, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";

const tabs = [
  { to: "/dashboard", label: "Home",    icon: Home },
  { to: "/stats",     label: "Stats",   icon: BarChart2 },
  { to: "/log-game",  label: "Log",     icon: PlusCircle },
  { to: "/friends",   label: "Friends", icon: Users },
  { to: "/profile",   label: "Profile", icon: User },
];

const BottomNav = () => {
  const location = useLocation();
  const { unreadCount } = useNotifications();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-white/[0.07] bg-[hsl(224_22%_6%/0.88)] backdrop-blur-2xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div>
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
          {tabs.map((tab) => {
            const active = location.pathname === tab.to;
            const isLog  = tab.to === "/log-game";

            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className="flex flex-col items-center justify-center gap-1 w-16 h-full relative"
              >
                {isLog ? (
                  <div className={cn(
                    "w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200",
                    active
                      ? "bg-primary shadow-[0_0_20px_hsl(var(--primary)/0.55)] scale-105"
                      : "bg-primary/20 border border-primary/30"
                  )}>
                    <tab.icon className={cn("w-5 h-5", active ? "text-white" : "text-primary")} />
                  </div>
                ) : (
                  <>
                    <div className={cn(
                      "relative w-10 h-8 rounded-xl flex items-center justify-center transition-all duration-200",
                      active ? "bg-primary/15" : ""
                    )}>
                      <tab.icon className={cn(
                        "w-5 h-5 transition-all duration-200",
                        active
                          ? "text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.8)]"
                          : "text-muted-foreground"
                      )} />
                      {tab.to === "/friends" && unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full bg-rl-red text-[9px] font-bold text-white flex items-center justify-center px-0.5 leading-none">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </div>
                    <span className={cn(
                      "text-[10px] font-medium transition-colors duration-200",
                      active ? "text-primary" : "text-muted-foreground"
                    )}>
                      {tab.label}
                    </span>
                    {active && (
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.9)]" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
