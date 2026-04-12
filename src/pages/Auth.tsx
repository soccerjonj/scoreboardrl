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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block text-center mb-8">
          <span className="font-display text-3xl font-bold">
            <span className="text-primary">Scoreboard</span>
            <span className="text-secondary">RL</span>
          </span>
        </Link>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">
              {mode === "signin" && "Welcome Back"}
              {mode === "signup" && "Create Account"}
              {mode === "forgot" && "Reset Password"}
            </CardTitle>
            <CardDescription>
              {mode === "signin" && "Sign in to track your Rocket League stats"}
              {mode === "signup" && "Start tracking your RL journey"}
              {mode === "forgot" && "We'll send you a reset link"}
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {mode !== "forgot" && (
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                {loading ? "Loading..." : mode === "signin" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
              </Button>

              {mode === "signin" && (
                <>
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    Forgot your password?
                  </button>
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <button type="button" onClick={() => setMode("signup")} className="text-primary hover:underline">
                      Sign up
                    </button>
                  </p>
                </>
              )}

              {mode === "signup" && (
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button type="button" onClick={() => setMode("signin")} className="text-primary hover:underline">
                    Sign in
                  </button>
                </p>
              )}

              {mode === "forgot" && (
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="text-sm text-primary hover:underline"
                >
                  Back to sign in
                </button>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
