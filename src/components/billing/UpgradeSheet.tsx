import { useState } from "react";
import { Zap, Infinity as InfinityIcon, Check, Loader2, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { SubscriptionTier } from "@/hooks/useQuota";

interface UpgradeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTier?: SubscriptionTier;
  parsesUsed?: number;
  quota?: number;
}

// Set these to your actual Stripe price IDs once you create them in the Stripe dashboard
const STRIPE_PRICE_PRO_MONTHLY = import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY as string | undefined;
const STRIPE_PRICE_LIFETIME    = import.meta.env.VITE_STRIPE_PRICE_LIFETIME as string | undefined;

const TIER_FEATURES = {
  free: [
    "100 photo parses / month",
    "Unlimited manual entry",
    "All stats & charts",
    "Friends & squad tracking",
  ],
  pro: [
    "1,000 photo parses / month",
    "No ads",
    "Everything in Free",
    "Priority support",
  ],
  lifetime: [
    "Unlimited photo parses",
    "No ads, forever",
    "Everything in Pro",
    "One-time payment",
  ],
};

const UpgradeSheet = ({ open, onOpenChange, currentTier = "free", parsesUsed, quota }: UpgradeSheetProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState<"pro" | "lifetime" | null>(null);

  const checkout = async (priceId: string | undefined, tier: "pro" | "lifetime") => {
    if (!priceId) {
      toast({
        title: "Coming soon",
        description: "Payments are being set up. Check back soon!",
      });
      return;
    }
    setLoading(tier);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          price_id: priceId,
          success_url: `${window.location.origin}/dashboard?upgraded=true`,
          cancel_url: window.location.href,
        },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Checkout failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const isAtLimit = parsesUsed !== undefined && quota !== undefined && parsesUsed >= quota;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[92dvh] overflow-y-auto pb-safe">
        <SheetHeader className="text-left mb-5">
          <SheetTitle className="font-display text-xl flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            {isAtLimit ? "You've hit your monthly limit" : "Upgrade ScoreboardRL"}
          </SheetTitle>
          {isAtLimit && (
            <p className="text-sm text-muted-foreground">
              You've used <span className="text-foreground font-semibold">{parsesUsed}/{quota}</span> photo parses this month.
              Upgrade to keep logging.
            </p>
          )}
        </SheetHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Pro card */}
          <TierCard
            name="Pro"
            price="$4"
            period="/month"
            features={TIER_FEATURES.pro}
            highlight={true}
            badge="Most Popular"
            isCurrent={currentTier === "pro"}
            loading={loading === "pro"}
            onSelect={() => checkout(STRIPE_PRICE_PRO_MONTHLY, "pro")}
          />

          {/* Lifetime card */}
          <TierCard
            name="Lifetime"
            price="$99"
            period="one-time"
            features={TIER_FEATURES.lifetime}
            highlight={false}
            badge="Best Value"
            isCurrent={currentTier === "lifetime"}
            loading={loading === "lifetime"}
            onSelect={() => checkout(STRIPE_PRICE_LIFETIME, "lifetime")}
            icon={<InfinityIcon className="w-4 h-4" />}
          />
        </div>

        {/* Free tier reminder */}
        <div className="mt-4 rounded-xl border border-border/30 bg-muted/20 p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">Your current plan · Free</p>
          <ul className="space-y-1">
            {TIER_FEATURES.free.map((f) => (
              <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                <Check className="w-3 h-3 shrink-0 text-muted-foreground/60" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
};

interface TierCardProps {
  name: string;
  price: string;
  period: string;
  features: string[];
  highlight: boolean;
  badge?: string;
  isCurrent: boolean;
  loading: boolean;
  onSelect: () => void;
  icon?: React.ReactNode;
}

const TierCard = ({ name, price, period, features, highlight, badge, isCurrent, loading, onSelect, icon }: TierCardProps) => (
  <div className={cn(
    "relative rounded-xl border p-4 space-y-3",
    highlight
      ? "border-primary/40 bg-primary/5"
      : "border-border/50 bg-card/60"
  )}>
    {badge && (
      <Badge
        className={cn(
          "absolute -top-2.5 left-3 text-[10px] px-2 py-0.5",
          highlight ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
        )}
      >
        {badge}
      </Badge>
    )}
    <div>
      <p className="font-display font-bold text-base flex items-center gap-1.5">
        {icon}
        {name}
      </p>
      <p className="mt-0.5">
        <span className="font-display font-bold text-2xl">{price}</span>
        <span className="text-xs text-muted-foreground ml-1">{period}</span>
      </p>
    </div>
    <ul className="space-y-1.5">
      {features.map((f) => (
        <li key={f} className="flex items-center gap-2 text-xs">
          <Check className={cn("w-3 h-3 shrink-0", highlight ? "text-primary" : "text-secondary")} />
          {f}
        </li>
      ))}
    </ul>
    {isCurrent ? (
      <Button variant="outline" className="w-full" disabled>Current plan</Button>
    ) : (
      <Button
        variant={highlight ? "hero" : "outline"}
        className="w-full"
        onClick={onSelect}
        disabled={loading}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : `Get ${name}`}
      </Button>
    )}
  </div>
);

export default UpgradeSheet;
