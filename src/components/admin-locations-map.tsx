"use client";

import dynamic from "next/dynamic";

import type { AdminLocationDraft } from "./admin-locations-manager";

const Inner = dynamic(
  () => import("./admin-locations-map-inner").then((module) => module.AdminLocationsMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full rounded-xl bg-[var(--background-strong)] animate-pulse" />
    ),
  },
);

type Props = {
  locations: AdminLocationDraft[];
  selectedId: string | null;
  onSelectLocation: (id: string) => void;
  onMoveSelected: (latitude: number, longitude: number) => void;
  onViewportChange: (latitude: number, longitude: number) => void;
};

export function AdminLocationsMap(props: Props) {
  return <Inner {...props} />;
}