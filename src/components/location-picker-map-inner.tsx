"use client";

import { useEffect, useState } from "react";
import { Circle, MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

const PRIMARY_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const FALLBACK_TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
const PRIMARY_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const FALLBACK_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

interface Props {
  lat: number;
  lng: number;
  radiusM: number;
  onPick: (lat: number, lng: number) => void;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPickerMapInner({ lat, lng, radiusM, onPick }: Props) {
  const center: LatLngExpression = [lat, lng];
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

  return (
    <MapContainer
      center={center}
      zoom={14}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        key={tileUrl}
        url={tileUrl}
        attribution={tileUrl === PRIMARY_TILE_URL ? PRIMARY_TILE_ATTRIBUTION : FALLBACK_TILE_ATTRIBUTION}
        subdomains={tileUrl === PRIMARY_TILE_URL ? "abc" : "abcd"}
        maxZoom={19}
        eventHandlers={{
          load: () => setTileLoadSucceeded(true),
          tileerror: () => setTileErrorCount((count) => count + 1),
        }}
      />
      <ClickHandler onPick={onPick} />
      <Circle
        center={center}
        radius={radiusM}
        pathOptions={{
          color: "#d56c32",
          fillColor: "#d56c32",
          fillOpacity: 0.18,
          weight: 2,
        }}
      />
    </MapContainer>
  );
}
