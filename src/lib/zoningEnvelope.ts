import mapboxgl, { type CustomLayerInterface, type LngLatBounds } from 'mapbox-gl';
import * as THREE from 'three';

const FEET_TO_METERS = 0.3048;
const ENVELOPE_FILL_COLOR = 0xff3b30;
const ENVELOPE_FILL_OPACITY = 0.1;
const ENVELOPE_LINE_COLOR = 0x912739;
const ENVELOPE_LINE_OPACITY = 0.3;
const ENVELOPE_SELECTED_LINE_COLOR = 0xa8001d;
const ENVELOPE_SELECTED_LINE_OPACITY = 0.95;
const ENVELOPE_HIDDEN_LINE_OPACITY = 0.09;
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
  items: EnvelopeSceneItem[];
};

type EnvelopeSceneItem = {
  id: string;
  bbl: string;
  group: THREE.Group;
  faceMesh: THREE.Mesh | null;
  depthMesh: THREE.Mesh | null;
  hiddenLines: THREE.LineSegments | null;
  visibleLines: THREE.LineSegments | null;
  facePositions: Float32Array | null;
};

export type PickedEnvelope = {
  id: string;
  bbl: string;
};

export type EnvelopeSceneLayer = CustomLayerInterface & {
  pickItemAtScreenPoint: (
    x: number,
    y: number,
    viewportWidth: number,
    viewportHeight: number
  ) => PickedEnvelope | null;
  setSelectedItem: (itemId: string | null) => void;
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

function setEnvelopeItemSelectedState(item: EnvelopeSceneItem, isSelected: boolean) {
  if (item.depthMesh) {
    item.depthMesh.visible = !isSelected;
  }

  if (item.hiddenLines) {
    item.hiddenLines.visible = !isSelected;
  }

  if (item.visibleLines) {
    const material = item.visibleLines.material as THREE.LineBasicMaterial;
    material.depthTest = !isSelected;
    material.color.setHex(
      isSelected ? ENVELOPE_SELECTED_LINE_COLOR : ENVELOPE_LINE_COLOR
    );
    material.opacity = isSelected
      ? ENVELOPE_SELECTED_LINE_OPACITY
      : ENVELOPE_LINE_OPACITY;
    material.needsUpdate = true;
    item.visibleLines.renderOrder = isSelected ? 4 : 3;
  }
}

function isPointInTriangle(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number
) {
  const denominator = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(denominator) < 1e-9) {
    return false;
  }

  const alpha = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / denominator;
  const beta = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / denominator;
  const gamma = 1 - alpha - beta;

  return alpha >= 0 && beta >= 0 && gamma >= 0;
}

export function buildEnvelopeSceneGroup(collection: ZoningEnvelopeCollection) {
  const unitScale = getUnitScale(collection.units);
  const sceneAnchor = collection.items[0]?.anchor;
  const group = new THREE.Group();
  group.name = 'zsf-envelope-scene';
  const items: EnvelopeSceneItem[] = [];

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

      const itemRecord: EnvelopeSceneItem = {
        id: item.id,
        bbl: item.bbl,
        group: itemGroup,
        faceMesh: mesh,
        depthMesh,
        hiddenLines: null,
        visibleLines: null,
        facePositions: faceGeometry.attributes.position.array as Float32Array,
      };
      items.push(itemRecord);
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

      const existingItem = items.find((entry) => entry.id === item.id);
      if (existingItem) {
        existingItem.hiddenLines = hiddenLines;
        existingItem.visibleLines = visibleLines;
      } else {
        items.push({
          id: item.id,
          bbl: item.bbl,
          group: itemGroup,
          faceMesh: null,
          depthMesh: null,
          hiddenLines,
          visibleLines,
          facePositions: null,
        });
      }
    }

    group.add(itemGroup);
  });

  return {
    anchor: sceneAnchor,
    root: group,
    items,
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
  envelopeScene: EnvelopeScene
): EnvelopeSceneLayer {
  const camera = new THREE.Camera();
  const scene = new THREE.Scene();
  scene.add(envelopeScene.root);
  const mercatorAnchor = mapboxgl.MercatorCoordinate.fromLngLat(
    { lng: envelopeScene.anchor.lng, lat: envelopeScene.anchor.lat },
    envelopeScene.anchor.elevation_m ?? 0
  );
  const modelTransform = {
    translateX: mercatorAnchor.x,
    translateY: mercatorAnchor.y,
    translateZ: mercatorAnchor.z,
    scale: mercatorAnchor.meterInMercatorCoordinateUnits(),
  };

  let renderer: THREE.WebGLRenderer | null = null;
  let latestProjectionMatrix: THREE.Matrix4 | null = null;
  let selectedItemId: string | null = null;
  const projectedA = new THREE.Vector3();
  const projectedB = new THREE.Vector3();
  const projectedC = new THREE.Vector3();

  function setSelectedItem(itemId: string | null) {
    if (selectedItemId === itemId) {
      return;
    }

    selectedItemId = itemId;
    envelopeScene.items.forEach((item) => {
      setEnvelopeItemSelectedState(item, item.id === itemId);
    });
  }

  function projectToScreen(
    x: number,
    y: number,
    z: number,
    matrixWorld: THREE.Matrix4,
    projectionMatrix: THREE.Matrix4,
    viewportWidth: number,
    viewportHeight: number,
    target: THREE.Vector3
  ) {
    target.set(x, y, z).applyMatrix4(matrixWorld).applyMatrix4(projectionMatrix);

    if (
      !Number.isFinite(target.x) ||
      !Number.isFinite(target.y) ||
      !Number.isFinite(target.z)
    ) {
      return false;
    }

    target.x = (target.x * 0.5 + 0.5) * viewportWidth;
    target.y = (-target.y * 0.5 + 0.5) * viewportHeight;
    return true;
  }

  function pickItemAtScreenPoint(
    x: number,
    y: number,
    viewportWidth: number,
    viewportHeight: number
  ) {
    if (!latestProjectionMatrix) {
      return null;
    }

    envelopeScene.root.updateMatrixWorld(true);

        let bestHit: PickedEnvelope | null = null;
    let bestDepth = Infinity;

    for (const item of envelopeScene.items) {
      if (!item.faceMesh || !item.facePositions) {
        continue;
      }

      const matrixWorld = item.faceMesh.matrixWorld;
      const positions = item.facePositions;

      for (let index = 0; index < positions.length; index += 9) {
        const hasA = projectToScreen(
          positions[index],
          positions[index + 1],
          positions[index + 2],
          matrixWorld,
          latestProjectionMatrix,
          viewportWidth,
          viewportHeight,
          projectedA
        );
        const hasB = projectToScreen(
          positions[index + 3],
          positions[index + 4],
          positions[index + 5],
          matrixWorld,
          latestProjectionMatrix,
          viewportWidth,
          viewportHeight,
          projectedB
        );
        const hasC = projectToScreen(
          positions[index + 6],
          positions[index + 7],
          positions[index + 8],
          matrixWorld,
          latestProjectionMatrix,
          viewportWidth,
          viewportHeight,
          projectedC
        );

        if (!hasA || !hasB || !hasC) {
          continue;
        }

        if (
          !isPointInTriangle(
            x,
            y,
            projectedA.x,
            projectedA.y,
            projectedB.x,
            projectedB.y,
            projectedC.x,
            projectedC.y
          )
        ) {
          continue;
        }

        const depth =
          (projectedA.z + projectedB.z + projectedC.z) / 3;
        if (depth < bestDepth) {
          bestDepth = depth;
          bestHit = {
            id: item.id,
            bbl: item.bbl,
          };
        }
      }
    }

    return bestHit;
  }

  return {
    id,
    type: 'custom',
    renderingMode: '3d',
    pickItemAtScreenPoint,
    setSelectedItem,
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
      latestProjectionMatrix = camera.projectionMatrix.clone();
      renderer.resetState();
      renderer.render(scene, camera);
    },
  } satisfies EnvelopeSceneLayer;
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
