import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";

const Index = lazy(() => import("./pages/Index.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Stats = lazy(() => import("./pages/Stats.tsx"));
const LogGame = lazy(() => import("./pages/LogGame.tsx"));
const Friends = lazy(() => import("./pages/Friends.tsx"));
const Notifications = lazy(() => import("./pages/Notifications.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));
const Settings = lazy(() => import("./pages/Settings.tsx"));
const FriendProfile = lazy(() => import("./pages/FriendProfile.tsx"));
const SquadCompare = lazy(() => import("./pages/SquadCompare.tsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Onboarding = lazy(() => import("./pages/Onboarding.tsx"));
const Leaderboard = lazy(() => import("./pages/Leaderboard.tsx"));
const Tournaments = lazy(() => import("./pages/Tournaments.tsx"));

const queryClient = new QueryClient();

const RouteLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/log-game" element={<LogGame />} />
              <Route path="/friends" element={<Friends />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile/:userId" element={<FriendProfile />} />
              <Route path="/squad" element={<Navigate to="/friends" replace />} />
              <Route path="/squad/:id/compare" element={<SquadCompare />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/tournaments" element={<Tournaments />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/onboarding" element={<Onboarding />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
