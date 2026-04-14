import mapboxgl, { type CustomLayerInterface, type LngLatBounds } from 'mapbox-gl';
import * as THREE from 'three';

const FEET_TO_METERS = 0.3048;
const ENVELOPE_FILL_COLOR = 0xff3b30;
const ENVELOPE_FILL_OPACITY = 0.18;
const ENVELOPE_LINE_COLOR = 0x912739;
const ENVELOPE_LINE_OPACITY = 0.5;
const ENVELOPE_HIDDEN_LINE_OPACITY = 0.1;
const ENVELOPE_HIDDEN_LINE_DASH_SIZE = 0.5;
const ENVELOPE_HIDDEN_LINE_GAP_SIZE = 1;

type Anchor = {
  lng: number;
  lat: number;
  elevation_m?: number;
};

type EnvelopeItem = {
  id: string;
  bbl: string;
  borough: number;
  block: number;
  lot: number;
  anchor: Anchor;
  vertices_m: [number, number, number][];
  faces: [number, number, number][];
  edges: [number, number][];
};

export type ZoningEnvelopeCollection = {
  version: number;
  coordinate_system: string;
  units: 'meters' | 'feet';
  items: EnvelopeItem[];
};

type EnvelopeScene = {
  anchor: Anchor;
  root: THREE.Group;
};

function getUnitScale(units: ZoningEnvelopeCollection['units']) {
  return units === 'feet' ? FEET_TO_METERS : 1;
}

function buildFaceGeometry(
  vertices: [number, number, number][],
  faces: [number, number, number][]
) {
  const positions = new Float32Array(faces.length * 9);

  faces.forEach(([a, b, c], faceIndex) => {
    const offset = faceIndex * 9;
    const [ax, ay, az] = vertices[a];
    const [bx, by, bz] = vertices[b];
    const [cx, cy, cz] = vertices[c];

    positions.set([ax, -ay, az, bx, -by, bz, cx, -cy, cz], offset);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function buildEdgeGeometry(
  vertices: [number, number, number][],
  edges: [number, number][]
) {
  const positions = new Float32Array(edges.length * 6);

  edges.forEach(([start, end], edgeIndex) => {
    const offset = edgeIndex * 6;
    const [sx, sy, sz] = vertices[start];
    const [ex, ey, ez] = vertices[end];

    positions.set([sx, -sy, sz, ex, -ey, ez], offset);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return geometry;
}

export function buildEnvelopeSceneGroup(collection: ZoningEnvelopeCollection) {
  const unitScale = getUnitScale(collection.units);
  const sceneAnchor = collection.items[0]?.anchor;
  const group = new THREE.Group();
  group.name = 'zsf-envelope-scene';

  if (!sceneAnchor) {
    throw new Error('Envelope collection does not contain any items.');
  }

  const sceneMercatorAnchor = mapboxgl.MercatorCoordinate.fromLngLat(
    { lng: sceneAnchor.lng, lat: sceneAnchor.lat },
    sceneAnchor.elevation_m ?? 0
  );
  const sceneMeterScale = sceneMercatorAnchor.meterInMercatorCoordinateUnits();

  collection.items.forEach((item) => {
    const mercatorAnchor = mapboxgl.MercatorCoordinate.fromLngLat(
      { lng: item.anchor.lng, lat: item.anchor.lat },
      item.anchor.elevation_m ?? 0
    );

    const itemGroup = new THREE.Group();
    itemGroup.name = item.id;
    itemGroup.position.set(
      (mercatorAnchor.x - sceneMercatorAnchor.x) / sceneMeterScale,
      (mercatorAnchor.y - sceneMercatorAnchor.y) / sceneMeterScale,
      (mercatorAnchor.z - sceneMercatorAnchor.z) / sceneMeterScale
    );

    if (item.faces.length > 0) {
      const faceGeometry = buildFaceGeometry(item.vertices_m, item.faces);

      const mesh = new THREE.Mesh(
        faceGeometry,
        new THREE.MeshBasicMaterial({
          color: ENVELOPE_FILL_COLOR,
          transparent: true,
          opacity: ENVELOPE_FILL_OPACITY,
          depthWrite: false,
          side: THREE.DoubleSide,
        })
      );
      mesh.scale.setScalar(unitScale);
      mesh.renderOrder = 0;
      itemGroup.add(mesh);

      // After the visible translucent fill renders, write face depth so
      // hidden edge lines stay occluded by nearer red surfaces.
      const depthMesh = new THREE.Mesh(
        faceGeometry,
        new THREE.MeshBasicMaterial({
          colorWrite: false,
          depthWrite: true,
          depthTest: true,
          side: THREE.DoubleSide,
        })
      );
      depthMesh.scale.setScalar(unitScale);
      depthMesh.renderOrder = 1;
      itemGroup.add(depthMesh);
    }

    if (item.edges.length > 0) {
      const edgeGeometry = buildEdgeGeometry(item.vertices_m, item.edges);

      const hiddenLines = new THREE.LineSegments(
        edgeGeometry,
        new THREE.LineDashedMaterial({
          color: ENVELOPE_LINE_COLOR,
          transparent: true,
          opacity: ENVELOPE_HIDDEN_LINE_OPACITY,
          dashSize: ENVELOPE_HIDDEN_LINE_DASH_SIZE,
          gapSize: ENVELOPE_HIDDEN_LINE_GAP_SIZE,
          depthTest: true,
          depthWrite: false,
          depthFunc: THREE.GreaterDepth,
        })
      );
      hiddenLines.computeLineDistances();
      hiddenLines.scale.setScalar(unitScale);
      hiddenLines.renderOrder = 2;
      itemGroup.add(hiddenLines);

      const visibleLines = new THREE.LineSegments(
        edgeGeometry,
        new THREE.LineBasicMaterial({
          color: ENVELOPE_LINE_COLOR,
          transparent: true,
          opacity: ENVELOPE_LINE_OPACITY,
          depthTest: true,
          depthWrite: false,
        })
      );
      visibleLines.scale.setScalar(unitScale);
      visibleLines.renderOrder = 3;
      itemGroup.add(visibleLines);
    }

    group.add(itemGroup);
  });

  return {
    anchor: sceneAnchor,
    root: group,
  } satisfies EnvelopeScene;
}

function mercatorXToLng(x: number) {
  return x * 360 - 180;
}

function mercatorYToLat(y: number) {
  const yDegrees = 180 - y * 360;
  return (360 / Math.PI) * Math.atan(Math.exp((yDegrees * Math.PI) / 180)) - 90;
}

export function getEnvelopeCollectionBounds(
  collection: ZoningEnvelopeCollection
): LngLatBounds {
  const unitScale = getUnitScale(collection.units);

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  collection.items.forEach((item) => {
    const mercatorAnchor = mapboxgl.MercatorCoordinate.fromLngLat(
      { lng: item.anchor.lng, lat: item.anchor.lat },
      item.anchor.elevation_m ?? 0
    );
    const meterScale = mercatorAnchor.meterInMercatorCoordinateUnits();

    item.vertices_m.forEach(([x, y]) => {
      const mercatorX = mercatorAnchor.x + x * unitScale * meterScale;
      const mercatorY = mercatorAnchor.y - y * unitScale * meterScale;
      const lng = mercatorXToLng(mercatorX);
      const lat = mercatorYToLat(mercatorY);

      minLng = Math.min(minLng, lng);
      minLat = Math.min(minLat, lat);
      maxLng = Math.max(maxLng, lng);
      maxLat = Math.max(maxLat, lat);
    });
  });

  return new mapboxgl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);
}

export function createMercatorSceneLayer(
  id: string,
  root: THREE.Object3D,
  anchor: Anchor
): CustomLayerInterface {
  const camera = new THREE.Camera();
  const scene = new THREE.Scene();
  scene.add(root);
  const mercatorAnchor = mapboxgl.MercatorCoordinate.fromLngLat(
    { lng: anchor.lng, lat: anchor.lat },
    anchor.elevation_m ?? 0
  );
  const modelTransform = {
    translateX: mercatorAnchor.x,
    translateY: mercatorAnchor.y,
    translateZ: mercatorAnchor.z,
    scale: mercatorAnchor.meterInMercatorCoordinateUnits(),
  };

  let renderer: THREE.WebGLRenderer | null = null;

  return {
    id,
    type: 'custom',
    renderingMode: '3d',
    onAdd: (map, gl) => {
      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
    },
    render: (_gl, matrix) => {
      if (!renderer) {
        return;
      }

      const projectionMatrix = new THREE.Matrix4().fromArray(matrix as number[]);
      const modelMatrix = new THREE.Matrix4()
        .makeTranslation(
          modelTransform.translateX,
          modelTransform.translateY,
          modelTransform.translateZ
        )
        .scale(
          new THREE.Vector3(
            modelTransform.scale,
            modelTransform.scale,
            modelTransform.scale
          )
        );

      camera.projectionMatrix = projectionMatrix.multiply(modelMatrix);
      renderer.resetState();
      renderer.render(scene, camera);
    },
  };
}

export function disposeThreeObject(object: THREE.Object3D) {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }

    const material = (mesh as { material?: THREE.Material | THREE.Material[] })
      .material;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else {
      material?.dispose();
    }
  });
}
