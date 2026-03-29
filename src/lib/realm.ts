export type RealmPoint = {
  latitude: number;
  longitude: number;
};

export type RealmTileAssignment = {
  id: string;
  center: RealmPoint;
  bounds: [[number, number], [number, number]];
  locationId: string;
};

export type RealmTileBorderSegment = {
  id: string;
  points: [[number, number], [number, number]];
  locationIds: [string, string];
};

export type RealmTileBorderPath = {
  id: string;
  points: Array<[number, number]>;
  locationIds: string[];
};

export type RealmLocationPolygon = {
  id: string;
  locationId: string;
  points: Array<[number, number]>;
};

type RealmPolygonBorderSegment = {
  id: string;
  points: [[number, number], [number, number]];
  locationIds: string[];
};

function borderPairKey(locationIds: [string, string]) {
  return locationIds.slice().sort().join("|");
}

type SegmentPoint = {
  latitude: number;
  longitude: number;
  t: number;
};

type RealmLocationPoint = RealmPoint & {
  id: string | number;
};

function cross(o: RealmPoint, a: RealmPoint, b: RealmPoint) {
  const ax = a.longitude - o.longitude;
  const ay = a.latitude - o.latitude;
  const bx = b.longitude - o.longitude;
  const by = b.latitude - o.latitude;
  return ax * by - ay * bx;
}

function crossVector(ax: number, ay: number, bx: number, by: number) {
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

function metersToLatitudeDegrees(meters: number) {
  return meters / 111320;
}

function metersToLongitudeDegrees(meters: number, latitude: number) {
  const latitudeRadians = (latitude * Math.PI) / 180;
  const scale = Math.max(0.000001, Math.cos(latitudeRadians));
  return meters / (111320 * scale);
}

function getBounds(points: RealmPoint[]) {
  return points.reduce(
    (bounds, point) => ({
      minLatitude: Math.min(bounds.minLatitude, point.latitude),
      maxLatitude: Math.max(bounds.maxLatitude, point.latitude),
      minLongitude: Math.min(bounds.minLongitude, point.longitude),
      maxLongitude: Math.max(bounds.maxLongitude, point.longitude),
    }),
    {
      minLatitude: Number.POSITIVE_INFINITY,
      maxLatitude: Number.NEGATIVE_INFINITY,
      minLongitude: Number.POSITIVE_INFINITY,
      maxLongitude: Number.NEGATIVE_INFINITY,
    },
  );
}

function findClosestLocation(center: RealmPoint, locations: RealmLocationPoint[]) {
  let closestLocationId = String(locations[0].id);
  let closestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const location of locations) {
    const latitudeDelta = location.latitude - center.latitude;
    const longitudeDelta = location.longitude - center.longitude;
    const distanceSquared = latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta;

    if (distanceSquared < closestDistanceSquared) {
      closestDistanceSquared = distanceSquared;
      closestLocationId = String(location.id);
    }
  }

  return closestLocationId;
}

export function createRealmTileAssignments(
  locations: RealmLocationPoint[],
  border: RealmPoint[],
  tileSizeM = 500,
) {
  const validLocations = locations.filter(
    (location) => Number.isFinite(location.latitude) && Number.isFinite(location.longitude),
  );

  if (!validLocations.length || tileSizeM <= 0) {
    return [] as RealmTileAssignment[];
  }

  const source = border.length >= 3 ? border : validLocations;
  const bounds = getBounds(source);
  const averageLatitude = (bounds.minLatitude + bounds.maxLatitude) / 2;
  const latitudeStep = metersToLatitudeDegrees(tileSizeM);
  const longitudeStep = metersToLongitudeDegrees(tileSizeM, averageLatitude);

  if (!Number.isFinite(latitudeStep) || !Number.isFinite(longitudeStep) || latitudeStep <= 0 || longitudeStep <= 0) {
    return [] as RealmTileAssignment[];
  }

  const tiles: RealmTileAssignment[] = [];
  let rowIndex = 0;

  for (let latitude = bounds.minLatitude; latitude < bounds.maxLatitude; latitude += latitudeStep) {
    let columnIndex = 0;

    for (let longitude = bounds.minLongitude; longitude < bounds.maxLongitude; longitude += longitudeStep) {
      const maxLatitude = Math.min(latitude + latitudeStep, bounds.maxLatitude);
      const maxLongitude = Math.min(longitude + longitudeStep, bounds.maxLongitude);
      const center = {
        latitude: latitude + (maxLatitude - latitude) / 2,
        longitude: longitude + (maxLongitude - longitude) / 2,
      };

      tiles.push({
        id: `${rowIndex}:${columnIndex}`,
        center,
        bounds: [
          [latitude, longitude],
          [maxLatitude, maxLongitude],
        ],
        locationId: findClosestLocation(center, validLocations),
      });

      columnIndex += 1;
    }

    rowIndex += 1;
  }

  return tiles;
}

export function getRealmTileColor(key: string | number) {
  const text = String(key);
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }

  const hue = hash % 360;

  return {
    fill: `hsl(${hue} 58% 72%)`,
    stroke: `hsl(${hue} 55% 48%)`,
  };
}

function isPointInsidePolygon(point: RealmPoint, polygon: RealmPoint[]) {
  let inside = false;

  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current, current += 1) {
    const currentPoint = polygon[current];
    const previousPoint = polygon[previous];

    const intersects =
      currentPoint.latitude > point.latitude !== previousPoint.latitude > point.latitude &&
      point.longitude <
        ((previousPoint.longitude - currentPoint.longitude) * (point.latitude - currentPoint.latitude)) /
          (previousPoint.latitude - currentPoint.latitude) +
          currentPoint.longitude;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function intersectSegments(
  start: RealmPoint,
  end: RealmPoint,
  clipStart: RealmPoint,
  clipEnd: RealmPoint,
) {
  const rX = end.longitude - start.longitude;
  const rY = end.latitude - start.latitude;
  const sX = clipEnd.longitude - clipStart.longitude;
  const sY = clipEnd.latitude - clipStart.latitude;
  const denominator = crossVector(rX, rY, sX, sY);
  const qpx = clipStart.longitude - start.longitude;
  const qpy = clipStart.latitude - start.latitude;

  if (Math.abs(denominator) < 1e-12) {
    return null;
  }

  const t = crossVector(qpx, qpy, sX, sY) / denominator;
  const u = crossVector(qpx, qpy, rX, rY) / denominator;

  if (t < 0 || t > 1 || u < 0 || u > 1) {
    return null;
  }

  return {
    latitude: start.latitude + rY * t,
    longitude: start.longitude + rX * t,
    t,
  } satisfies SegmentPoint;
}

function dedupeSegmentPoints(points: SegmentPoint[]) {
  const seen = new Set<string>();
  const unique: SegmentPoint[] = [];

  for (const point of points) {
    const key = `${point.latitude.toFixed(9)}:${point.longitude.toFixed(9)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(point);
  }

  return unique;
}

function pointKey(point: [number, number]) {
  return `${point[0].toFixed(9)}:${point[1].toFixed(9)}`;
}

function pointsEqual(left: [number, number], right: [number, number]) {
  return pointKey(left) === pointKey(right);
}

function pointToSegmentDistance(point: [number, number], start: [number, number], end: [number, number]) {
  const vx = end[1] - start[1];
  const vy = end[0] - start[0];
  const wx = point[1] - start[1];
  const wy = point[0] - start[0];
  const segmentLengthSquared = vx * vx + vy * vy;

  if (segmentLengthSquared <= 1e-18) {
    const dx = point[1] - start[1];
    const dy = point[0] - start[0];
    return Math.hypot(dx, dy);
  }

  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / segmentLengthSquared));
  const projectionX = start[1] + t * vx;
  const projectionY = start[0] + t * vy;

  return Math.hypot(point[1] - projectionX, point[0] - projectionY);
}

function segmentLength(start: [number, number], end: [number, number]) {
  return Math.hypot(end[1] - start[1], end[0] - start[0]);
}

function collapseStaircaseCorners(points: Array<[number, number]>, closed: boolean, stepHint: number) {
  if (points.length < 3) {
    return points;
  }

  const tiny = 1e-12;
  const maxCornerLength = Math.max(stepHint * 1.6, tiny);

  if (!closed) {
    const result = points.slice();
    let changed = true;

    while (changed && result.length >= 3) {
      changed = false;

      for (let index = 1; index < result.length - 1; index += 1) {
        const a = result[index - 1];
        const b = result[index];
        const c = result[index + 1];
        const dx1 = b[1] - a[1];
        const dy1 = b[0] - a[0];
        const dx2 = c[1] - b[1];
        const dy2 = c[0] - b[0];
        const len1 = Math.hypot(dx1, dy1);
        const len2 = Math.hypot(dx2, dy2);

        if (len1 <= tiny || len2 <= tiny) {
          result.splice(index, 1);
          changed = true;
          break;
        }

        const axisAligned1 = Math.abs(dx1) <= tiny || Math.abs(dy1) <= tiny;
        const axisAligned2 = Math.abs(dx2) <= tiny || Math.abs(dy2) <= tiny;
        const rightAngle = Math.abs(dx1 * dx2 + dy1 * dy2) <= len1 * len2 * 1e-6;

        if (axisAligned1 && axisAligned2 && rightAngle && len1 <= maxCornerLength && len2 <= maxCornerLength) {
          result.splice(index, 1);
          changed = true;
          break;
        }
      }
    }

    return result;
  }

  if (points.length < 4) {
    return points;
  }

  const ring = points.slice();
  let changed = true;

  while (changed && ring.length >= 4) {
    changed = false;

    for (let index = 0; index < ring.length; index += 1) {
      const prev = ring[(index - 1 + ring.length) % ring.length];
      const curr = ring[index];
      const next = ring[(index + 1) % ring.length];
      const dx1 = curr[1] - prev[1];
      const dy1 = curr[0] - prev[0];
      const dx2 = next[1] - curr[1];
      const dy2 = next[0] - curr[0];
      const len1 = Math.hypot(dx1, dy1);
      const len2 = Math.hypot(dx2, dy2);

      if (len1 <= tiny || len2 <= tiny) {
        ring.splice(index, 1);
        changed = true;
        break;
      }

      const axisAligned1 = Math.abs(dx1) <= tiny || Math.abs(dy1) <= tiny;
      const axisAligned2 = Math.abs(dx2) <= tiny || Math.abs(dy2) <= tiny;
      const rightAngle = Math.abs(dx1 * dx2 + dy1 * dy2) <= len1 * len2 * 1e-6;

      if (axisAligned1 && axisAligned2 && rightAngle && len1 <= maxCornerLength && len2 <= maxCornerLength) {
        ring.splice(index, 1);
        changed = true;
        break;
      }
    }
  }

  return ring;
}

function simplifyOpenPath(points: Array<[number, number]>, epsilon: number): Array<[number, number]> {
  if (points.length < 3) {
    return points;
  }

  let splitIndex = -1;
  let maxDistance = 0;

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = pointToSegmentDistance(points[index], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = index;
    }
  }

  if (maxDistance <= epsilon || splitIndex === -1) {
    return [points[0], points[points.length - 1]];
  }

  const left = simplifyOpenPath(points.slice(0, splitIndex + 1), epsilon);
  const right = simplifyOpenPath(points.slice(splitIndex), epsilon);

  return [...left.slice(0, -1), ...right];
}

function estimateSimplificationEpsilon(points: Array<[number, number]>): number {
  const steps: number[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const step = segmentLength(points[index - 1], points[index]);

    if (step > 1e-12) {
      steps.push(step);
    }
  }

  if (!steps.length) {
    return 0;
  }

  const sorted = steps.slice().sort((left, right) => left - right);
  const referenceStep = sorted[Math.floor((sorted.length - 1) * 0.35)];

  if (!Number.isFinite(referenceStep) || referenceStep <= 0) {
    return 0;
  }

  return referenceStep * 0.9;
}

function simplifyStaircasePath(points: Array<[number, number]>, closed: boolean): Array<[number, number]> {
  if (points.length < 3) {
    return points;
  }

  const cornerStepHint = Math.max(estimateSimplificationEpsilon(points), 1e-12) / 0.9;
  const cornerCollapsed = collapseStaircaseCorners(points, closed, cornerStepHint);

  const epsilon = estimateSimplificationEpsilon(cornerCollapsed);
  if (epsilon <= 0) {
    return cornerCollapsed;
  }

  if (!closed) {
    return simplifyOpenPath(cornerCollapsed, epsilon);
  }

  const ring = [...cornerCollapsed, cornerCollapsed[0]];
  const simplifiedRing = simplifyOpenPath(ring, epsilon);

  if (simplifiedRing.length < 4) {
    return cornerCollapsed;
  }

  const withoutClosure = pointsEqual(simplifiedRing[0], simplifiedRing[simplifiedRing.length - 1])
    ? simplifiedRing.slice(0, -1)
    : simplifiedRing;

  return withoutClosure.length >= 3 ? withoutClosure : cornerCollapsed;
}

function buildBorderPaths(segments: RealmTileBorderSegment[]) {
  const segmentsByPoint = new Map<string, number[]>();
  const consumed = new Set<number>();

  segments.forEach((segment, index) => {
    const startKey = pointKey(segment.points[0]);
    const endKey = pointKey(segment.points[1]);
    segmentsByPoint.set(startKey, [...(segmentsByPoint.get(startKey) ?? []), index]);
    segmentsByPoint.set(endKey, [...(segmentsByPoint.get(endKey) ?? []), index]);
  });

  function nextSegment(point: [number, number], pairKey: string, excludeIndex?: number) {
    const connected = segmentsByPoint.get(pointKey(point)) ?? [];
    return connected.find(
      (index) =>
        !consumed.has(index) &&
        index !== excludeIndex &&
        borderPairKey(segments[index].locationIds) === pairKey,
    );
  }

  function growPath(startIndex: number) {
    const seed = segments[startIndex];
    const path: Array<[number, number]> = [seed.points[0], seed.points[1]];
    const pairKey = borderPairKey(seed.locationIds);
    consumed.add(startIndex);

    let extended = true;
    while (extended) {
      extended = false;

      const tail = path[path.length - 1];
      const tailIndex = nextSegment(tail, pairKey);
      if (tailIndex !== undefined) {
        const segment = segments[tailIndex];
        const nextPoint = pointsEqual(segment.points[0], tail) ? segment.points[1] : segment.points[0];
        path.push(nextPoint);
        consumed.add(tailIndex);
        extended = true;
      }

      const head = path[0];
      const headIndex = nextSegment(head, pairKey);
      if (headIndex !== undefined) {
        const segment = segments[headIndex];
        const nextPoint = pointsEqual(segment.points[0], head) ? segment.points[1] : segment.points[0];
        path.unshift(nextPoint);
        consumed.add(headIndex);
        extended = true;
      }
    }

    const closed = path.length > 2 && pointsEqual(path[0], path[path.length - 1]);
    const normalized = closed ? path.slice(0, -1) : path;
    const simplified = simplifyStaircasePath(normalized, closed);

    return {
      points: simplified,
      closed,
      locationIds: seed.locationIds.slice().sort(),
    };
  }

  const paths: RealmTileBorderPath[] = [];

  segments.forEach((segment, index) => {
    if (consumed.has(index)) {
      return;
    }

    const path = growPath(index);
    if (path.points.length < 2) {
      return;
    }

    paths.push({
      id: segment.id,
      points: path.closed ? [...path.points, path.points[0]] : path.points,
      locationIds: path.locationIds,
    });
  });

  return paths;
}

function normalizedEdgeKey(start: [number, number], end: [number, number]) {
  const startKey = `${start[0].toFixed(6)}:${start[1].toFixed(6)}`;
  const endKey = `${end[0].toFixed(6)}:${end[1].toFixed(6)}`;
  return startKey <= endKey ? `${startKey}|${endKey}` : `${endKey}|${startKey}`;
}

function snapPoint(point: [number, number], decimals = 6): [number, number] {
  return [
    Number(point[0].toFixed(decimals)),
    Number(point[1].toFixed(decimals)),
  ];
}

export function createRealmBordersFromLocationPolygons(polygons: RealmLocationPolygon[]) {
  const edgeMap = new Map<
    string,
    {
      points: [[number, number], [number, number]];
      locationIds: Set<string>;
    }
  >();

  for (const polygon of polygons) {
    if (polygon.points.length < 2) {
      continue;
    }

    for (let index = 0; index < polygon.points.length; index += 1) {
      const start = snapPoint(polygon.points[index]);
      const end = snapPoint(polygon.points[(index + 1) % polygon.points.length]);

      if (pointsEqual(start, end)) {
        continue;
      }

      const key = normalizedEdgeKey(start, end);
      const existing = edgeMap.get(key);

      if (existing) {
        existing.locationIds.add(polygon.locationId);
      } else {
        edgeMap.set(key, {
          points: [start, end],
          locationIds: new Set([polygon.locationId]),
        });
      }
    }
  }

  const segments: RealmTileBorderPath[] = [];

  edgeMap.forEach((edge, key) => {
    const ids = [...edge.locationIds].sort();

    segments.push({
      id: `poly|${key}`,
      points: [edge.points[0], edge.points[1]],
      locationIds: ids,
    });
  });

  return segments;
}

export function findRealmTileAssignmentAtPoint(
  tileAssignments: RealmTileAssignment[],
  point: RealmPoint,
  realmBorder: RealmPoint[] = [],
) {
  if (realmBorder.length >= 3 && !isPointInsidePolygon(point, realmBorder)) {
    return null;
  }

  return (
    tileAssignments.find((tile) => {
      const [[minLatitude, minLongitude], [maxLatitude, maxLongitude]] = tile.bounds;

      return (
        point.latitude >= minLatitude &&
        point.latitude <= maxLatitude &&
        point.longitude >= minLongitude &&
        point.longitude <= maxLongitude
      );
    }) ?? null
  );
}

function clipSegmentToPolygon(
  points: [[number, number], [number, number]],
  polygon: RealmPoint[],
) {
  if (polygon.length < 3) {
    return null;
  }

  const start = { latitude: points[0][0], longitude: points[0][1] };
  const end = { latitude: points[1][0], longitude: points[1][1] };
  const candidates: SegmentPoint[] = [];

  if (isPointInsidePolygon(start, polygon)) {
    candidates.push({ ...start, t: 0 });
  }

  if (isPointInsidePolygon(end, polygon)) {
    candidates.push({ ...end, t: 1 });
  }

  for (let index = 0; index < polygon.length; index += 1) {
    const clipStart = polygon[index];
    const clipEnd = polygon[(index + 1) % polygon.length];
    const intersection = intersectSegments(start, end, clipStart, clipEnd);

    if (intersection) {
      candidates.push(intersection);
    }
  }

  const clipped = dedupeSegmentPoints(candidates).sort((left, right) => left.t - right.t);

  if (clipped.length < 2) {
    return null;
  }

  const first = clipped[0];
  const last = clipped[clipped.length - 1];

  return [
    [first.latitude, first.longitude],
    [last.latitude, last.longitude],
  ] as [[number, number], [number, number]];
}

type LocationBoundarySegment = {
  points: [[number, number], [number, number]];
};

function stitchLocationLoops(segments: LocationBoundarySegment[]) {
  const segmentsByPoint = new Map<string, number[]>();
  const consumed = new Set<number>();

  segments.forEach((segment, index) => {
    const startKey = pointKey(segment.points[0]);
    const endKey = pointKey(segment.points[1]);
    segmentsByPoint.set(startKey, [...(segmentsByPoint.get(startKey) ?? []), index]);
    segmentsByPoint.set(endKey, [...(segmentsByPoint.get(endKey) ?? []), index]);
  });

  function nextSegment(point: [number, number], excludeIndex?: number) {
    const connected = segmentsByPoint.get(pointKey(point)) ?? [];
    return connected.find((index) => !consumed.has(index) && index !== excludeIndex);
  }

  const loops: Array<Array<[number, number]>> = [];

  segments.forEach((segment, startIndex) => {
    if (consumed.has(startIndex)) {
      return;
    }

    const path: Array<[number, number]> = [segment.points[0], segment.points[1]];
    consumed.add(startIndex);

    let extended = true;
    while (extended) {
      extended = false;

      const tail = path[path.length - 1];
      const tailIndex = nextSegment(tail);
      if (tailIndex !== undefined) {
        const next = segments[tailIndex];
        const nextPoint = pointsEqual(next.points[0], tail) ? next.points[1] : next.points[0];
        path.push(nextPoint);
        consumed.add(tailIndex);
        extended = true;
      }

      const head = path[0];
      const headIndex = nextSegment(head);
      if (headIndex !== undefined) {
        const next = segments[headIndex];
        const nextPoint = pointsEqual(next.points[0], head) ? next.points[1] : next.points[0];
        path.unshift(nextPoint);
        consumed.add(headIndex);
        extended = true;
      }
    }

    if (path.length < 4 || !pointsEqual(path[0], path[path.length - 1])) {
      return;
    }

    const normalized = path.slice(0, -1);
    if (normalized.length < 3) {
      return;
    }

    loops.push(normalized);
  });

  return loops;
}

export function createRealmLocationPolygons(
  tileAssignments: RealmTileAssignment[],
  realmBorder: RealmPoint[] = [],
) {
  const tilesById = new Map(tileAssignments.map((tile) => [tile.id, tile]));
  const insideTileIds = new Set<string>();

  for (const tile of tileAssignments) {
    if (realmBorder.length >= 3 && !isPointInsidePolygon(tile.center, realmBorder)) {
      continue;
    }
    insideTileIds.add(tile.id);
  }

  const locationSegments = new Map<string, LocationBoundarySegment[]>();

  function addLocationSegment(locationId: string, points: [[number, number], [number, number]]) {
    if (pointsEqual(points[0], points[1])) {
      return;
    }

    // Keep raw tile-edge segments here to preserve closed loops for edge territories.
    // Realm trimming is already handled by the inside-tile filter above.
    locationSegments.set(locationId, [...(locationSegments.get(locationId) ?? []), { points }]);
  }

  for (const tile of tileAssignments) {
    if (!insideTileIds.has(tile.id)) {
      continue;
    }

    const [rowText, columnText] = tile.id.split(":");
    const rowIndex = Number(rowText);
    const columnIndex = Number(columnText);

    if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex)) {
      continue;
    }

    const [[minLatitude, minLongitude], [maxLatitude, maxLongitude]] = tile.bounds;
    const neighbors = [
      {
        id: `${rowIndex}:${columnIndex - 1}`,
        segment: [[minLatitude, minLongitude], [maxLatitude, minLongitude]] as [[number, number], [number, number]],
      },
      {
        id: `${rowIndex}:${columnIndex + 1}`,
        segment: [[minLatitude, maxLongitude], [maxLatitude, maxLongitude]] as [[number, number], [number, number]],
      },
      {
        id: `${rowIndex - 1}:${columnIndex}`,
        segment: [[minLatitude, minLongitude], [minLatitude, maxLongitude]] as [[number, number], [number, number]],
      },
      {
        id: `${rowIndex + 1}:${columnIndex}`,
        segment: [[maxLatitude, minLongitude], [maxLatitude, maxLongitude]] as [[number, number], [number, number]],
      },
    ];

    for (const neighbor of neighbors) {
      const adjacent = tilesById.get(neighbor.id);
      const adjacentInside = adjacent ? insideTileIds.has(adjacent.id) : false;
      const sameLocation = adjacentInside && adjacent?.locationId === tile.locationId;

      if (!sameLocation) {
        addLocationSegment(tile.locationId, neighbor.segment);
      }
    }
  }

  const polygons: RealmLocationPolygon[] = [];

  for (const [locationId, segments] of locationSegments) {
    const loops = stitchLocationLoops(segments);
    loops.forEach((loop, index) => {
      polygons.push({
        id: `${locationId}|${index}`,
        locationId,
        points: loop,
      });
    });
  }

  return polygons;
}

export function smoothRealmLocationPolygons(
  polygons: RealmLocationPolygon[],
  iterations = 2,
  alpha = 0.42,
) {
  if (iterations <= 0 || polygons.length === 0) {
    return polygons;
  }

  const adjacency = new Map<string, Set<string>>();
  const positions = new Map<string, [number, number]>();

  function ensureVertex(point: [number, number]) {
    const key = pointKey(point);
    if (!positions.has(key)) {
      positions.set(key, [point[0], point[1]]);
    }
    if (!adjacency.has(key)) {
      adjacency.set(key, new Set<string>());
    }
    return key;
  }

  polygons.forEach((polygon) => {
    if (polygon.points.length < 2) {
      return;
    }

    for (let index = 0; index < polygon.points.length; index += 1) {
      const start = polygon.points[index];
      const end = polygon.points[(index + 1) % polygon.points.length];
      const startKey = ensureVertex(start);
      const endKey = ensureVertex(end);

      if (startKey === endKey) {
        continue;
      }

      adjacency.get(startKey)?.add(endKey);
      adjacency.get(endKey)?.add(startKey);
    }
  });

  let current = new Map(positions);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const next = new Map<string, [number, number]>();

    current.forEach((point, key) => {
      const neighbors = adjacency.get(key);
      if (!neighbors || neighbors.size === 0) {
        next.set(key, point);
        return;
      }

      let latitudeSum = 0;
      let longitudeSum = 0;
      let count = 0;

      neighbors.forEach((neighborKey) => {
        const neighborPoint = current.get(neighborKey);
        if (!neighborPoint) {
          return;
        }
        latitudeSum += neighborPoint[0];
        longitudeSum += neighborPoint[1];
        count += 1;
      });

      if (count === 0) {
        next.set(key, point);
        return;
      }

      const avgLatitude = latitudeSum / count;
      const avgLongitude = longitudeSum / count;

      next.set(key, [
        point[0] * (1 - alpha) + avgLatitude * alpha,
        point[1] * (1 - alpha) + avgLongitude * alpha,
      ]);
    });

    current = next;
  }

  return polygons.map((polygon) => ({
    ...polygon,
    points: polygon.points.map((point) => {
      const value = current.get(pointKey(point));
      if (!value) {
        return point;
      }

      return [
        Number(value[0].toFixed(6)),
        Number(value[1].toFixed(6)),
      ] as [number, number];
    }),
  }));
}

export function calculatePolygonAreaSquareMeters(points: Array<[number, number]>) {
  if (points.length < 3) {
    return 0;
  }

  const earthRadiusM = 6371008.8;
  const latitudeOrigin =
    points.reduce((sum, point) => sum + point[0], 0) / points.length;
  const latitudeOriginRad = (latitudeOrigin * Math.PI) / 180;

  const projected = points.map(([latitude, longitude]) => {
    const latitudeRad = (latitude * Math.PI) / 180;
    const longitudeRad = (longitude * Math.PI) / 180;

    return {
      x: earthRadiusM * longitudeRad * Math.cos(latitudeOriginRad),
      y: earthRadiusM * latitudeRad,
    };
  });

  let doubleArea = 0;

  for (let index = 0; index < projected.length; index += 1) {
    const current = projected[index];
    const next = projected[(index + 1) % projected.length];
    doubleArea += current.x * next.y - next.x * current.y;
  }

  return Math.abs(doubleArea) * 0.5;
}

export function calculateLocationAreasSquareMeters(polygons: RealmLocationPolygon[]) {
  const areasByLocationId: Record<string, number> = {};

  polygons.forEach((polygon) => {
    const area = calculatePolygonAreaSquareMeters(polygon.points);
    areasByLocationId[polygon.locationId] = (areasByLocationId[polygon.locationId] ?? 0) + area;
  });

  return areasByLocationId;
}

export function findRealmLocationPolygonAtPoint(
  polygons: RealmLocationPolygon[],
  point: RealmPoint,
  realmBorder: RealmPoint[] = [],
) {
  if (realmBorder.length >= 3 && !isPointInsidePolygon(point, realmBorder)) {
    return null;
  }

  for (const polygon of polygons) {
    const ring = polygon.points.map(([latitude, longitude]) => ({ latitude, longitude }));
    if (ring.length >= 3 && isPointInsidePolygon(point, ring)) {
      return polygon;
    }
  }

  return null;
}

export function createRealmTileBorders(tileAssignments: RealmTileAssignment[], realmBorder: RealmPoint[] = []) {
  const tilesById = new Map(tileAssignments.map((tile) => [tile.id, tile]));
  const segments: RealmTileBorderSegment[] = [];

  for (const tile of tileAssignments) {
    const [rowText, columnText] = tile.id.split(":");
    const rowIndex = Number(rowText);
    const columnIndex = Number(columnText);

    if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex)) {
      continue;
    }

    const rightTile = tilesById.get(`${rowIndex}:${columnIndex + 1}`);
    if (rightTile && rightTile.locationId !== tile.locationId) {
      const [[minLatitude, _minLongitude], [maxLatitude, maxLongitude]] = tile.bounds;
      const unclipped: [[number, number], [number, number]] = [
        [minLatitude, maxLongitude],
        [maxLatitude, maxLongitude],
      ];
      const points = realmBorder.length >= 3 ? clipSegmentToPolygon(unclipped, realmBorder) : unclipped;
      if (!points) {
        continue;
      }
      segments.push({
        id: `${tile.id}|right`,
        points,
        locationIds: [tile.locationId, rightTile.locationId],
      });
    }

    const bottomTile = tilesById.get(`${rowIndex + 1}:${columnIndex}`);
    if (bottomTile && bottomTile.locationId !== tile.locationId) {
      const [[_minLatitude, minLongitude], [maxLatitude, maxLongitude]] = tile.bounds;
      const unclipped: [[number, number], [number, number]] = [
        [maxLatitude, minLongitude],
        [maxLatitude, maxLongitude],
      ];
      const points = realmBorder.length >= 3 ? clipSegmentToPolygon(unclipped, realmBorder) : unclipped;
      if (!points) {
        continue;
      }
      segments.push({
        id: `${tile.id}|bottom`,
        points,
        locationIds: [tile.locationId, bottomTile.locationId],
      });
    }
  }

  return buildBorderPaths(segments);
}
