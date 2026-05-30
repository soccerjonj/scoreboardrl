import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t border-border py-8 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="font-display text-xl font-bold">
          <span className="text-primary">Scoreboard</span>
          <span className="text-secondary">RL</span>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
          <p className="text-center">
            Not affiliated with Psyonix or Epic Games. Rocket League is a registered trademark.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
