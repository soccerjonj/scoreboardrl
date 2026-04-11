const Footer = () => {
  return (
    <footer className="border-t border-border py-8 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="font-display text-xl font-bold">
          <span className="text-primary">Scoreboard</span>
          <span className="text-secondary">RL</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Not affiliated with Psyonix or Epic Games. Rocket League is a registered trademark.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
