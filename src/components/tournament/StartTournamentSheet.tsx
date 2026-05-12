import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2, Trophy, ChevronLeft, Check, User } from "lucide-react";
import { useTournamentSession, TournamentType, TOURNAMENT_TYPE_LABELS } from "@/hooks/useTournamentSession";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type GameMode = Database["public"]["Enums"]["game_mode"];

type FriendOption = {
  user_id: string;
  rl_name: string;
  username: string;
  avatar_url: string | null;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function StartTournamentSheet({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { startTournament } = useTournamentSession();

  const [step, setStep] = useState<"mode" | "type" | "partners">("mode");
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);
  const [selectedType, setSelectedType] = useState<TournamentType | null>(null);
  const [selectedPartners, setSelectedPartners] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendOption[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [starting, setStarting] = useState(false);

  // Load friend list when entering the partners step
  useEffect(() => {
    if (step !== "partners" || !user || friends.length > 0) return;
    setLoadingFriends(true);
    (async () => {
      const { data: fr } = await supabase
        .from("friend_requests")
        .select("sender_id, receiver_id")
        .eq("status", "accepted")
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);
      const friendIds = (fr ?? [])
        .map((r) => (r.sender_id === user.id ? r.receiver_id : r.sender_id))
        .filter((id): id is string => !!id);
      if (friendIds.length === 0) {
        setFriends([]);
        setLoadingFriends(false);
        return;
      }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, username, rl_account_name, avatar_url")
        .in("user_id", friendIds);
      const opts: FriendOption[] = (profiles ?? []).map((p: any) => ({
        user_id: p.user_id,
        rl_name: p.rl_account_name ?? p.username ?? "Unknown",
        username: p.username ?? "",
        avatar_url: p.avatar_url ?? null,
      }));
      setFriends(opts);
      setLoadingFriends(false);
    })();
  }, [step, user, friends.length]);

  const reset = () => {
    setStep("mode");
    setSelectedMode(null);
    setSelectedType(null);
    setSelectedPartners([]);
  };

  const handleModeSelect = (mode: GameMode) => {
    setSelectedMode(mode);
    setStep("type");
  };

  const handleTypeSelect = (type: TournamentType) => {
    setSelectedType(type);
    // 1v1 has no teammates, skip the partner step entirely
    if (selectedMode === "1v1") {
      void launch(type, []);
    } else {
      setStep("partners");
    }
  };

  const togglePartner = (uid: string) => {
    const maxPartners = selectedMode === "2v2" ? 1 : 2; // 3v3 → up to 2 friends
    setSelectedPartners((prev) => {
      if (prev.includes(uid)) return prev.filter((p) => p !== uid);
      if (prev.length >= maxPartners) return prev; // cap reached
      return [...prev, uid];
    });
  };

  const launch = async (type: TournamentType, partnerIds: string[]) => {
    if (!selectedMode) return;
    setStarting(true);
    try {
      await startTournament(selectedMode, type, partnerIds);
      onOpenChange(false);
      reset();
      navigate("/log-game");
    } catch {
      toast({ title: "Failed to start tournament", variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const handleBack = () => {
    if (step === "type") { setStep("mode"); setSelectedMode(null); }
    else if (step === "partners") { setStep("type"); setSelectedType(null); setSelectedPartners([]); }
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  const titleText =
    step === "mode" ? "Start Tournament"
      : step === "type" ? `${selectedMode} Tournament`
      : `${selectedMode} ${selectedType ? TOURNAMENT_TYPE_LABELS[selectedType] : ""}`;

  const maxPartners = selectedMode === "2v2" ? 1 : 2;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-10 max-h-[90dvh] overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center gap-2">
            {step !== "mode" && (
              <button onClick={handleBack} className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <Trophy className="w-5 h-5 text-yellow-400" />
            {titleText}
          </SheetTitle>
        </SheetHeader>

        {step === "mode" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">Choose your team size:</p>
            <div className="grid grid-cols-2 gap-3">
              {(["2v2", "3v3"] as GameMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleModeSelect(mode)}
                  className="flex flex-col items-center gap-2 p-6 rounded-xl border border-border/60 bg-card/60 hover:border-primary/50 hover:bg-primary/5 transition-all"
                >
                  <span className="font-display font-bold text-2xl text-primary">{mode}</span>
                  <span className="text-xs text-muted-foreground">Tournament</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "type" && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-4">Choose the tournament variant:</p>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(TOURNAMENT_TYPE_LABELS) as TournamentType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeSelect(type)}
                  disabled={starting}
                  className={cn(
                    "flex flex-col items-center gap-2 p-5 rounded-xl border border-border/60 bg-card/60",
                    "hover:border-primary/50 hover:bg-primary/5 transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {starting && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                  <span className="font-semibold text-sm">{TOURNAMENT_TYPE_LABELS[type]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "partners" && selectedType && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">
                Playing with friends? Add them as co-pilots — they'll enter Tournament Mode automatically and can log games too.
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Up to {maxPartners} friend{maxPartners === 1 ? "" : "s"} · {selectedPartners.length}/{maxPartners} selected
              </p>
            </div>

            {loadingFriends ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : friends.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/40 px-4 py-6 text-center">
                <User className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  No friends yet — add ScoreboardRL friends to play co-op tournaments together.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[40dvh] overflow-y-auto">
                {friends.map((f) => {
                  const isSelected = selectedPartners.includes(f.user_id);
                  const atCap = !isSelected && selectedPartners.length >= maxPartners;
                  return (
                    <button
                      key={f.user_id}
                      onClick={() => togglePartner(f.user_id)}
                      disabled={atCap}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left",
                        isSelected
                          ? "bg-primary/10 border-primary/40"
                          : "bg-card/40 border-border/40 hover:border-border",
                        atCap && "opacity-40 cursor-not-allowed"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-muted/50 flex items-center justify-center shrink-0">
                        {f.avatar_url ? (
                          <img src={f.avatar_url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{f.rl_name}</p>
                        {f.username && f.username !== f.rl_name && (
                          <p className="text-xs text-muted-foreground truncate">@{f.username}</p>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={() => launch(selectedType, selectedPartners)}
                disabled={starting}
                className="w-full gap-2"
              >
                {starting && <Loader2 className="w-4 h-4 animate-spin" />}
                {selectedPartners.length === 0
                  ? "Continue Solo"
                  : `Start with ${selectedPartners.length} friend${selectedPartners.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
