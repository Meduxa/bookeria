import type { PillTone } from "@/components/status-pill";

// Business status → pill colour in the platform admin area.
export const TENANT_TONE: Record<string, PillTone> = {
  trial: "info",
  active: "success",
  past_due: "warning",
  suspended: "danger",
  cancelled: "neutral",
};
