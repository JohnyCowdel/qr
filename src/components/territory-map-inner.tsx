"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { divIcon, point } from "leaflet";
import { Circle, MapContainer, Marker, Polygon, Popup, TileLayer, useMapEvents } from "react-leaflet";

import { createRealmBorder } from "@/lib/realm";

import type { MapLocation } from "./territory-map";

function withOpacity(hexColor: string, opacity: string) {
  const normalized = hexColor.replace("#", "");
  return `#${normalized}${opacity}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildEmojiIcon(image?: string) {
  return buildEmojiIconForZoom(image, 15);
}

function getMarkerMetrics(zoom: number) {
  const normalizedZoom = Number.isFinite(zoom) ? zoom : 15;
  const size = Math.max(18, Math.min(34, 18 + (normalizedZoom - 10) * 3));
  const fontSize = Math.max(11, Math.min(20, size * 0.58));
  const borderWidth = Math.max(1.5, Math.min(2.5, size * 0.06));

  return {
    size,
    fontSize,
    borderWidth,
  };
}

function buildEmojiIconForZoom(image: string | undefined, zoom: number) {
  const safeEmoji = typeof image === "string" ? image.trim() : "";
  const metrics = getMarkerMetrics(zoom);
  return divIcon({
    className: "",
    iconSize: point(metrics.size, metrics.size),
    iconAnchor: point(metrics.size / 2, metrics.size / 2),
    html: `<div style="height:${metrics.size}px;width:${metrics.size}px;border-radius:9999px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:${metrics.fontSize}px;border:${metrics.borderWidth}px solid #d6cdc2;box-shadow:0 2px 6px rgba(0,0,0,.18)">${escapeHtml(safeEmoji || "⛺")}</div>`,
  });
}

function ZoomTracker({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend() {
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

export default function TerritoryMapInner({
  locations,
  center,
}: {
  locations: MapLocation[];
  center: [number, number];
}) {
  const [zoom, setZoom] = useState(15);
  const realmPoints = createRealmBorder(
    locations.map((location) => ({
      latitude: location.latitude,
      longitude: location.longitude,
    })),
    1.2,
  );

  return (
    <MapContainer center={center} zoom={15} scrollWheelZoom className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomTracker onZoomChange={setZoom} />

      {realmPoints.length >= 3 && (
        <Polygon
          positions={realmPoints.map((point) => [point.latitude, point.longitude] as [number, number])}
          pathOptions={{
            color: "#9e4323",
            weight: 3,
            dashArray: "10 8",
            fillColor: "#9e4323",
            fillOpacity: 0.05,
          }}
        />
      )}

      {locations.map((location) => {
        const color = location.ownerTeam?.colorHex ?? "#7a7a72";
        const icon = buildEmojiIconForZoom(location.image, zoom);
        const area = Number.isFinite(location.area) ? location.area : 1000;
        const type = location.type || "camp";
        const image = typeof location.image === "string" && location.image.trim() ? location.image : "⛺";

        return (
          <Fragment key={location.id}>
            <Circle
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
                  <div className="font-semibold">{image} {location.name}</div>
                  <div>{location.summary}</div>
                  <div className="font-mono text-xs text-[#5a6259]">
                    {type} · area={area}m · claim={location.claimRadiusM}m
                  </div>
                  <div>
                    Owner: {location.ownerTeam ? location.ownerTeam.name : "Neutral"}
                  </div>
                  <Link href={`/l/${location.slug}`} className="font-medium text-[#9e4323]">
                    Open location page
                  </Link>
                </div>
              </Popup>
            </Circle>
            <Marker position={[location.latitude, location.longitude]} icon={icon} />
          </Fragment>
        );
      })}
    </MapContainer>
  );
}