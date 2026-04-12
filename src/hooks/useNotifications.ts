import { useState, useCallback } from "react";

// Notifications table does not exist yet — this hook is a safe no-op stub.
export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
};

export function useNotifications() {
  const [notifications] = useState<Notification[]>([]);
  const [unreadCount] = useState(0);
  const [loading] = useState(false);

  const markRead = useCallback(async (_id: string) => {}, []);
  const markAllRead = useCallback(async () => {}, []);
  const sendNotification = useCallback(
    async (
      _targetUserId: string,
      _type: string,
      _title: string,
      _body?: string,
      _payload?: Record<string, unknown>
    ) => {},
    []
  );
  const refresh = useCallback(async () => {}, []);

  return { notifications, unreadCount, loading, markRead, markAllRead, sendNotification, refresh };
}
