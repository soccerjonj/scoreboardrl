import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { Plus } from "lucide-react";

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-display text-2xl">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="font-display text-2xl font-bold">
            <span className="text-primary">Scoreboard</span>
            <span className="text-secondary">RL</span>
          </span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-display font-bold">Dashboard</h1>
          <Link to="/log-game">
            <Button variant="hero" className="gap-2">
              <Plus className="w-4 h-4" />
              Log Game
            </Button>
          </Link>
        </div>
        <p className="text-muted-foreground">Your stats dashboard is coming soon. Start by logging your first game!</p>
      </main>
    </div>
  );
};

export default Dashboard;
