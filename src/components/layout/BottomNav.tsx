import { Home, BarChart2, PlusCircle, Users, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/hooks/useNotifications";

const tabs = [
  { to: "/dashboard", label: "Home",     icon: Home },
  { to: "/stats",     label: "Stats",    icon: BarChart2 },
  { to: "/log-game",  label: "Log Game", icon: PlusCircle },
  { to: "/friends",   label: "Friends",  icon: Users },
  { to: "/profile",   label: "Profile",  icon: User },
];

const BottomNav = () => {
  const location = useLocation();
  const { unreadCount } = useNotifications();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-card/95 backdrop-blur-xl md:hidden">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const active = location.pathname === tab.to;
          const showBadge = false; // badge lives on the bell in MobileHeader
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <tab.icon className={cn("w-5 h-5", active && "drop-shadow-[0_0_6px_hsl(var(--rl-blue))]")} />
                {showBadge && (
                  <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-rl-red text-[9px] font-bold text-white flex items-center justify-center px-0.5 leading-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{tab.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
