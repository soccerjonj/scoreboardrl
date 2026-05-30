/**
 * Build-time feature flags.
 *
 * BILLING_ENABLED — gates all paid-tier UI (Upgrade buttons, "Go Pro",
 * UpgradeSheet entry points). Defaults to OFF so the public launch ships
 * free-only without ripping out the billing code. Flip on by setting
 * VITE_BILLING_ENABLED=true in the deploy environment once Stripe is live.
 */
export const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === "true";
