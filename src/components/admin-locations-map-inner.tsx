"use client";

import { useEffect, useState } from "react";
import { divIcon, point } from "leaflet";
import { Circle, MapContainer, Marker, Polygon, Popup, TileLayer, useMapEvents } from "react-leaflet";
import { Fragment } from "react";

import { createRealmBorder } from "@/lib/realm";

import type { AdminLocationDraft } from "./admin-locations-manager";

type Props = {
  locations: AdminLocationDraft[];
  selectedId: string | null;
  onSelectLocation: (id: string) => void;
  onMoveSelected: (latitude: number, longitude: number) => void;
  onViewportChange: (latitude: number, longitude: number) => void;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildEmojiIcon(image: string | undefined, isSelected: boolean) {
  return buildEmojiIconForZoom(image, isSelected, 14);
}

function getMarkerMetrics(zoom: number, isSelected: boolean) {
  const normalizedZoom = Number.isFinite(zoom) ? zoom : 14;
  const baseSize = Math.max(18, Math.min(36, 18 + (normalizedZoom - 9) * 3));
  const size = isSelected ? baseSize + 2 : baseSize;
  const fontSize = Math.max(11, Math.min(20, size * 0.58));
  const borderWidth = isSelected
    ? Math.max(2, Math.min(3, size * 0.08))
    : Math.max(1.5, Math.min(2.5, size * 0.06));

  return {
    size,
    fontSize,
    borderWidth,
  };
}

function buildEmojiIconForZoom(image: string | undefined, isSelected: boolean, zoom: number) {
  const ring = isSelected ? "3px solid #d56c32" : "2px solid #d6cdc2";
  const raw = typeof image === "string" ? image : "";
  const safeImage = escapeHtml(raw.trim() || "⛺");
  const metrics = getMarkerMetrics(zoom, isSelected);
  return divIcon({
    className: "",
    iconSize: point(metrics.size, metrics.size),
    iconAnchor: point(metrics.size / 2, metrics.size / 2),
    html: `<div style="height:${metrics.size}px;width:${metrics.size}px;border-radius:9999px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:${metrics.fontSize}px;border:${metrics.borderWidth}px solid ${isSelected ? "#d56c32" : "#d6cdc2"};box-shadow:0 2px 6px rgba(0,0,0,.18)">${safeImage}</div>`,
  });
}

function ViewportTracker({ onViewportChange }: { onViewportChange: (latitude: number, longitude: number) => void }) {
  const map = useMapEvents({
    moveend() {
      const center = map.getCenter();
      onViewportChange(center.lat, center.lng);
    },
    zoomend() {
      const center = map.getCenter();
      onViewportChange(center.lat, center.lng);
    },
  });

  useEffect(() => {
    const center = map.getCenter();
    onViewportChange(center.lat, center.lng);
  }, [map, onViewportChange]);

  return null;
}

function ClickHandler({ selectedId, onMoveSelected }: { selectedId: string | null; onMoveSelected: (latitude: number, longitude: number) => void }) {
  useMapEvents({
    click(event) {
      if (!selectedId) {
        return;
      }

      onMoveSelected(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
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

export function AdminLocationsMapInner({ locations, selectedId, onSelectLocation, onMoveSelected, onViewportChange }: Props) {
  const [zoom, setZoom] = useState(14);
  const center = locations.length
    ? ([
        Number.isFinite(locations[0].latitude) ? locations[0].latitude : 49.7332,
        Number.isFinite(locations[0].longitude) ? locations[0].longitude : 15.768,
      ] as [number, number])
    : ([49.7332, 15.768] as [number, number]);

  return (
    <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      <ZoomTracker onZoomChange={setZoom} />
      <ViewportTracker onViewportChange={onViewportChange} />
      <ClickHandler selectedId={selectedId} onMoveSelected={onMoveSelected} />
      {(() => {
        const realmPoints = createRealmBorder(
          locations.map((location) => ({
            latitude: location.latitude,
            longitude: location.longitude,
          })),
          1.1,
        );

        if (realmPoints.length < 3) {
          return null;
        }

        return (
          <Polygon
            positions={realmPoints.map((point) => [point.latitude, point.longitude] as [number, number])}
            pathOptions={{
              color: "#d56c32",
              weight: 3,
              dashArray: "10 8",
              fillColor: "#d56c32",
              fillOpacity: 0.06,
            }}
          />
        );
      })()}
      {locations.map((location) => {
        const isSelected = location.id === selectedId;
        const color = location.ownerTeam?.colorHex ?? "#7a7a72";
        const icon = buildEmojiIconForZoom(location.image, isSelected, zoom);
        const latitude = Number.isFinite(location.latitude) ? location.latitude : 49.7332;
        const longitude = Number.isFinite(location.longitude) ? location.longitude : 15.768;
        const area = Number.isFinite(location.area) ? Math.max(1, location.area) : 1000;
        const claimRadiusM = Number.isFinite(location.claimRadiusM)
          ? Math.max(1, location.claimRadiusM)
          : 50;
        const image = typeof location.image === "string" && location.image.trim() ? location.image : "⛺";
        const type = location.type || "camp";

        return (
          <Fragment key={location.id}>
            <Circle
              center={[latitude, longitude]}
              radius={claimRadiusM}
              pathOptions={{
                color: isSelected ? "#d56c32" : color,
                fillColor: color,
                fillOpacity: isSelected ? 0.26 : 0.15,
                weight: isSelected ? 3 : 2,
              }}
              eventHandlers={{
                click: () => onSelectLocation(location.id),
              }}
            />
            <Marker
              position={[latitude, longitude]}
              icon={icon}
              eventHandlers={{
                click: () => onSelectLocation(location.id),
              }}
            >
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold">{image} {location.name}</p>
                  <p className="text-xs">{location.summary}</p>
                  <p className="text-xs font-mono text-slate-600">
                    {type} · area={area}m · claim={claimRadiusM}m
                  </p>
                  <p className="text-xs font-mono text-slate-600">
                    {latitude.toFixed(5)}, {longitude.toFixed(5)}
                  </p>
                  <button
                    type="button"
                    onClick={() => onSelectLocation(location.id)}
                    className="mt-2 text-xs font-semibold text-[var(--accent-strong)]"
                  >
                    Edit this location
                  </button>
                </div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}