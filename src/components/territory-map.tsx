"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";

type TeamRef = {
  name: string;
  colorHex: string;
} | null;

export type MapLocation = {
  id: number;
  slug: string;
  name: string;
  type?: string;
  armor?: number;
  area?: number;
  minPopulation?: number;
  maxPopulation?: number;
  currentPopulation?: number;
  image?: string;
  summary: string;
  latitude: number;
  longitude: number;
  claimRadiusM: number;
  ownerTeam: TeamRef;
};

type TerritoryMapProps = {
  locations: MapLocation[];
  center?: [number, number];
  initialZoom?: number;
  autoFitBounds?: boolean;
};

const LeafletMap = dynamic(() => import("./territory-map-inner"), {
  ssr: false,
});

export function TerritoryMap({ locations, center, initialZoom, autoFitBounds = true }: TerritoryMapProps) {
  const derivedCenter = useMemo(() => {
    if (center) {
      return center;
    }

    if (!locations.length) {
      return [49.7332, 15.768] as [number, number];
    }

    const latitude =
      locations.reduce((total, location) => total + location.latitude, 0) /
      locations.length;
    const longitude =
      locations.reduce((total, location) => total + location.longitude, 0) /
      locations.length;

    return [latitude, longitude] as [number, number];
  }, [center, locations]);

  return <LeafletMap locations={locations} center={derivedCenter} initialZoom={initialZoom} autoFitBounds={autoFitBounds} />;
}