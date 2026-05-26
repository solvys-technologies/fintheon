import * as THREE from "three";
import { BEAM_TARGETS, COUNTRY_GEOJSON_URL } from "./loading-globe-config";
import {
  type CountryGeometry,
  drawCountryGeometry,
  makeDitherGeometry,
  makeLatitudeGeometry,
  makeMeridianGeometry,
  makeShotPoints,
  makeStarfieldGeometry,
  pickBeamPair,
} from "./loading-globe-geometry";

export interface ActiveShot {
  line: THREE.Line;
  points: THREE.Vector3[];
  age: number;
  duration: number;
}

export function addDitherAndGrid({
  globe,
  scene,
  primaryColor,
  starGold,
  density,
}: AddSceneOptions) {
  const dotMaterial = new THREE.PointsMaterial({
    size: 0.0068,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.52,
    blending: THREE.AdditiveBlending,
  });
  const dotCount = Math.floor(11800 * density);
  globe.add(
    new THREE.Points(
      makeDitherGeometry(dotCount, 1, 0.009, primaryColor),
      dotMaterial,
    ),
  );

  const lineMaterial = new THREE.LineBasicMaterial({
    color: primaryColor,
    transparent: true,
    opacity: 0.28,
    blending: THREE.AdditiveBlending,
  });
  [-0.72, -0.5, -0.25, 0, 0.25, 0.5, 0.72].forEach((y) =>
    globe.add(new THREE.Line(makeLatitudeGeometry(y), lineMaterial)),
  );
  Array.from({ length: 12 }, (_, index) => (index / 12) * Math.PI).forEach(
    (angle) =>
      globe.add(new THREE.Line(makeMeridianGeometry(angle), lineMaterial)),
  );
  globe.add(makeAura(primaryColor));

  const starMaterial = new THREE.PointsMaterial({
    size: 0.012,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.07,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const starfield = new THREE.Points(
    makeStarfieldGeometry(190, starGold),
    starMaterial,
  );
  starfield.name = "starfield";
  scene.add(starfield);
}

export async function loadCountries({
  countryLayer,
  countryFillLayer,
  primaryColor,
  isDisposed,
}: LoadCountriesOptions) {
  try {
    const response = await fetch(COUNTRY_GEOJSON_URL);
    if (!response.ok || isDisposed()) return;
    const geojson = (await response.json()) as CountryFeatureCollection;
    const outlineMaterial = new THREE.LineBasicMaterial({
      color: primaryColor,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    const fillMaterial = new THREE.MeshBasicMaterial({
      color: primaryColor,
      transparent: true,
      opacity: 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    geojson.features?.forEach((feature) => {
      if (!feature.geometry || isDisposed()) return;
      drawCountryGeometry({
        geometry: feature.geometry,
        outlineMaterial,
        fillMaterial,
        countryLayer,
        countryFillLayer,
      });
    });
  } catch {}
}

export function makeGlobeBody(bgColor: THREE.Color) {
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.92, 64, 32),
    new THREE.MeshBasicMaterial({
      color: bgColor,
      transparent: true,
      opacity: 0.3,
      depthWrite: true,
    }),
  );
  body.renderOrder = -1;
  return body;
}

export function spawnShot(
  shotLayer: THREE.Group,
  activeShots: ActiveShot[],
  primaryColor: THREE.Color,
) {
  const pair = pickBeamPair(BEAM_TARGETS, 1.92);
  if (!pair) return;

  const points = makeShotPoints(pair.start.point, pair.end.point, 1.92);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  geometry.setDrawRange(0, 1);
  const material = new THREE.LineBasicMaterial({
    color: primaryColor,
    transparent: true,
    opacity: 0.78,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const line = new THREE.Line(geometry, material);
  shotLayer.add(line);
  activeShots.push({
    line,
    points,
    age: 0,
    duration: 2.85 + Math.random() * 0.75,
  });
}

export function updateShots(
  activeShots: ActiveShot[],
  delta: number,
  shotLayer: THREE.Group,
) {
  for (let i = activeShots.length - 1; i >= 0; i -= 1) {
    const shot = activeShots[i];
    shot.age += delta;
    const progress = Math.min(1, shot.age / shot.duration);
    const pointIndex = Math.max(
      1,
      Math.floor(progress * (shot.points.length - 1)),
    );
    shot.line.geometry.setDrawRange(0, pointIndex + 1);
    (shot.line.material as THREE.LineBasicMaterial).opacity =
      0.78 * (1 - Math.max(0, progress - 0.72) / 0.28);
    if (shot.age <= shot.duration + 0.12) continue;
    shotLayer.remove(shot.line);
    shot.line.geometry.dispose();
    (shot.line.material as THREE.LineBasicMaterial).dispose();
    activeShots.splice(i, 1);
  }
}

export function disposeShots(
  activeShots: ActiveShot[],
  shotLayer: THREE.Group,
) {
  activeShots.forEach((shot) => {
    shotLayer.remove(shot.line);
    shot.line.geometry.dispose();
    (shot.line.material as THREE.LineBasicMaterial).dispose();
  });
  activeShots.length = 0;
}

export function disposeObject(object: THREE.Object3D) {
  object.traverse((child: THREE.Object3D) => {
    const mesh = child as THREE.Mesh | THREE.Line | THREE.Points;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material?.dispose();
  });
}

function makeAura(primaryColor: THREE.Color) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(1.06, 48, 24),
    new THREE.MeshBasicMaterial({
      color: primaryColor,
      wireframe: true,
      transparent: true,
      opacity: 0.055,
    }),
  );
}

interface CountryFeatureCollection {
  features?: Array<{ geometry?: CountryGeometry }>;
}

interface AddSceneOptions {
  globe: THREE.Group;
  scene: THREE.Scene;
  primaryColor: THREE.Color;
  starGold: THREE.Color;
  density: number;
}

interface LoadCountriesOptions {
  countryLayer: THREE.Group;
  countryFillLayer: THREE.Group;
  primaryColor: THREE.Color;
  isDisposed: () => boolean;
}
