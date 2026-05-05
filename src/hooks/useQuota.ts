import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionTier = "free" | "pro" | "lifetime";

export interface QuotaInfo {
  tier: SubscriptionTier;
  parsesUsed: number;
  quota: number;
  nearLimit: boolean;    // >= 80% used
  isOverLimit: boolean;
  isLoading: boolean;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  refetch: () => void;
}

export const TIER_QUOTAS: Record<SubscriptionTier, number> = {
  free: 100,
  pro: 1000,
  lifetime: 999999,
};

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function useQuota(): QuotaInfo {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [parsesUsed, setParsesUsed] = useState(0);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) { setIsLoading(false); return; }
    setIsLoading(true);
    try {
      const [subRes, usageRes] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("tier, current_period_end, cancel_at_period_end")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("parse_usage")
          .select("parse_count")
          .eq("user_id", user.id)
          .eq("month", firstOfMonth())
          .single(),
      ]);
      setTier((subRes.data?.tier as SubscriptionTier) ?? "free");
      setCurrentPeriodEnd(subRes.data?.current_period_end ?? null);
      setCancelAtPeriodEnd(subRes.data?.cancel_at_period_end ?? false);
      setParsesUsed(usageRes.data?.parse_count ?? 0);
    } catch {
      // Non-fatal — treat as free with 0 used
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  const quota = TIER_QUOTAS[tier];
  return {
    tier,
    parsesUsed,
    quota,
    nearLimit: parsesUsed >= quota * 0.8,
    isOverLimit: parsesUsed >= quota,
    isLoading,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    refetch: fetch,
  };
}
