import { useEffect, useRef } from "react";
import type { SubscriptionTier } from "@/hooks/useQuota";

// Set VITE_CARBON_ADS_SERVE_ID in your .env after your Carbon Ads account is approved.
// It looks like: CKYD42JE (the value from your Carbon Ads script URL)
const CARBON_SERVE_ID = import.meta.env.VITE_CARBON_ADS_SERVE_ID as string | undefined;
const CARBON_PLACEMENT = import.meta.env.VITE_CARBON_ADS_PLACEMENT as string | undefined;

interface CarbonAdProps {
  tier: SubscriptionTier;
}

const CarbonAd = ({ tier }: CarbonAdProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only show ads to free users, and only if Carbon is configured
    if (tier !== "free" || !CARBON_SERVE_ID || !ref.current) return;

    // Remove any existing script to prevent duplicates on re-render
    const existing = document.getElementById("_carbonads_js");
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.id = "_carbonads_js";
    script.async = true;
    script.src = `//cdn.carbonads.com/carbon.js?serve=${CARBON_SERVE_ID}${CARBON_PLACEMENT ? `&placement=${CARBON_PLACEMENT}` : ""}`;
    ref.current.appendChild(script);

    return () => {
      script.remove();
      // Also remove the Carbon-injected #carbonads element if present
      document.getElementById("carbonads")?.remove();
    };
  }, [tier]);

  if (tier !== "free" || !CARBON_SERVE_ID) return null;

  return (
    <div
      ref={ref}
      className="opacity-60 hover:opacity-100 transition-opacity duration-300 flex justify-center my-1"
      aria-label="Advertisement"
    />
  );
};

export default CarbonAd;
