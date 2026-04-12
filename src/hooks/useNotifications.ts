import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);
  // Use a stable unique channel name per hook instance to avoid the
  // "cannot add callbacks after subscribe()" error when multiple components
  // call this hook simultaneously (BottomNav, TopNav, Notifications page).
  const channelName = useRef(`notifications:${user?.id ?? "anon"}:${Math.random().toString(36).slice(2)}`);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const rows = data ?? [];
    setNotifications(rows);
    setUnreadCount(rows.filter((n) => !n.read).length);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchNotifications();

    // Real-time subscription — new notifications pop the badge immediately.
    // Each hook instance gets a unique channel name so multiple subscribers
    // don't conflict with each other.
    const channel = supabase
      .channel(channelName.current)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
          setUnreadCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, [user]);

  /** Insert a notification for another user (called client-side after game save) */
  const sendNotification = useCallback(async (
    targetUserId: string,
    type: Database["public"]["Enums"]["notification_type"],
    title: string,
    body?: string,
    payload?: Record<string, unknown>
  ) => {
    await supabase.from("notifications").insert({
      user_id: targetUserId,
      type,
      title,
      body: body ?? null,
      payload: payload ?? {},
    });
  }, []);

  return { notifications, unreadCount, loading, markRead, markAllRead, sendNotification, refresh: fetchNotifications };
}
