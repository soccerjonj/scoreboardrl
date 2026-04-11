import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const CTASection = () => {
  return (
    <section className="py-24 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <div className="p-8 sm:p-12 rounded-2xl border border-border bg-gradient-card relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(212,95%,55%,0.1),transparent_60%)]" />
          <div className="relative z-10">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Ready to Track Your <span className="text-gradient-hero">Rocket League</span> Stats?
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
              Join ScoreboardRL and start tracking every goal, save, and win. Free forever.
            </p>
            <Link to="/auth">
              <Button variant="hero" size="lg" className="text-base px-8 py-6">
                Create Your Account
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
