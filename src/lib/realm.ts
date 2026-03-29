export type RealmPoint = {
  latitude: number;
  longitude: number;
};

function cross(o: RealmPoint, a: RealmPoint, b: RealmPoint) {
  const ax = a.longitude - o.longitude;
  const ay = a.latitude - o.latitude;
  const bx = b.longitude - o.longitude;
  const by = b.latitude - o.latitude;
  return ax * by - ay * bx;
}

function dedupePoints(points: RealmPoint[]) {
  const seen = new Set<string>();
  const unique: RealmPoint[] = [];

  for (const point of points) {
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
      continue;
    }
    const key = `${point.latitude.toFixed(6)}:${point.longitude.toFixed(6)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(point);
  }

  return unique;
}

function convexHull(points: RealmPoint[]) {
  if (points.length <= 1) {
    return points;
  }

  const sorted = points
    .slice()
    .sort((left, right) =>
      left.longitude === right.longitude
        ? left.latitude - right.latitude
        : left.longitude - right.longitude,
    );

  const lower: RealmPoint[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: RealmPoint[] = [];
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();

  return [...lower, ...upper];
}

function scaleFromCentroid(points: RealmPoint[], factor: number) {
  const centroid = points.reduce(
    (acc, point) => ({
      latitude: acc.latitude + point.latitude,
      longitude: acc.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 },
  );

  const centerLatitude = centroid.latitude / points.length;
  const centerLongitude = centroid.longitude / points.length;

  return points.map((point) => ({
    latitude: centerLatitude + (point.latitude - centerLatitude) * factor,
    longitude: centerLongitude + (point.longitude - centerLongitude) * factor,
  }));
}

export function createRealmBorder(points: RealmPoint[], scaleFactor = 1.1) {
  const unique = dedupePoints(points);
  if (unique.length < 3) {
    return [];
  }

  const hull = convexHull(unique);
  if (hull.length < 3) {
    return [];
  }

  return scaleFromCentroid(hull, scaleFactor);
}
