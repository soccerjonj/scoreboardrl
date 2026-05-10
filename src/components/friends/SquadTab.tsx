import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, Users2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import SquadCard, { type SquadCardData } from "./SquadCard";
import SquadEditor, { type SquadFriendOption } from "./SquadEditor";

interface SquadTabProps {
  friends: SquadFriendOption[];
  loadingFriends: boolean;
}

const SquadTab = ({ friends, loadingFriends }: SquadTabProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [squads, setSquads] = useState<SquadCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSquad, setEditingSquad] = useState<SquadCardData | null>(null);

  const loadSquads = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch squads with their members in one query
      const { data, error } = await supabase
        .from("squads")
        .select("id, name, created_at, updated_at, squad_members(member_user_id)")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as any[];
      if (rows.length === 0) { setSquads([]); return; }

      // Resolve member display names + avatars from profiles in one round-trip
      const memberIds = Array.from(
        new Set(rows.flatMap((s) => (s.squad_members ?? []).map((m: any) => m.member_user_id)))
      );
      const profileMap = new Map<string, { rl_account_name: string | null; username: string | null; avatar_url: string | null }>();
      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, rl_account_name, username, avatar_url")
          .in("user_id", memberIds);
        (profiles ?? []).forEach((p: any) => profileMap.set(p.user_id, p));
      }

      const enriched: SquadCardData[] = rows.map((s) => ({
        id: s.id,
        name: s.name,
        members: (s.squad_members ?? []).map((m: any) => {
          const prof = profileMap.get(m.member_user_id);
          return {
            userId: m.member_user_id,
            rlName: prof?.rl_account_name ?? prof?.username ?? "Unknown",
            avatarUrl: prof?.avatar_url ?? null,
          };
        }),
      }));

      setSquads(enriched);
    } catch (err: any) {
      toast({ title: "Failed to load squads", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => { loadSquads(); }, [loadSquads]);

  const handleDelete = async (squadId: string) => {
    try {
      const { error } = await supabase.from("squads").delete().eq("id", squadId);
      if (error) throw error;
      setSquads((prev) => prev.filter((s) => s.id !== squadId));
      toast({ title: "Squad deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const openCreate = () => { setEditingSquad(null); setEditorOpen(true); };
  const openEdit = (squad: SquadCardData) => { setEditingSquad(squad); setEditorOpen(true); };

  if (!user) return null;

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Users2 className="w-3.5 h-3.5 text-primary" />
            Your Squads
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
            Save your favorite teammate combos to track chemistry over time.
          </p>
        </div>
        <Button
          onClick={openCreate}
          variant="hero"
          size="sm"
          className="gap-1.5 shrink-0"
          disabled={friends.length === 0}
          title={friends.length === 0 ? "Add ScoreboardRL friends first" : undefined}
        >
          <Plus className="w-4 h-4" /> New
        </Button>
      </div>

      {/* List */}
      {loading || loadingFriends ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : squads.length === 0 ? (
        <Card className="border-border/50 bg-card/80 border-dashed">
          <CardContent className="py-10 text-center space-y-3">
            <Users2 className="w-10 h-10 text-muted-foreground/30 mx-auto" />
            <div>
              <p className="text-sm text-muted-foreground">No squads yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {friends.length === 0
                  ? "Add ScoreboardRL friends first, then come back to build your squad."
                  : "Save your favorite teammate combos to track chemistry over time."}
              </p>
            </div>
            {friends.length > 0 && (
              <Button onClick={openCreate} variant="outline" size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Create your first squad
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {squads.map((s) => (
            <SquadCard
              key={s.id}
              squad={s}
              viewerUserId={user.id}
              onEdit={() => openEdit(s)}
              onDelete={() => handleDelete(s.id)}
            />
          ))}
        </div>
      )}

      <SquadEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        friends={friends}
        mode={
          editingSquad
            ? {
                kind: "edit",
                squadId: editingSquad.id,
                initialName: editingSquad.name,
                initialMemberIds: editingSquad.members.map((m) => m.userId),
              }
            : { kind: "create" }
        }
        onSaved={() => loadSquads()}
      />
    </div>
  );
};

export default SquadTab;
