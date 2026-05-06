import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Loader2, Trophy } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import LeaderboardView from "@/components/leaderboard/LeaderboardView";

const Leaderboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  if (authLoading) return (
    <AppLayout>
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="animate-fade-in-up">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            Leaderboard
          </h1>
        </div>
        <LeaderboardView />
      </div>
    </AppLayout>
  );
};

export default Leaderboard;
