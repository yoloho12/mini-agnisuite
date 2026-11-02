import type { LocationType, UserRole } from "@/types";

export interface LocationAccessUser {
  role: UserRole;
  site_id: string | null;
  assigned_locations: readonly string[];
}

export function canAccessLocation(
  user: LocationAccessUser | null | undefined,
  locationType: LocationType,
  locationId: string
): boolean {
  if (!user || !locationId) return false;
  if (user.role === "owner" || user.role === "manager") return true;
  if (user.assigned_locations.includes(locationId)) return true;
  return locationType === "SITE" && user.site_id === locationId;
}

export function accessibleLocationIds(
  user: LocationAccessUser | null | undefined,
  locationType: LocationType,
  knownLocationIds: Iterable<string>
): Set<string> {
  const knownIds = [...knownLocationIds];
  if (!user) return new Set();
  if (user.role === "owner" || user.role === "manager") return new Set(knownIds);
  return new Set(
    knownIds.filter((id) => canAccessLocation(user, locationType, id))
  );
}

export function normalizeAssignedLocations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item): string[] => {
    if (typeof item === "string") return item ? [item] : [];
    if (!item || typeof item !== "object") return [];
    const id = "id" in item ? item.id : null;
    return typeof id === "string" && id ? [id] : [];
  }))];
}
