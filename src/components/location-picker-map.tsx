"use client";

import dynamic from "next/dynamic";

const Inner = dynamic(
  () => import("./location-picker-map-inner").then((m) => m.LocationPickerMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full bg-[var(--background-strong)] rounded-lg animate-pulse" />
    ),
  },
);

interface Props {
  lat: number;
  lng: number;
  radiusM: number;
  onPick: (lat: number, lng: number) => void;
}

export function LocationPickerMap(props: Props) {
  return <Inner {...props} />;
}
