import type { PillTone } from "@/components/status-pill";

// Booking status → pill colour, shared by the admin app and the public pages.
export const STATUS_TONE: Record<string, PillTone> = {
  pending: "warning",
  confirmed: "info",
  arrived: "arrived",
  in_progress: "progress",
  completed: "success",
  cancelled_by_client: "neutral",
  cancelled_by_business: "neutral",
  no_show: "danger",
};
