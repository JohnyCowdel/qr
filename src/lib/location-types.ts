export const LOCATION_TYPES = ["fortress", "tower", "town", "camp", "mine"] as const;

export type LocationType = (typeof LOCATION_TYPES)[number];

const DEFAULT_IMAGES: Record<LocationType, string> = {
  fortress: "🏰",
  tower: "🗼",
  town: "🏘️",
  camp: "⛺",
  mine: "⛏️",
};

export function defaultImageForType(type: LocationType): string {
  return DEFAULT_IMAGES[type] ?? DEFAULT_IMAGES.camp;
}

export function normalizeLocationType(value: string): LocationType {
  if (LOCATION_TYPES.includes(value as LocationType)) {
    return value as LocationType;
  }
  return "camp";
}
