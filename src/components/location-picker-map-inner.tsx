"use client";

import { Circle, MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import type { LatLngExpression } from "leaflet";

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

  return (
    <MapContainer
      center={center}
      zoom={14}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
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
