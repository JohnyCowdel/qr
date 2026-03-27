"use client";

import Link from "next/link";
import { Circle, MapContainer, Popup, TileLayer } from "react-leaflet";

import type { MapLocation } from "./territory-map";

function withOpacity(hexColor: string, opacity: string) {
  const normalized = hexColor.replace("#", "");
  return `#${normalized}${opacity}`;
}

export default function TerritoryMapInner({
  locations,
  center,
}: {
  locations: MapLocation[];
  center: [number, number];
}) {
  return (
    <MapContainer center={center} zoom={15} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {locations.map((location) => {
        const color = location.ownerTeam?.colorHex ?? "#7a7a72";

        return (
          <Circle
            key={location.id}
            center={[location.latitude, location.longitude]}
            radius={location.claimRadiusM}
            pathOptions={{
              color,
              fillColor: withOpacity(color, "44"),
              fillOpacity: 0.45,
              weight: 2,
            }}
          >
            <Popup>
              <div className="space-y-2 text-sm text-[#223027]">
                <div className="font-semibold">{location.name}</div>
                <div>{location.summary}</div>
                <div>
                  Owner: {location.ownerTeam ? location.ownerTeam.name : "Neutral"}
                </div>
                <Link href={`/l/${location.slug}`} className="font-medium text-[#9e4323]">
                  Open location page
                </Link>
              </div>
            </Popup>
          </Circle>
        );
      })}
    </MapContainer>
  );
}