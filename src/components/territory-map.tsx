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
  area?: number;
  image?: string;
  summary: string;
  latitude: number;
  longitude: number;
  claimRadiusM: number;
  ownerTeam: TeamRef;
};

const LeafletMap = dynamic(() => import("./territory-map-inner"), {
  ssr: false,
});

export function TerritoryMap({ locations }: { locations: MapLocation[] }) {
  const center = useMemo(() => {
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
  }, [locations]);

  return <LeafletMap locations={locations} center={center} />;
}