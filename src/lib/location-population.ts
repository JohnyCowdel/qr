export function calculateMinPopulation(areaM2: number) {
  const safeArea = Number.isFinite(areaM2) ? Math.max(1, areaM2) : 1;
  return Math.max(1, Math.round((safeArea / 1_000_000) * 10));
}

export function calculateMaxPopulation(areaM2: number) {
  const safeArea = Number.isFinite(areaM2) ? Math.max(1, areaM2) : 1;
  const computed = Math.round((safeArea / 1_000_000) * 20);
  // Guarantee at least 20 so the logistic growth factor never collapses to 0.
  return Math.max(20, calculateMinPopulation(safeArea), computed);
}

export function clampCurrentPopulation(areaM2: number, currentPopulation?: number | null) {
  const minPopulation = calculateMinPopulation(areaM2);
  const maxPopulation = calculateMaxPopulation(areaM2);

  if (typeof currentPopulation !== "number" || !Number.isFinite(currentPopulation)) {
    return minPopulation;
  }

  return Math.min(maxPopulation, Math.max(minPopulation, roundDownPopulation(currentPopulation)));
}

export function deriveLocationPopulation(areaM2: number, currentPopulation?: number | null) {
  const minPopulation = calculateMinPopulation(areaM2);
  const maxPopulation = calculateMaxPopulation(areaM2);
  const resolvedCurrentPopulation = clampCurrentPopulation(areaM2, currentPopulation);

  return {
    minPopulation,
    maxPopulation,
    currentPopulation: resolvedCurrentPopulation,
  };
}

export function roundDownPopulation(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  // Consistent lower-integer strategy for all worker and population displays.
  return Math.floor(value + 1e-9);
}

export function calculateWorkerCap(currentPopulation: number) {
  return Math.max(0, roundDownPopulation(currentPopulation));
}