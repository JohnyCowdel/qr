"use client";

import TerritoryMapInner, { type UnifiedMapLocation } from "./territory-map-inner";
import type { AdminLocationDraft } from "./admin-locations-manager";

type Props = {
  locations: AdminLocationDraft[];
  selectedId: string | null;
  onSelectLocation: (id: string) => void;
  onMoveSelected: (latitude: number, longitude: number) => void;
  onViewportChange: (latitude: number, longitude: number) => void;
};

export function AdminLocationsMapInner({
  locations,
  selectedId,
  onSelectLocation,
  onMoveSelected,
  onViewportChange,
}: Props) {
  return (
    <TerritoryMapInner
      mode="edit"
      locations={locations as UnifiedMapLocation[]}
      selectedId={selectedId}
      onSelectLocation={onSelectLocation}
      onMoveSelected={onMoveSelected}
      onViewportChange={onViewportChange}
    />
  );
}
