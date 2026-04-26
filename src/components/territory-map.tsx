"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";

type TeamRef = {
  name: string;
  colorHex: string;
  emoji?: string;
} | null;

type OwnerUserRef = {
  handle: string;
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
  ownerUser?: OwnerUserRef;
};

type TerritoryMapProps = {
  locations: MapLocation[];
  center?: [number, number];
  initialZoom?: number;
  autoFitBounds?: boolean;
  enableFullscreen?: boolean;
};

const LeafletMap = dynamic(() => import("./territory-map-inner"), {
  ssr: false,
});

export function TerritoryMap({ locations, center, initialZoom, autoFitBounds = true, enableFullscreen = false }: TerritoryMapProps) {
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

  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    }

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  async function toggleFullscreen() {
    if (!enableFullscreen) {
      return;
    }

    if (document.fullscreenElement === wrapperRef.current) {
      await document.exitFullscreen();
      return;
    }

    if (wrapperRef.current) {
      await wrapperRef.current.requestFullscreen();
    }
  }

  return (
    <div ref={wrapperRef} className="relative h-full w-full bg-white">
      {enableFullscreen ? (
        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute right-3 top-3 z-[1000] rounded-full border border-[var(--line)] bg-white/90 px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-white"
        >
          {isFullscreen ? "Zavřít celou obrazovku" : "Celá obrazovka"}
        </button>
      ) : null}
      <LeafletMap locations={locations} center={derivedCenter} initialZoom={initialZoom} autoFitBounds={autoFitBounds} />
    </div>
  );
}