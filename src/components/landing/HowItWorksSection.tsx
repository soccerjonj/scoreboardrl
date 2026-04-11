import { Camera, Cpu, BarChart3 } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: Camera,
    title: "Snap or Log",
    description: "Take a photo of your scoreboard or manually input your stats after each match.",
  },
  {
    step: "02",
    icon: Cpu,
    title: "AI Reads It",
    description: "Our AI detects players, scores, game mode, and results — then lets you review before saving.",
  },
  {
    step: "03",
    icon: BarChart3,
    title: "Track & Compare",
    description: "View your stats, trends, and teammate comparisons with detailed charts and filters.",
  },
];

const HowItWorksSection = () => {
  return (
    <section className="py-24 px-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,hsl(25,95%,55%,0.05),transparent_70%)]" />
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            How It <span className="text-gradient-orange">Works</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((item) => (
            <div key={item.step} className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-muted border border-border mb-4">
                <item.icon className="w-7 h-7 text-secondary" />
              </div>
              <div className="font-display text-sm text-secondary font-semibold mb-1">STEP {item.step}</div>
              <h3 className="font-display text-xl font-bold mb-2 text-foreground">{item.title}</h3>
              <p className="text-muted-foreground text-sm">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
