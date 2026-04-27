"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { divIcon, point } from "leaflet";
import { Circle, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";

import {
  calculateLocationAreasSquareMeters,
  createRealmBorder,
  createRealmBordersFromLocationPolygons,
  createRealmLocationPolygons,
  createRealmTileAssignments,
  findRealmLocationPolygonAtPoint,
  smoothRealmLocationPolygons,
} from "@/lib/realm";
import { baseArmorForType, normalizeLocationType } from "@/lib/location-types";

type TeamRef = {
  id?: number;
  name: string;
  colorHex: string;
  emoji?: string;
} | null;

type OwnerUserRef = {
  handle: string;
} | null;

export type UnifiedMapLocation = {
  id: string | number;
  slug?: string | null;
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

type TerritoryMapInnerProps = {
  locations: UnifiedMapLocation[];
  center?: [number, number];
  initialZoom?: number;
  autoFitBounds?: boolean;
  mode?: "view" | "edit";
  selectedId?: string | null;
  onSelectLocation?: (id: string) => void;
  onMoveSelected?: (latitude: number, longitude: number) => void;
  onViewportChange?: (latitude: number, longitude: number) => void;
};

const PRIMARY_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const FALLBACK_TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const PRIMARY_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const FALLBACK_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

function formatPopulation(population: number) {
  return new Intl.NumberFormat("cs").format(Math.floor(population));
}

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

function getMarkerMetrics(zoom: number, isSelected: boolean) {
  const normalizedZoom = Number.isFinite(zoom) ? zoom : 15;
  const baseSize = Math.max(18, Math.min(34, 18 + (normalizedZoom - 10) * 3));
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

function buildEmojiIconForZoom(image: string | undefined, zoom: number, isSelected: boolean) {
  const safeEmoji = typeof image === "string" ? image.trim() : "";
  const metrics = getMarkerMetrics(zoom, isSelected);
  return divIcon({
    className: "",
    iconSize: point(metrics.size, metrics.size),
    iconAnchor: point(metrics.size / 2, metrics.size / 2),
    html: `<div style="height:${metrics.size}px;width:${metrics.size}px;border-radius:9999px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:${metrics.fontSize}px;border:${metrics.borderWidth}px solid ${isSelected ? "#d56c32" : "#d6cdc2"};box-shadow:0 2px 6px rgba(0,0,0,.18)">${escapeHtml(safeEmoji || "⛺")}</div>`,
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

function HoverTracker({
  locationPolygons,
  realmPoints,
  onHoverChange,
}: {
  locationPolygons: ReturnType<typeof createRealmLocationPolygons>;
  realmPoints: ReturnType<typeof createRealmBorder>;
  onHoverChange: (locationId: string | null) => void;
}) {
  useMapEvents({
    mousemove(event) {
      const polygon = findRealmLocationPolygonAtPoint(
        locationPolygons,
        { latitude: event.latlng.lat, longitude: event.latlng.lng },
        realmPoints,
      );
      onHoverChange(polygon?.locationId ?? null);
    },
    mouseout() {
      onHoverChange(null);
    },
  });

  return null;
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

function MapSizeInvalidator() {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => {
      map.invalidateSize(false);
    };

    // Mobile browsers can report unstable container dimensions during initial paint.
    const t1 = window.setTimeout(invalidate, 0);
    const t2 = window.setTimeout(invalidate, 250);

    window.addEventListener("resize", invalidate);
    window.addEventListener("orientationchange", invalidate);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("orientationchange", invalidate);
    };
  }, [map]);

  return null;
}

function AutoFitBounds({
  bounds,
}: {
  bounds: [[number, number], [number, number]] | null;
}) {
  const map = useMap();
  const didFit = useRef(false);

  useEffect(() => {
    if (!bounds || didFit.current) {
      return;
    }
    didFit.current = true;
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [map, bounds]);

  return null;
}

/**
 * Popup content that fetches fresh location data when it mounts.
 * Shows stale SSR values immediately, then swaps in live data.
 */
function LocationPopupContent({ location }: { location: UnifiedMapLocation }) {
  const [live, setLive] = useState<UnifiedMapLocation | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/locations", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (cancelled || !Array.isArray(data)) return;
        const fresh = (data as UnifiedMapLocation[]).find((l) => String(l.id) === String(location.id));
        if (fresh) setLive(fresh);
      })
      .catch(() => { /* silently use stale data */ });
    return () => { cancelled = true; };
  }, [location.id]);

  const effective = live ?? location;
  const type = effective.type || "camp";
  const armor = typeof effective.armor === "number" && Number.isFinite(effective.armor)
    ? Math.max(1, effective.armor)
    : baseArmorForType(normalizeLocationType(type));
  const image = typeof effective.image === "string" && effective.image.trim() ? effective.image : "⛺";

  return (
    <div className="space-y-2 text-sm text-[#223027]">
      <div className="font-semibold">{image} {effective.name}</div>
      <div>{effective.summary}</div>
      <div className="font-mono text-xs text-[#5a6259]">
        {type} · 🛡️{armor} · 👨‍🌾{formatPopulation(effective.currentPopulation ?? 0)}
      </div>
      <div>
        👑: {effective.ownerTeam ? `${effective.ownerTeam.emoji ?? ""} ${effective.ownerTeam.name}`.trim() : "Neutral"}
      </div>
      <div>
        👤: {effective.ownerUser ? `@${effective.ownerUser.handle}` : "-/-"}
      </div>
    </div>
  );
}

export default function TerritoryMapInner({
  locations,
  center,
  initialZoom,
  autoFitBounds = true,
  mode = "view",
  selectedId = null,
  onSelectLocation,
  onMoveSelected,
  onViewportChange,
}: TerritoryMapInnerProps) {
  const editable = mode === "edit";
  const defaultZoom = initialZoom ?? (editable ? 14 : 15);
  const [zoom, setZoom] = useState(defaultZoom);
  const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null);
  const [tileUrl, setTileUrl] = useState(PRIMARY_TILE_URL);
  const [tileLoadSucceeded, setTileLoadSucceeded] = useState(false);
  const [tileErrorCount, setTileErrorCount] = useState(0);

  useEffect(() => {
    setTileLoadSucceeded(false);
    setTileErrorCount(0);
  }, [tileUrl]);

  useEffect(() => {
    if (tileUrl !== PRIMARY_TILE_URL || tileLoadSucceeded) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTileUrl(FALLBACK_TILE_URL);
    }, 4500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [tileLoadSucceeded, tileUrl]);

  useEffect(() => {
    if (tileUrl === PRIMARY_TILE_URL && tileErrorCount >= 4) {
      setTileUrl(FALLBACK_TILE_URL);
    }
  }, [tileErrorCount, tileUrl]);
  const effectiveCenter = useMemo<[number, number]>(() => {
    if (center) {
      return center;
    }

    if (!locations.length) {
      return [49.7332, 15.768];
    }

    const latitude = locations.reduce((total, location) => total + location.latitude, 0) / locations.length;
    const longitude = locations.reduce((total, location) => total + location.longitude, 0) / locations.length;
    return [latitude, longitude];
  }, [center, locations]);
  const realmPoints = useMemo(
    () =>
      createRealmBorder(
        locations.map((location) => ({
          latitude: location.latitude,
          longitude: location.longitude,
        })),
        1.2,
      ),
    [locations],
  );
  const tileAssignments = useMemo(
    () =>
      createRealmTileAssignments(
        locations.map((location) => ({
          id: location.id,
          latitude: location.latitude,
          longitude: location.longitude,
        })),
        realmPoints,
        100,
      ),
    [locations, realmPoints],
  );
  const rawLocationPolygons = useMemo(
    () => createRealmLocationPolygons(tileAssignments, realmPoints),
    [tileAssignments, realmPoints],
  );
  const locationPolygons = useMemo(
    () => smoothRealmLocationPolygons(rawLocationPolygons, 2, 0.42),
    [rawLocationPolygons],
  );
  const polygonBorders = useMemo(
    () => createRealmBordersFromLocationPolygons(locationPolygons),
    [locationPolygons],
  );
  const computedAreaByLocationId = useMemo(
    () => calculateLocationAreasSquareMeters(locationPolygons),
    [locationPolygons],
  );
  const ownerColorByLocationId = useMemo(() => {
    const entries = locations.map((location) => [String(location.id), location.ownerTeam?.colorHex ?? null] as const);
    return Object.fromEntries(entries);
  }, [locations]);
  const realmBounds = useMemo<[[number, number], [number, number]] | null>(() => {
    const source = realmPoints.length >= 3
      ? realmPoints.map((point) => [point.latitude, point.longitude] as [number, number])
      : locations.map((location) => [location.latitude, location.longitude] as [number, number]);

    if (!source.length) {
      return null;
    }

    let minLatitude = Number.POSITIVE_INFINITY;
    let minLongitude = Number.POSITIVE_INFINITY;
    let maxLatitude = Number.NEGATIVE_INFINITY;
    let maxLongitude = Number.NEGATIVE_INFINITY;

    source.forEach(([latitude, longitude]) => {
      minLatitude = Math.min(minLatitude, latitude);
      minLongitude = Math.min(minLongitude, longitude);
      maxLatitude = Math.max(maxLatitude, latitude);
      maxLongitude = Math.max(maxLongitude, longitude);
    });

    return [[minLatitude, minLongitude], [maxLatitude, maxLongitude]];
  }, [realmPoints, locations]);

  return (
    <MapContainer
      center={effectiveCenter}
      zoom={defaultZoom}
      maxZoom={19}
      scrollWheelZoom
      className="h-full w-full"
      style={{ height: "100%", width: "100%", minHeight: "240px" }}
    >
      <TileLayer
        key={tileUrl}
        attribution={tileUrl === PRIMARY_TILE_URL ? PRIMARY_TILE_ATTRIBUTION : FALLBACK_TILE_ATTRIBUTION}
        url={tileUrl}
        subdomains={tileUrl === PRIMARY_TILE_URL ? "abc" : "abcd"}
        maxZoom={19}
        maxNativeZoom={19}
        eventHandlers={{
          load: () => setTileLoadSucceeded(true),
          tileerror: () => setTileErrorCount((count) => count + 1),
        }}
      />
      <MapSizeInvalidator />
      {!editable && autoFitBounds && <AutoFitBounds bounds={realmBounds} />}
      <ZoomTracker onZoomChange={setZoom} />
      {editable && onViewportChange && <ViewportTracker onViewportChange={onViewportChange} />}
      {editable && onMoveSelected && <ClickHandler selectedId={selectedId} onMoveSelected={onMoveSelected} />}
      <HoverTracker locationPolygons={locationPolygons} realmPoints={realmPoints} onHoverChange={setHoveredLocationId} />

      {locationPolygons.map((polygon) => {
        const ownerColor = ownerColorByLocationId[polygon.locationId];
        const isHovered = hoveredLocationId === polygon.locationId;

        return (
          <Polygon
            key={polygon.id}
            positions={polygon.points}
            interactive={false}
            smoothFactor={2}
            pathOptions={{
              stroke: false,
              fillColor: ownerColor || "#b8b8b8",
              fillOpacity: ownerColor
                ? isHovered
                  ? 0.6
                  : 0.35
                : isHovered
                  ? 0.3
                  : 0.12,
            }}
          />
        );
      })}

      {polygonBorders.map((segment) => (
        <Polyline
          key={segment.id}
          positions={segment.points}
          interactive={false}
          smoothFactor={2}
          pathOptions={{
            color: hoveredLocationId && segment.locationIds.includes(hoveredLocationId) ? "#4f3a2b" : "#6b5848",
            weight: hoveredLocationId && segment.locationIds.includes(hoveredLocationId) ? 2.4 : 1,
            opacity: hoveredLocationId && segment.locationIds.includes(hoveredLocationId) ? 0.95 : 0.55,
          }}
        />
      ))}

      {realmPoints.length >= 3 && (
        <Polygon
          positions={realmPoints.map((point) => [point.latitude, point.longitude] as [number, number])}
          interactive={false}
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
        const locationId = String(location.id);
        const isSelected = editable && locationId === selectedId;
        const color = location.ownerTeam?.colorHex ?? (editable ? "#7a7a72" : "#91911e");
        const icon = buildEmojiIconForZoom(location.image, zoom, isSelected);
        const area = computedAreaByLocationId[locationId] ?? (Number.isFinite(location.area) ? location.area : 1_000_000);
        const type = location.type || "camp";
        const armor = typeof location.armor === "number" && Number.isFinite(location.armor)
          ? Math.max(1, location.armor)
          : baseArmorForType(normalizeLocationType(type));
        const latitude = Number.isFinite(location.latitude) ? location.latitude : 49.7332;
        const longitude = Number.isFinite(location.longitude) ? location.longitude : 15.768;
        const claimRadiusM = Number.isFinite(location.claimRadiusM)
          ? Math.max(1, location.claimRadiusM)
          : 50;
        const locationWithArea = { ...location, area };

        return (
          <Fragment key={location.id}>
            <Circle
              center={[latitude, longitude]}
              radius={claimRadiusM}
              pathOptions={{
                color: isSelected ? "#d56c32" : color,
                fillColor: withOpacity(color, "44"),
                fillOpacity: isSelected ? 0.52 : 0.45,
                weight: isSelected ? 3 : 2,
              }}
              eventHandlers={{
                mouseover: () => setHoveredLocationId(locationId),
                mouseout: () => setHoveredLocationId(null),
                click: () => {
                  if (editable) {
                    onSelectLocation?.(locationId);
                  }
                },
              }}
            >
              <Popup>
                <LocationPopupContent location={locationWithArea} />
              </Popup>
            </Circle>
            <Marker
              position={[latitude, longitude]}
              icon={icon}
              eventHandlers={{
                mouseover: () => setHoveredLocationId(locationId),
                mouseout: () => setHoveredLocationId(null),
                click: () => {
                  if (editable) {
                    onSelectLocation?.(locationId);
                  }
                },
              }}
            >
              <Popup>
                <LocationPopupContent location={locationWithArea} />
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}