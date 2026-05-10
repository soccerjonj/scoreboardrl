import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, User, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export type SquadFriendOption = {
  userId: string;
  rlName: string;
  avatarUrl: string | null;
};

type Mode = { kind: "create" } | { kind: "edit"; squadId: string; initialName: string; initialMemberIds: string[] };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pool of friends the user can add as members. */
  friends: SquadFriendOption[];
  mode: Mode;
  /** Called after a successful save with the squad id (so the list can refresh). */
  onSaved?: (squadId: string) => void;
}

const MAX_MEMBERS = 3;

export default function SquadEditor({ open, onOpenChange, friends, mode, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Reset / seed form whenever the sheet opens
  useEffect(() => {
    if (!open) return;
    if (mode.kind === "edit") {
      setName(mode.initialName);
      setSelectedIds(new Set(mode.initialMemberIds));
    } else {
      setName("");
      setSelectedIds(new Set());
    }
  }, [open, mode]);

  const toggleMember = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        if (next.size >= MAX_MEMBERS) return prev;
        next.add(userId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (!trimmed) {
      toast({ title: "Squad needs a name", variant: "destructive" });
      return;
    }
    if (selectedIds.size === 0) {
      toast({ title: "Add at least one teammate", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let squadId: string;
      if (mode.kind === "create") {
        const { data: row, error } = await supabase
          .from("squads")
          .insert({ user_id: user.id, name: trimmed })
          .select("id")
          .single();
        if (error || !row) throw error;
        squadId = row.id;
      } else {
        squadId = mode.squadId;
        await supabase
          .from("squads")
          .update({ name: trimmed, updated_at: new Date().toISOString() })
          .eq("id", squadId);
        // Replace members: delete all, re-insert
        await supabase.from("squad_members").delete().eq("squad_id", squadId);
      }

      // Insert members
      const rows = Array.from(selectedIds).map((memberId) => ({
        squad_id: squadId,
        member_user_id: memberId,
      }));
      if (rows.length > 0) {
        const { error: memErr } = await supabase.from("squad_members").insert(rows);
        if (memErr) throw memErr;
      }

      toast({ title: mode.kind === "create" ? "Squad created" : "Squad updated" });
      onSaved?.(squadId);
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-10 max-h-[90dvh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{mode.kind === "create" ? "New Squad" : "Edit Squad"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="squad-name" className="text-xs uppercase tracking-wider text-muted-foreground">
              Squad name
            </Label>
            <Input
              id="squad-name"
              placeholder="e.g. Tourney Trio"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Teammates
              </Label>
              <span className="text-[10px] text-muted-foreground/70 font-mono">
                {selectedIds.size}/{MAX_MEMBERS} selected
              </span>
            </div>

            {friends.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/40 px-4 py-6 text-center">
                <User className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">
                  No friends yet — add ScoreboardRL friends first to build a squad.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[40dvh] overflow-y-auto">
                {friends.map((f) => {
                  const isSelected = selectedIds.has(f.userId);
                  const atCap = !isSelected && selectedIds.size >= MAX_MEMBERS;
                  return (
                    <button
                      key={f.userId}
                      onClick={() => toggleMember(f.userId)}
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
                        {f.avatarUrl ? (
                          <img src={f.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <span className="flex-1 text-sm font-medium truncate">{f.rlName}</span>
                      {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode.kind === "create" ? "Create squad" : "Save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
