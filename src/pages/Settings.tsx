import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Download, ExternalLink, LayoutList, Loader2, LogOut, Monitor, Trash2, Zap } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuota } from "@/hooks/useQuota";
import UpgradeSheet from "@/components/billing/UpgradeSheet";
import { BILLING_ENABLED } from "@/lib/featureFlags";

const Settings = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const quota = useQuota();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(true);
  const [savingLeaderboard, setSavingLeaderboard] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-data");
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scoreboardrl-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Export ready", description: "Your data downloaded as JSON." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Try again later.";
      toast({ title: "Export failed", description: message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) throw error;
      await signOut();
      navigate("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Try again later.";
      toast({ title: "Delete failed", description: message, variant: "destructive" });
      setDeleting(false);
    }
  };

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
                {BILLING_ENABLED && quota.tier === "free" && (
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

          <div className="pt-1">
            <Button variant="outline" className="w-full gap-2 text-muted-foreground" onClick={() => signOut()}>
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>

          {/* Danger Zone — data export + account deletion (GDPR/CCPA) */}
          <Card className="border-rl-red/30 bg-rl-red/5">
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rl-red" />
                <p className="text-sm font-semibold text-rl-red">Danger Zone</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Download a JSON copy of everything we store about you, or permanently delete your account and all related data.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 flex-1"
                  onClick={handleExport}
                  disabled={exporting}
                >
                  {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Export my data
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 flex-1 border-rl-red/40 text-rl-red hover:bg-rl-red/10 hover:text-rl-red"
                  onClick={() => { setConfirmText(""); setConfirmOpen(true); }}
                  disabled={deleting}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
      <UpgradeSheet
        open={showUpgrade}
        onOpenChange={setShowUpgrade}
        currentTier={quota.tier}
        parsesUsed={quota.parsesUsed}
        quota={quota.quota}
      />
      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!deleting) setConfirmOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes your profile, games, ranks, tournaments, and uploaded images.
              This action cannot be undone. Type <span className="font-mono font-semibold text-foreground">DELETE</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            autoFocus
            disabled={deleting}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={confirmText !== "DELETE" || deleting}
              className="bg-rl-red text-white hover:bg-rl-red/90 focus:ring-rl-red"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete forever"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Settings;
