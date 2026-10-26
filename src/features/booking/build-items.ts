import { totalFor, type EngineData, type ServiceRequest } from "./engine/availability";

export type BookingItemInput = {
  service_id: string;
  variant_id: string | null;
  staff_id: string;
  resource_id: string | null;
  starts_at: string;
};

// Services run back to back with the same person; a chair/room is picked if
// one is needed. Shared by the admin calendar and the public booking page so
// both build bookings the same way.
export function buildItems(
  data: EngineData,
  input: {
    staffId: string;
    start: Date;
    services: ServiceRequest[];
    picks: { serviceId: string; variantId?: string | null }[];
    resourceId?: string | null; // already chosen by the engine (public page)
  },
): BookingItemInput[] {
  const staff = data.staff.find((s) => s.id === input.staffId)!;
  const total = totalFor(staff, input.services)!;
  const resourceType = input.services.find((s) => s.resourceType)?.resourceType;
  let resourceId = input.resourceId ?? null;
  if (resourceType && !resourceId) {
    const start = input.start.getTime();
    const end = start + (total.durationMin + total.bufferMin) * 60_000;
    resourceId =
      data.resources
        .filter((r) => r.type === resourceType)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .find((r) => !r.busy.some(([s, e]) => s < end && start < e))?.id ?? null;
  }
  let t = input.start.getTime();
  return input.services.map((s) => {
    const item = {
      service_id: s.serviceId,
      variant_id: input.picks.find((p) => p.serviceId === s.serviceId)?.variantId ?? null,
      staff_id: input.staffId,
      resource_id: resourceId,
      starts_at: new Date(t).toISOString(),
    };
    t += ((staff.services[s.serviceId].durationMin ?? s.durationMin) + (s.addonMin ?? 0)) * 60_000;
    return item;
  });
}
