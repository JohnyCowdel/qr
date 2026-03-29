"use client";

import Link from "next/link";
import { useCallback, useMemo, useState, useTransition } from "react";

import {
  baseArmorForType,
  defaultImageForType,
  LOCATION_TYPES,
  normalizeLocationType,
  type LocationType,
} from "@/lib/location-types";
import {
  calculateLocationAreasSquareMeters,
  createRealmBorder,
  createRealmLocationPolygons,
  createRealmTileAssignments,
  smoothRealmLocationPolygons,
} from "@/lib/realm";

import { AdminLocationsMap } from "./admin-locations-map";
import { DeleteLocationButton } from "./delete-location-button";
import { GenerateQRPdfButton } from "./generate-qr-pdf-button";

type TeamRef = {
  id: number;
  name: string;
  colorHex: string;
} | null;

type TeamOption = {
  id: number;
  slug: string;
  name: string;
  colorHex: string;
};

export type AdminLocationDraft = {
  id: string;
  slug: string | null;
  name: string;
  type: LocationType;
  armor: number;
  area: number;
  image: string;
  summary: string;
  content: string;
  latitude: number;
  longitude: number;
  claimRadiusM: number;
  ownerTeam: TeamRef;
  isNew: boolean;
};

type AdminLocationRecord = Omit<AdminLocationDraft, "id" | "isNew" | "type" | "image"> & {
  slug: string;
  type: string;
  image: string;
};

type Props = {
  initialLocations: AdminLocationRecord[];
  initialTeams: TeamOption[];
};

function normalizeSortKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function safeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function buildLocationPayload(draft: AdminLocationDraft, computedArea: number) {
  return {
    name: draft.name.trim() || "<new location>",
    type: draft.type,
    ownerTeamId: draft.ownerTeam?.id ?? null,
    area: Math.max(1, Math.round(safeNumber(computedArea, draft.area))),
    image: draft.image.trim() || defaultImageForType(draft.type),
    summary: draft.summary.trim() || "<summary>",
    content: draft.content.trim() || "<content>",
    latitude: safeNumber(draft.latitude, 49.7332),
    longitude: safeNumber(draft.longitude, 15.768),
    claimRadiusM: Math.max(1, safeNumber(draft.claimRadiusM, 50)),
  };
}

export function AdminLocationsManager({ initialLocations, initialTeams }: Props) {
  const hydratedLocations = useMemo<AdminLocationDraft[]>(
    () =>
      initialLocations.map((location) => ({
        ...location,
        ownerTeam: location.ownerTeam
          ? {
              id: location.ownerTeam.id,
              name: location.ownerTeam.name,
              colorHex: location.ownerTeam.colorHex,
            }
          : null,
        name: location.name || "<unnamed>",
        summary: location.summary || "",
        content: location.content || "",
        latitude: safeNumber(location.latitude, 49.7332),
        longitude: safeNumber(location.longitude, 15.768),
        claimRadiusM: Math.max(1, safeNumber(location.claimRadiusM, 50)),
        area: Math.max(1, safeNumber(location.area, 1000)),
        type: normalizeLocationType(location.type),
        armor: Math.max(1, safeNumber((location as { armor?: number }).armor, baseArmorForType(normalizeLocationType(location.type)))),
        image: location.image?.trim() || defaultImageForType(normalizeLocationType(location.type)),
        id: location.slug,
        isNew: false,
      })),
    [initialLocations],
  );
  const [locations, setLocations] = useState<AdminLocationDraft[]>(hydratedLocations);
  const [selectedId, setSelectedId] = useState<string | null>(hydratedLocations[0]?.id ?? null);
  const [isSaving, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [viewportCenter, setViewportCenter] = useState({ latitude: 49.7332, longitude: 15.768 });

  const [drafts, setDrafts] = useState<Record<string, AdminLocationDraft>>(() =>
    Object.fromEntries(
      hydratedLocations.map((location) => [location.id, location]),
    ),
  );

  const effectiveLocations = useMemo(
    () => locations.map((location) => drafts[location.id] ?? location),
    [locations, drafts],
  );

  const computedAreaByLocationId = useMemo(() => {
    const realmBorder = createRealmBorder(
      effectiveLocations.map((location) => ({
        latitude: location.latitude,
        longitude: location.longitude,
      })),
      1.1,
    );

    const tileAssignments = createRealmTileAssignments(
      effectiveLocations.map((location) => ({
        id: location.id,
        latitude: location.latitude,
        longitude: location.longitude,
      })),
      realmBorder,
      100,
    );

    const rawPolygons = createRealmLocationPolygons(tileAssignments, realmBorder);
    const smoothedPolygons = smoothRealmLocationPolygons(rawPolygons, 2, 0.42);

    return calculateLocationAreasSquareMeters(smoothedPolygons);
  }, [effectiveLocations]);

  const orderedLocations = useMemo(
    () =>
      locations.slice().sort((left, right) => {
        const leftKey = normalizeSortKey(left.name);
        const rightKey = normalizeSortKey(right.name);
        if (leftKey < rightKey) return -1;
        if (leftKey > rightKey) return 1;
        return left.id.localeCompare(right.id);
      }),
    [locations],
  );

  const handleViewportChange = useCallback((latitude: number, longitude: number) => {
    setViewportCenter({ latitude, longitude });
  }, []);

  function updateDraft(id: string, patch: Partial<AdminLocationDraft>) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  }

  function handleSelectLocation(id: string) {
    setSelectedId((current) => (current === id ? null : id));
    setError(null);
  }

  function handleCreateDraft() {
    const id = `new:${Date.now()}`;
    const draft: AdminLocationDraft = {
      id,
      slug: null,
      name: "<new location>",
      type: "camp",
      armor: baseArmorForType("camp"),
      area: 1000,
      image: "⛺",
      summary: "<summary>",
      content: "<content>",
      latitude: Number(viewportCenter.latitude.toFixed(6)),
      longitude: Number(viewportCenter.longitude.toFixed(6)),
      claimRadiusM: 50,
      ownerTeam: null,
      isNew: true,
    };

    setLocations((current) => [draft, ...current]);
    setDrafts((current) => ({ ...current, [id]: draft }));
    setSelectedId(id);
    setError(null);
  }

  function handleMoveSelected(latitude: number, longitude: number) {
    if (!selectedId) {
      return;
    }

    updateDraft(selectedId, {
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
    });
  }

  function handleDelete(id: string) {
    setLocations((current) => current.filter((location) => location.id !== id));
    setDrafts((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setSelectedId((current) => {
      if (current !== id) {
        return current;
      }

      const remaining = locations.filter((location) => location.id !== id);
      return remaining[0]?.id ?? null;
    });
  }

  function handleSave(id: string) {
    const draft = drafts[id];
    if (!draft) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const payload = buildLocationPayload(draft, computedAreaByLocationId[draft.id] ?? draft.area);
      const response = await fetch(draft.isNew ? "/api/admin/locations" : `/api/admin/locations/${draft.slug}`, {
        method: draft.isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
        if (response.status === 401) {
          setError("Admin session expired. Reload the page and log in again.");
          return;
        }
        setError(errorPayload?.error ?? `Unable to save this location (${response.status}).`);
        return;
      }

      const savedLocation = (await response.json()) as {
        slug: string;
        name: string;
        type: LocationType;
        armor: number;
        area: number;
        image: string;
        summary: string;
        content: string;
        latitude: number;
        longitude: number;
        claimRadiusM: number;
      };

      const nextLocation: AdminLocationDraft = {
        id: savedLocation.slug,
        slug: savedLocation.slug,
        name: savedLocation.name,
        type: savedLocation.type,
        armor: savedLocation.armor,
        area: savedLocation.area,
        image: savedLocation.image,
        summary: savedLocation.summary,
        content: savedLocation.content,
        latitude: savedLocation.latitude,
        longitude: savedLocation.longitude,
        claimRadiusM: savedLocation.claimRadiusM,
        ownerTeam: draft.ownerTeam,
        isNew: false,
      };

      setDrafts((current) => {
        const next = { ...current };
        delete next[id];
        next[nextLocation.id] = nextLocation;
        return next;
      });
      setLocations((current) =>
        current.map((location) => (location.id === id ? nextLocation : location)),
      );
      setSelectedId(nextLocation.id);
    });
  }

  return (
    <div className="space-y-6">
      <section className="glass-panel rounded-2xl p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--muted)]">
              Terrain Editor
            </p>
            <h2 className="text-xl font-bold">Map-first maintenance</h2>
          </div>
          <div className="flex flex-col items-end gap-2">
            <GenerateQRPdfButton
              locations={locations
                .filter((l) => l.slug !== null)
                .map((l) => ({ slug: l.slug!, name: l.name }))}
            />
            <p className="max-w-sm text-right text-xs text-[var(--muted)]">
              Select a location from the list or map. While a row is open, click anywhere on the map to move it.
            </p>
          </div>
        </div>
        <div className="h-[24rem] overflow-hidden rounded-xl border border-[var(--line)]">
          <AdminLocationsMap
            locations={orderedLocations.map((location) => {
              const draft = drafts[location.id] ?? location;
              const computedArea = computedAreaByLocationId[draft.id];

              return {
                ...draft,
                area: Math.max(1, Math.round(safeNumber(computedArea, draft.area))),
              };
            })}
            selectedId={selectedId}
            onSelectLocation={handleSelectLocation}
            onMoveSelected={handleMoveSelected}
            onViewportChange={handleViewportChange}
          />
        </div>
      </section>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="glass-panel rounded-2xl divide-y divide-[var(--line)] overflow-hidden">
        <div className="px-6 py-4">
          <button
            type="button"
            onClick={handleCreateDraft}
            className="flex w-full items-center gap-4 rounded-xl border border-dashed border-[var(--line)] bg-white/30 px-4 py-4 text-left transition-colors hover:bg-white/50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-lg font-semibold text-white">
              +
            </div>
            <div>
              <p className="font-semibold">Add new location</p>
              <p className="text-xs font-mono text-[var(--muted)]">
                Creates an inline draft at the current map focus using placeholder text in angle brackets.
              </p>
            </div>
          </button>
        </div>
        {orderedLocations.length === 0 && (
          <p className="px-6 py-10 text-center text-sm text-[var(--muted)]">
            No locations yet. Create one to get started.
          </p>
        )}
        {orderedLocations.map((location) => {
          const draft = drafts[location.id] ?? location;
          const computedArea = Math.max(1, Math.round(safeNumber(computedAreaByLocationId[draft.id], draft.area)));
          const isOpen = selectedId === location.id;

          return (
            <div key={location.id} className="px-6 py-4">
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => handleSelectLocation(location.id)}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                >
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: location.ownerTeam?.colorHex ?? "#7a7a72" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{draft.name}</p>
                    <p className="truncate text-xs font-mono text-[var(--muted)]">
                      {draft.slug ?? "<unsaved>"} · {draft.latitude.toFixed(4)}, {draft.longitude.toFixed(4)} · r=
                      {draft.claimRadiusM}m · area={computedArea}m² · armor={draft.armor} · {draft.type} {draft.image} · {location.ownerTeam ? location.ownerTeam.name : draft.isNew ? "new draft" : "unclaimed"}
                    </p>
                  </div>
                </button>
                <div className="flex shrink-0 gap-2">
                  {!draft.isNew && draft.slug && (
                    <Link
                      href={`/l/${draft.slug}`}
                      target="_blank"
                      className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--background-strong)]"
                    >
                      View
                    </Link>
                  )}
                  {draft.isNew && (
                    <button
                      type="button"
                      onClick={() => handleDelete(location.id)}
                      className="rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--background-strong)]"
                    >
                      Discard
                    </button>
                  )}
                  {!draft.isNew && draft.slug && (
                    <DeleteLocationButton slug={draft.slug} onDeleted={() => handleDelete(location.id)} />
                  )}
                </div>
              </div>

              {isOpen && (
                <div className="mt-4 grid gap-4 border-t border-[var(--line)] pt-4 md:grid-cols-[1.15fr_0.85fr]">
                  <div className="space-y-4">
                    <EditorField
                      label="Name"
                      value={draft.name}
                      onChange={(value) => updateDraft(location.id, { name: value })}
                    />
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                        Type
                      </span>
                      <select
                        value={draft.type}
                        onChange={(event) => {
                          const nextType = event.target.value as LocationType;
                          const currentDefault = defaultImageForType(draft.type);
                          const shouldSwapImage = draft.image === currentDefault;
                          updateDraft(location.id, {
                            type: nextType,
                            armor: baseArmorForType(nextType),
                            image: shouldSwapImage ? defaultImageForType(nextType) : draft.image,
                          });
                        }}
                        className="w-full rounded-lg border border-[var(--line)] bg-white/70 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                      >
                        {LOCATION_TYPES.map((typeOption) => (
                          <option key={typeOption} value={typeOption}>
                            {typeOption}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                        Owner
                      </span>
                      <select
                        value={draft.ownerTeam?.id ?? ""}
                        onChange={(event) => {
                          const selectedValue = event.target.value;
                          if (!selectedValue) {
                            updateDraft(location.id, { ownerTeam: null });
                            return;
                          }

                          const selectedTeam = initialTeams.find((team) => String(team.id) === selectedValue);
                          updateDraft(location.id, {
                            ownerTeam: selectedTeam
                              ? {
                                  id: selectedTeam.id,
                                  name: selectedTeam.name,
                                  colorHex: selectedTeam.colorHex,
                                }
                              : null,
                          });
                        }}
                        className="w-full rounded-lg border border-[var(--line)] bg-white/70 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                      >
                        <option value="">Neutral</option>
                        {initialTeams.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <EditorField
                      label="Image (emoji)"
                      value={draft.image}
                      onChange={(value) => updateDraft(location.id, { image: value.slice(0, 8) || defaultImageForType(draft.type) })}
                    />
                    <EditorField
                      label="Summary"
                      value={draft.summary}
                      multiline
                      onChange={(value) => updateDraft(location.id, { summary: value })}
                    />
                    <EditorField
                      label="Content"
                      value={draft.content}
                      multiline
                      rows={5}
                      onChange={(value) => updateDraft(location.id, { content: value })}
                    />
                  </div>

                  <div className="space-y-4 rounded-xl border border-[var(--line)] bg-white/35 p-4">
                    <p className="text-xs font-mono uppercase tracking-widest text-[var(--muted)]">
                      Position
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                      <EditorField
                        label="Latitude"
                        value={String(draft.latitude)}
                        onChange={(value) => updateDraft(location.id, { latitude: Number(value) || 0 })}
                      />
                      <EditorField
                        label="Longitude"
                        value={String(draft.longitude)}
                        onChange={(value) => updateDraft(location.id, { longitude: Number(value) || 0 })}
                      />
                    </div>
                    <EditorField
                      label="Radius (m)"
                      type="number"
                      value={String(draft.claimRadiusM)}
                      onChange={(value) => updateDraft(location.id, { claimRadiusM: Math.max(1, Number(value) || 1) })}
                    />
                    <ReadonlyField
                      label="Armor"
                      value={String(draft.armor)}
                    />
                    <ReadonlyField
                      label="Area"
                      value={`${computedArea} m²`}
                    />
                    <p className="text-xs text-[var(--muted)]">
                      Area is computed automatically from territory polygons. Click the map above to move this location. New rows start at the current map focus and keep placeholder text until you replace it.
                    </p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleSave(location.id)}
                        disabled={isSaving}
                        className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-strong)] disabled:opacity-50"
                      >
                        {isSaving ? "Saving…" : draft.isNew ? "Create location" : "Save changes"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (draft.isNew) {
                            handleDelete(location.id);
                            return;
                          }
                          updateDraft(location.id, location);
                        }}
                        className="rounded-lg border border-[var(--line)] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--background-strong)]"
                      >
                        {draft.isNew ? "Discard draft" : "Reset row"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function EditorField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  type?: string;
}) {
  const className =
    "w-full rounded-lg border border-[var(--line)] bg-white/70 px-3 py-2 text-sm font-mono focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          rows={rows}
          onChange={(event) => onChange(event.target.value)}
          className={`${className} resize-y`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      )}
    </label>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      <div className="w-full rounded-lg border border-[var(--line)] bg-white/40 px-3 py-2 text-sm font-mono text-[var(--ink)]">
        {value}
      </div>
    </div>
  );
}