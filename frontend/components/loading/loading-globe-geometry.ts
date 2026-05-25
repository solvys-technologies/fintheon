import * as THREE from "three";
import type { BeamTarget } from "./loading-globe-config";

export interface CountryGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: PolygonCoordinates | PolygonCoordinates[];
}

export interface BeamPoint {
  name: string;
  point: THREE.Vector3;
}

type Coordinate = [number, number, ...number[]];
type LinearRing = Coordinate[];
type PolygonCoordinates = LinearRing[];

export function makeDitherGeometry(
  count: number,
  radius: number,
  jitter: number,
  color: THREE.Color,
) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    const shade = 0.38 + ((i * 37) % 100) / 155;
    const pointRadius = radius + Math.sin(i * 0.37) * jitter;

    positions[i * 3] = Math.cos(theta) * r * pointRadius;
    positions[i * 3 + 1] = y * (radius + Math.cos(i * 0.19) * jitter);
    positions[i * 3 + 2] = Math.sin(theta) * r * pointRadius;
    colors[i * 3] = color.r * shade;
    colors[i * 3 + 1] = color.g * shade;
    colors[i * 3 + 2] = color.b * shade;
  }

  return makeGeometry(positions, colors);
}

export function makeLatitudeGeometry(y: number) {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 128; i += 1) {
    const a = (i / 128) * Math.PI * 2;
    const radius = Math.sqrt(1 - y * y);
    points.push(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

export function makeMeridianGeometry(angle: number) {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 128; i += 1) {
    const a = (i / 128) * Math.PI * 2;
    const ring = Math.sin(a);
    points.push(
      new THREE.Vector3(ring * Math.cos(angle), Math.cos(a), ring * Math.sin(angle)),
    );
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

export function makeStarfieldGeometry(count: number, color: THREE.Color) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  let placed = 0;
  let attempts = 0;

  while (placed < count && attempts < count * 8) {
    const seed = attempts * 4;
    const x = (starNoise(seed) - 0.5) * 8.2;
    const y = (starNoise(seed + 1) - 0.5) * 4.9;
    const z = -2.6 - starNoise(seed + 2) * 4.4;
    attempts += 1;
    if (Math.hypot(x * 0.76, y) < 1.08 && starNoise(seed + 3) < 0.86) continue;

    const flicker = 0.42 + starNoise(seed + 3) * 0.5;
    positions[placed * 3] = x;
    positions[placed * 3 + 1] = y;
    positions[placed * 3 + 2] = z;
    colors[placed * 3] = color.r * flicker;
    colors[placed * 3 + 1] = color.g * flicker;
    colors[placed * 3 + 2] = color.b * flicker;
    placed += 1;
  }

  return makeGeometry(positions, colors);
}

export function lonLatToVector(lon: number, lat: number, radius = 1) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

export function drawCountryGeometry({
  geometry,
  outlineMaterial,
  fillMaterial,
  countryLayer,
  countryFillLayer,
}: DrawCountryGeometryOptions) {
  if (geometry.type === "Polygon") {
    addCountryFillPolygon(geometry.coordinates as PolygonCoordinates, fillMaterial, countryFillLayer);
    (geometry.coordinates as PolygonCoordinates).forEach((ring) =>
      addCountryRing(ring, outlineMaterial, countryLayer),
    );
    return;
  }

  (geometry.coordinates as PolygonCoordinates[]).forEach((polygon) => {
    addCountryFillPolygon(polygon, fillMaterial, countryFillLayer);
    polygon.forEach((ring) => addCountryRing(ring, outlineMaterial, countryLayer));
  });
}

export function pickBeamPair(targets: BeamTarget[], maxAngle: number) {
  let bestPair: BeamPair | null = null;
  let bestAngle = Infinity;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const start = pickBeamTarget(targets);
    const end = pickBeamTarget(targets, start.name);
    const angle = start.point.clone().normalize().angleTo(end.point.clone().normalize());
    if (angle <= maxAngle) return { start, end };
    if (angle < bestAngle) {
      bestPair = { start, end };
      bestAngle = angle;
    }
  }

  return bestPair;
}

export function makeShotPoints(start: THREE.Vector3, end: THREE.Vector3, maxAngle: number) {
  const points: THREE.Vector3[] = [];
  const startNormal = start.clone().normalize();
  const endNormal = end.clone().normalize();
  const angle = Math.min(maxAngle, startNormal.angleTo(endNormal));
  const segments = Math.max(52, Math.ceil(angle * 42));
  const sinAngle = Math.sin(angle);

  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const point =
      sinAngle < 0.001
        ? startNormal.clone().lerp(endNormal, t)
        : startNormal
            .clone()
            .multiplyScalar(Math.sin((1 - t) * angle) / sinAngle)
            .add(endNormal.clone().multiplyScalar(Math.sin(t * angle) / sinAngle));
    points.push(point.normalize().multiplyScalar(1.012 + Math.sin(t * Math.PI) * 0.26));
  }

  return points;
}

function pickBeamTarget(targets: BeamTarget[], excludeName?: string): BeamPoint {
  let target = targets[Math.floor(Math.random() * targets.length)];
  if (excludeName && targets.length > 1) {
    while (target.name === excludeName) target = targets[Math.floor(Math.random() * targets.length)];
  }

  const jitterLon = (Math.random() - 0.5) * target.jitter;
  const jitterLat = (Math.random() - 0.5) * target.jitter * 0.72;
  return {
    name: target.name,
    point: lonLatToVector(target.lon + jitterLon, target.lat + jitterLat, 1.012),
  };
}

function addCountryRing(
  coords: LinearRing,
  material: THREE.LineBasicMaterial,
  countryLayer: THREE.Group,
) {
  const points = coords.map((coord) => lonLatToVector(coord[0], coord[1], 0.992));
  if (points.length < 2) return;
  countryLayer.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
}

function addCountryFillPolygon(
  polygon: PolygonCoordinates,
  material: THREE.MeshBasicMaterial,
  countryFillLayer: THREE.Group,
) {
  const rings = polygon.filter((ring) => ring.length >= 3);
  if (rings.length === 0) return;

  const outer = rings[0].map((coord) => new THREE.Vector2(coord[0], coord[1]));
  const holes = rings.slice(1).map((ring) => ring.map((coord) => new THREE.Vector2(coord[0], coord[1])));
  const coords = rings.flat();
  const triangles = THREE.ShapeUtils.triangulateShape(outer, holes);
  if (!triangles.length) return;

  const positions: number[] = [];
  for (const triangle of triangles) {
    for (const index of triangle) {
      const coord = coords[index];
      const point = lonLatToVector(coord[0], coord[1], 0.987);
      positions.push(point.x, point.y, point.z);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  countryFillLayer.add(new THREE.Mesh(geometry, material));
}

function makeGeometry(positions: Float32Array, colors: Float32Array) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function starNoise(index: number) {
  const wave = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return wave - Math.floor(wave);
}

interface BeamPair {
  start: BeamPoint;
  end: BeamPoint;
}

interface DrawCountryGeometryOptions {
  geometry: CountryGeometry;
  outlineMaterial: THREE.LineBasicMaterial;
  fillMaterial: THREE.MeshBasicMaterial;
  countryLayer: THREE.Group;
  countryFillLayer: THREE.Group;
}
