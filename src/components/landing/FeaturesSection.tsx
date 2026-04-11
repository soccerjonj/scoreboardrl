import { Camera, BarChart3, Users, Gamepad2, TrendingUp, Shield } from "lucide-react";

const features = [
  {
    icon: Camera,
    title: "Snap Your Scoreboard",
    description: "Take a photo of your post-match screen. Our AI reads scores, goals, assists, saves, and more — across all platforms.",
    color: "text-primary",
  },
  {
    icon: BarChart3,
    title: "Detailed Stats & Charts",
    description: "Track your points, goals, assists, saves, and MVP rate per game. See trends over time with interactive charts.",
    color: "text-secondary",
  },
  {
    icon: Users,
    title: "Teammate Tracking",
    description: "Connect with teammates, compare stats side-by-side, and see your win/loss record together.",
    color: "text-rl-purple",
  },
  {
    icon: Gamepad2,
    title: "All Game Modes",
    description: "Track stats across 1v1, 2v2, 3v3, Hoops, Rumble, Dropshot, Snow Day, and Tournaments — ranked & casual.",
    color: "text-rl-green",
  },
  {
    icon: TrendingUp,
    title: "Division Tracking",
    description: "Log your rank after each session. See div up/down streaks and track your climb through the season.",
    color: "text-primary",
  },
  {
    icon: Shield,
    title: "Stat Approval System",
    description: "Connected teammates auto-approve uploaded stats. Others can review and approve submissions.",
    color: "text-secondary",
  },
];

const FeaturesSection = () => {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Everything You Need to <span className="text-gradient-hero">Level Up</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Stop guessing. Start tracking. Know exactly how you and your squad perform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group p-6 rounded-xl border border-border bg-card/50 hover:bg-card transition-all duration-300 hover:border-primary/30 hover:glow-blue"
            >
              <feature.icon className={`w-10 h-10 mb-4 ${feature.color}`} />
              <h3 className="font-display text-xl font-semibold mb-2 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
