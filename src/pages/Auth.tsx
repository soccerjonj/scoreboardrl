import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import Logo from "@/components/ui/Logo";

type AuthMode = "signin" | "signup" | "forgot";

const Auth = () => {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resetPassword, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        // Check if onboarding is needed
        const { data: profile } = await supabase
          .from("profiles")
          .select("rl_account_name")
          .eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "")
          .single();
        navigate(profile?.rl_account_name ? "/dashboard" : "/onboarding");
      } else if (mode === "signup") {
        await signUp(email, password);
        toast({
          title: "Account created!",
          description: "Check your email to verify your account, then sign in to complete your profile setup.",
        });
      } else {
        await resetPassword(email);
        toast({
          title: "Reset email sent",
          description: "Check your inbox for a password reset link.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] bg-background overflow-y-auto">
      {/* Soft ambient glow — gives the auth screen a touch of depth */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, hsl(var(--primary) / 0.18) 0%, transparent 55%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 100%, hsl(250, 80%, 70%, 0.10) 0%, transparent 50%)",
        }}
      />

      <div
        className="relative min-h-[100dvh] flex flex-col items-center justify-center px-4 py-10"
        style={{
          paddingTop: "max(calc(env(safe-area-inset-top, 0px) + 2rem), 2rem)",
          paddingBottom: "max(calc(env(safe-area-inset-bottom, 0px) + 2rem), 2rem)",
        }}
      >
        <div className="w-full max-w-sm space-y-6 animate-fade-in-up">
          {/* Logo + tagline */}
          <Link to="/" className="block text-center group">
            <Logo size="lg" className="justify-center" />
            <p className="text-sm text-muted-foreground mt-2.5 tracking-wide">
              Rocket League stat tracker
            </p>
          </Link>

          <Card className="border-border/50 bg-card/70 backdrop-blur-md shadow-2xl shadow-primary/5">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-display">
                {mode === "signin" && "Welcome back"}
                {mode === "signup" && "Create account"}
                {mode === "forgot" && "Reset password"}
              </CardTitle>
              <CardDescription className="text-xs">
                {mode === "signin" && "Sign in to track your Rocket League stats"}
                {mode === "signup" && "Start tracking your RL journey"}
                {mode === "forgot" && "We'll send you a reset link"}
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                {mode !== "forgot" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      required
                      minLength={6}
                    />
                  </div>
                )}
              </CardContent>

              <CardFooter className="flex flex-col gap-3 pt-2">
                <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                  {loading ? "Loading..." : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
                </Button>

                {mode === "signin" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Forgot your password?
                    </button>
                    <div className="w-full pt-3 mt-1 border-t border-border/40 text-center">
                      <p className="text-xs text-muted-foreground">
                        Don't have an account?{" "}
                        <button type="button" onClick={() => setMode("signup")} className="text-primary font-semibold hover:underline">
                          Sign up
                        </button>
                      </p>
                    </div>
                  </>
                )}

                {mode === "signup" && (
                  <div className="w-full pt-3 mt-1 border-t border-border/40 text-center">
                    <p className="text-xs text-muted-foreground">
                      Already have an account?{" "}
                      <button type="button" onClick={() => setMode("signin")} className="text-primary font-semibold hover:underline">
                        Sign in
                      </button>
                    </p>
                  </div>
                )}

                {mode === "forgot" && (
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="text-xs text-primary hover:underline"
                  >
                    ← Back to sign in
                  </button>
                )}
              </CardFooter>
            </form>
          </Card>

          {/* Footer attribution */}
          <p className="text-center text-[10px] text-muted-foreground/60 tracking-wider uppercase">
            Track · Compare · Carry
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
