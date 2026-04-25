import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const Logo = ({ size = "md", className }: LogoProps) => {
  const textSize = size === "lg" ? "text-4xl" : size === "md" ? "text-xl" : "text-lg";
  const badgeSize = size === "lg" ? "text-sm px-2 py-0.5" : "text-[10px] px-1.5 py-0.5";

  return (
    <span className={cn("font-display font-bold inline-flex items-center gap-1.5", textSize, className)}>
      <span className="bg-gradient-to-r from-primary to-[hsl(250,80%,70%)] bg-clip-text text-transparent">
        Scoreboard
      </span>
      <span className={cn(
        "font-bold rounded-md bg-primary/15 text-primary border border-primary/30 leading-none inline-flex items-center",
        badgeSize
      )}>
        RL
      </span>
    </span>
  );
};

export default Logo;
