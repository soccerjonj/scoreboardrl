import { Button } from "@/components/ui/button";
import { Camera, BarChart3, Users } from "lucide-react";
import { Link } from "react-router-dom";

const HeroSection = () => {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden px-4">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(212,95%,55%,0.12),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(25,95%,55%,0.08),transparent_60%)]" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: "3s" }} />

      <div className="relative z-10 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border bg-muted/50 mb-6">
          <span className="w-2 h-2 rounded-full bg-rl-green animate-pulse-glow" />
          <span className="text-sm text-muted-foreground">Track every game. Dominate every playlist.</span>
        </div>

        <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.9] mb-6">
          <span className="text-gradient-hero">Scoreboard</span>
          <span className="text-secondary">RL</span>
        </h1>

        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
          Snap your scoreboard. Track your stats. See who really carries the team.
          The ultimate stat tracker for Rocket League players.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link to="/auth">
            <Button variant="hero" size="lg" className="text-base px-8 py-6">
              Get Started Free
            </Button>
          </Link>
          <Link to="/auth">
            <Button variant="outline" size="lg" className="text-base px-8 py-6">
              Sign In
            </Button>
          </Link>
        </div>

        {/* Feature pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
          <FeaturePill icon={<Camera className="w-5 h-5 text-primary" />} text="Snap & Auto-Fill Stats" />
          <FeaturePill icon={<BarChart3 className="w-5 h-5 text-secondary" />} text="Charts & Trends" />
          <FeaturePill icon={<Users className="w-5 h-5 text-rl-purple" />} text="Teammate Comparisons" />
        </div>
      </div>
    </section>
  );
};

const FeaturePill = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card/50 backdrop-blur-sm">
    {icon}
    <span className="text-sm font-medium text-foreground">{text}</span>
  </div>
);

export default HeroSection;
