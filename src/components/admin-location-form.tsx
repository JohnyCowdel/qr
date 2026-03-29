"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { LocationPickerMap } from "./location-picker-map";

type FormData = {
  name: string;
  summary: string;
  content: string;
  latitude: string;
  longitude: string;
  claimRadiusM: string;
};

type CreateProps = { mode: "create" };

type EditProps = {
  mode: "edit";
  slug: string;
  initialData: {
    name: string;
    summary: string;
    content: string;
    latitude: number;
    longitude: number;
    claimRadiusM: number;
  };
};

type Props = CreateProps | EditProps;

const DEFAULT_LAT = 49.7322;
const DEFAULT_LNG = 15.7614;

export function AdminLocationForm(props: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initial = props.mode === "edit" ? props.initialData : null;

  const [form, setForm] = useState<FormData>({
    name: initial?.name ?? "",
    summary: initial?.summary ?? "",
    content: initial?.content ?? "",
    latitude: String(initial?.latitude ?? DEFAULT_LAT),
    longitude: String(initial?.longitude ?? DEFAULT_LNG),
    claimRadiusM: String(initial?.claimRadiusM ?? 50),
  });

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleMapPick(lat: number, lng: number) {
    setForm((prev) => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    const radius = parseInt(form.claimRadiusM, 10);

    if (isNaN(lat) || isNaN(lng) || isNaN(radius)) {
      setError("Latitude, longitude, and radius must be valid numbers.");
      return;
    }

    const payload =
      props.mode === "create"
        ? {
            name: form.name,
            summary: form.summary,
            content: form.content,
            latitude: lat,
            longitude: lng,
            claimRadiusM: radius,
          }
        : {
            name: form.name,
            summary: form.summary,
            content: form.content,
            latitude: lat,
            longitude: lng,
            claimRadiusM: radius,
          };

    const url =
      props.mode === "create"
        ? "/api/admin/locations"
        : `/api/admin/locations/${props.slug}`;
    const method = props.mode === "create" ? "POST" : "PUT";

    startTransition(async () => {
      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json();
          setError((data.error as string | undefined) ?? "Something went wrong.");
          return;
        }
        router.push("/admin");
        router.refresh();
      } catch {
        setError("Network error. Try again.");
      }
    });
  }

  const lat = parseFloat(form.latitude) || DEFAULT_LAT;
  const lng = parseFloat(form.longitude) || DEFAULT_LNG;
  const radius = parseInt(form.claimRadiusM, 10) || 50;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Map Picker */}
      <div>
        <label className="block text-sm font-semibold mb-2 text-[var(--foreground)]">
          Location — click map to place point
        </label>
        <div className="h-72 rounded-xl overflow-hidden border border-[var(--line)]">
          <LocationPickerMap lat={lat} lng={lng} radiusM={radius} onPick={handleMapPick} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <Field
            label="Latitude"
            value={form.latitude}
            onChange={(v) => set("latitude", v)}
            required
          />
          <Field
            label="Longitude"
            value={form.longitude}
            onChange={(v) => set("longitude", v)}
            required
          />
        </div>
      </div>

      <Field label="Name" value={form.name} onChange={(v) => set("name", v)} required />
      <Field
        label="Summary"
        value={form.summary}
        onChange={(v) => set("summary", v)}
        multiline
        required
      />
      <Field
        label="Content"
        value={form.content}
        onChange={(v) => set("content", v)}
        multiline
        required
      />

      <Field
        label="Claim Radius (m)"
        type="number"
        value={form.claimRadiusM}
        onChange={(v) => set("claimRadiusM", v)}
        required
      />

      {props.mode === "create" && (
        <p className="text-xs text-[var(--muted)]">
          Slug and QR code ID will be generated automatically from the name.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-semibold hover:bg-[var(--accent-strong)] transition-colors disabled:opacity-50"
        >
          {isPending ? "Saving…" : props.mode === "create" ? "Create Location" : "Save Changes"}
        </button>
        <a
          href="/admin"
          className="px-5 py-2.5 border border-[var(--line)] rounded-lg text-sm font-semibold hover:bg-[var(--background-strong)] transition-colors"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const cls =
    "w-full px-3 py-2 rounded-lg border border-[var(--line)] bg-white/60 text-sm font-mono focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)] mb-1">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${cls} min-h-[80px] resize-y`}
          placeholder={placeholder}
          required={required}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
          placeholder={placeholder}
          required={required}
        />
      )}
    </label>
  );
}
