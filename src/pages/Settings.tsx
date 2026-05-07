import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, LayoutList, Loader2, Monitor, Zap } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuota } from "@/hooks/useQuota";
import UpgradeSheet from "@/components/billing/UpgradeSheet";

const Settings = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const quota = useQuota();

  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(true);
  const [savingLeaderboard, setSavingLeaderboard] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    const loadSettings = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from("profiles")
          .select("show_on_leaderboard")
          .eq("user_id", user.id)
          .single();
        setShowOnLeaderboard(data?.show_on_leaderboard ?? true);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, [user]);

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!user) return null;

  return (
    <>
      <AppLayout>
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-display font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">Control app behavior and account-level preferences.</p>
          </div>

          <Card className="border-border/50 bg-card/80">
            <CardContent className="pt-4 pb-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold capitalize flex items-center gap-2">
                    {quota.tier === "lifetime" ? (
                      <span className="text-yellow-400">Lifetime</span>
                    ) : quota.tier === "pro" ? (
                      <span className="text-primary">Pro</span>
                    ) : (
                      <span>Free Plan</span>
                    )}
                    {quota.tier === "free" && (
                      <span className="text-xs text-muted-foreground font-normal">
                        {quota.parsesUsed}/{quota.quota} parses this month
                      </span>
                    )}
                  </p>
                  {quota.tier === "pro" && quota.currentPeriodEnd && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {quota.cancelAtPeriodEnd ? "Cancels" : "Renews"}{" "}
                      {new Date(quota.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {quota.tier === "free" && (
                  <Button
                    size="sm"
                    variant="hero"
                    className="gap-1.5"
                    onClick={() => setShowUpgrade(true)}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Upgrade
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/30">
                <div className="flex items-start gap-2">
                  <LayoutList className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Appear on leaderboard</p>
                    <p className="text-xs text-muted-foreground">Show your name in the global photo-parse rankings.</p>
                  </div>
                </div>
                <button
                  disabled={savingLeaderboard}
                  onClick={async () => {
                    const next = !showOnLeaderboard;
                    setSavingLeaderboard(true);
                    try {
                      await supabase.from("profiles").update({ show_on_leaderboard: next }).eq("user_id", user.id);
                      setShowOnLeaderboard(next);
                    } finally {
                      setSavingLeaderboard(false);
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    showOnLeaderboard ? "bg-primary" : "bg-muted"
                  } ${savingLeaderboard ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showOnLeaderboard ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </CardContent>
          </Card>

          {(quota.tier === "pro" || quota.tier === "lifetime") && (
            <Card className="border-border/50 bg-card/80">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold">PC Companion</p>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Pro</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Auto-log games directly from Rocket League on PC. Install the extension, sign in, and matches save automatically.
                </p>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground/80">Setup:</p>
                  <ol className="space-y-1 list-decimal list-inside">
                    <li>Install the Chrome extension.</li>
                    <li>Sign in with your ScoreboardRL credentials in the extension popup.</li>
                    <li>Set <code className="bg-muted px-1 py-0.5 rounded text-[11px]">PacketSendRate=60</code> in <code className="bg-muted px-1 py-0.5 rounded text-[11px]">DefaultStatsAPI.ini</code>.</li>
                    <li>Restart Rocket League.</li>
                  </ol>
                </div>
                <a
                  href="https://github.com/soccerjonj/scoreboardrl/tree/main/extension"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                >
                  <ExternalLink className="w-3 h-3" />
                  View extension installation guide
                </a>
              </CardContent>
            </Card>
          )}
        </div>
      </AppLayout>
      <UpgradeSheet
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        currentTier={quota.tier}
        parsesUsed={quota.parsesUsed}
        quota={quota.quota}
      />
    </>
  );
};

export default Settings;
