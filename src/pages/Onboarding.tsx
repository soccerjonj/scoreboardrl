import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ChevronRight } from "lucide-react";

const Onboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [rlName, setRlName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  // If already onboarded, skip to dashboard
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("rl_account_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.rl_account_name) navigate("/dashboard");
      });
  }, [user, navigate]);

  const handleComplete = async () => {
    if (!user) return;
    if (!rlName.trim()) {
      toast({ title: "RL name required", description: "Please enter your Rocket League username.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Use RL name as both the username and rl_account_name
      const { error } = await supabase
        .from("profiles")
        .update({ username: rlName.trim(), rl_account_name: rlName.trim() })
        .eq("user_id", user.id);
      if (error) throw error;

      toast({ title: "Welcome to ScoreboardRL!" });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <span className="font-display text-3xl font-bold">
            <span className="text-primary">Scoreboard</span>
            <span className="text-secondary">RL</span>
          </span>
          <h2 className="text-xl font-display font-bold mt-3">One last thing</h2>
          <p className="text-sm text-muted-foreground mt-1">What's your Rocket League username?</p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Your RL Username</CardTitle>
            <CardDescription className="text-xs">
              This is how teammates will find and recognize you in the app. It should match your in-game name exactly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rlName">Rocket League Username</Label>
              <Input
                id="rlName"
                placeholder="e.g. Jstn"
                value={rlName}
                onChange={(e) => setRlName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleComplete(); }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                You can update this any time from your profile.
              </p>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleComplete}
          disabled={saving || !rlName.trim()}
          variant="hero"
          size="lg"
          className="w-full gap-2"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" />Saving...</>
          ) : (
            <>Go to Dashboard <ChevronRight className="w-4 h-4" /></>
          )}
        </Button>
      </div>
    </div>
  );
};

export default Onboarding;
