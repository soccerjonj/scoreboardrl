import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Camera, BarChart3, Users } from "lucide-react";
import Logo from "@/components/ui/Logo";

const Index = () => {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  if (loading || user) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await signIn(email, password);
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("rl_account_name")
        .eq("user_id", userData.user?.id ?? "")
        .single();
      navigate(profile?.rl_account_name ? "/dashboard" : "/onboarding");
    } catch (err: any) {
      toast({ title: "Sign in failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Background accents */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(212,95%,55%,0.15),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,hsl(25,95%,55%,0.10),transparent_55%)]" />

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left: brand + pitch */}
          <div className="text-center lg:text-left">
            <Link to="/" className="inline-block mb-6">
              <Logo size="lg" />
            </Link>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] mb-4">
              Track every <span className="text-gradient-hero">Rocket League</span> match.
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-md mx-auto lg:mx-0 mb-6">
              Snap your scoreboard, log your stats, and see who really carries the team.
            </p>
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
              <Pill icon={<Camera className="w-4 h-4 text-primary" />} text="Snap & log" />
              <Pill icon={<BarChart3 className="w-4 h-4 text-secondary" />} text="Stats & trends" />
              <Pill icon={<Users className="w-4 h-4 text-rl-purple" />} text="Squad compare" />
            </div>
          </div>

          {/* Right: sign in card */}
          <div className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
            <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl">
              <h2 className="font-display text-2xl font-bold mb-1">Sign in</h2>
              <p className="text-sm text-muted-foreground mb-6">Welcome back — let's check those stats.</p>

              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link to="/auth" className="text-xs text-muted-foreground hover:text-primary">
                      Forgot?
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="current-password"
                  />
                </div>

                <Button type="submit" variant="hero" className="w-full" disabled={submitting}>
                  {submitting ? "Signing in…" : "Sign In"}
                </Button>
              </form>

              <p className="text-sm text-muted-foreground text-center mt-6">
                New here?{" "}
                <Link to="/auth" className="text-primary hover:underline font-medium">
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 py-6 px-4 text-center text-xs text-muted-foreground">
        Not affiliated with Psyonix or Epic Games. Rocket League is a registered trademark.
      </footer>
    </div>
  );
};

const Pill = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card/60 text-xs font-medium text-foreground">
    {icon}
    {text}
  </span>
);

export default Index;
