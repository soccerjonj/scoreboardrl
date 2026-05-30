import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Logo from "@/components/ui/Logo";

type Props = {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
};

/**
 * Shared shell for the static legal pages (/privacy, /terms). Keeps a
 * back-to-home link, the logo, and consistent prose styling.
 */
export default function LegalPage({ title, lastUpdated, children }: Props) {
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border/50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/"><Logo size="md" /></Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Home
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-display font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1">Last updated: {lastUpdated}</p>
        <div className="prose prose-invert prose-sm sm:prose-base max-w-none mt-6 prose-headings:font-display prose-a:text-primary">
          {children}
        </div>
      </main>

      <footer className="border-t border-border/50 py-6 px-4 text-center text-xs text-muted-foreground">
        Not affiliated with Psyonix or Epic Games. Rocket League is a registered trademark.
        {" · "}
        <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        {" · "}
        <Link to="/terms" className="hover:text-foreground">Terms</Link>
      </footer>
    </div>
  );
}
