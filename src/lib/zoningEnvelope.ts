import mapboxgl, { type CustomLayerInterface, type LngLatBounds } from 'mapbox-gl';
import * as THREE from 'three';

const FEET_TO_METERS = 0.3048;
const ENVELOPE_FILL_COLOR = 0xff3b30;
const ENVELOPE_FILL_OPACITY = 0.15;
const ENVELOPE_LINE_COLOR = 0x912739;
const ENVELOPE_LINE_OPACITY = 0.15;
const ENVELOPE_SELECTED_LINE_COLOR = 0xa8001d;
const ENVELOPE_SELECTED_LINE_OPACITY = 0.95;
const ENVELOPE_HIDDEN_LINE_OPACITY = 0.1;
const ENVELOPE_HIDDEN_LINE_DASH_SIZE = 0.5;
const ENVELOPE_HIDDEN_LINE_GAP_SIZE = 1;
const ENVELOPE_MIN_BLOCK_FOOTPRINT_PX = 120;
const ENVELOPE_VIEWPORT_MARGIN_PX = 200;

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
  blocks: EnvelopeSceneBlock[];
  items: EnvelopeSceneItem[];
};

type EnvelopeSceneBlock = {
  id: string;
  bounds: LngLatBounds;
  center: { lng: number; lat: number };
  group: THREE.Group;
};

type EnvelopeSceneItem = {
  id: string;
  bbl: string;
  blockId: string;
  blockGroup: THREE.Group;
  group: THREE.Group;
  faceMesh: THREE.Mesh | null;
  depthMesh: THREE.Mesh | null;
  hiddenLines: THREE.LineSegments | null;
  visibleLines: THREE.LineSegments | null;
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

export function buildEnvelopeSceneGroup(collections: ZoningEnvelopeCollection[]) {
  const firstCollection = collections[0];
  const sceneAnchor = firstCollection?.items[0]?.anchor;
  const group = new THREE.Group();
  group.name = 'zsf-envelope-scene';
  const blocks: EnvelopeSceneBlock[] = [];
  const items: EnvelopeSceneItem[] = [];

  if (!sceneAnchor) {
    throw new Error('Envelope collection does not contain any items.');
  }

  const sceneMercatorAnchor = mapboxgl.MercatorCoordinate.fromLngLat(
    { lng: sceneAnchor.lng, lat: sceneAnchor.lat },
    sceneAnchor.elevation_m ?? 0
  );
  const sceneMeterScale = sceneMercatorAnchor.meterInMercatorCoordinateUnits();

  collections.forEach((collection, blockIndex) => {
    const unitScale = getUnitScale(collection.units);
    const blockBounds = getEnvelopeCollectionBounds(collection);
    const firstItem = collection.items[0];
    const blockId = firstItem
      ? `block-${firstItem.borough}-${firstItem.block}-${blockIndex}`
      : `block-${blockIndex}`;
    const blockCenter = blockBounds.getCenter();
    const blockGroup = new THREE.Group();
    blockGroup.name = blockId;

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

      let itemRecord: EnvelopeSceneItem | null = null;

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

        itemRecord = {
          id: item.id,
          bbl: item.bbl,
          blockId,
          blockGroup,
          group: itemGroup,
          faceMesh: mesh,
          depthMesh,
          hiddenLines: null,
          visibleLines: null,
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

        if (itemRecord) {
          itemRecord.hiddenLines = hiddenLines;
          itemRecord.visibleLines = visibleLines;
        } else {
          items.push({
            id: item.id,
            bbl: item.bbl,
            blockId,
            blockGroup,
            group: itemGroup,
            faceMesh: null,
            depthMesh: null,
            hiddenLines,
            visibleLines,
          });
        }
      }

      blockGroup.add(itemGroup);
    });

    blocks.push({
      id: blockId,
      bounds: blockBounds,
      center: {
        lng: blockCenter.lng,
        lat: blockCenter.lat,
      },
      group: blockGroup,
    });
    group.add(blockGroup);
  });

  return {
    anchor: sceneAnchor,
    root: group,
    blocks,
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

function getProjectedBlockFootprint(
  map: mapboxgl.Map,
  block: EnvelopeSceneBlock
) {
  const southWest = block.bounds.getSouthWest();
  const northEast = block.bounds.getNorthEast();
  const northWest = { lng: southWest.lng, lat: northEast.lat };
  const southEast = { lng: northEast.lng, lat: southWest.lat };
  const samplePoints = [
    southWest,
    southEast,
    northWest,
    northEast,
    block.center,
    { lng: block.center.lng, lat: southWest.lat },
    { lng: block.center.lng, lat: northEast.lat },
    { lng: southWest.lng, lat: block.center.lat },
    { lng: northEast.lng, lat: block.center.lat },
  ].map((point) => map.project(point));

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  samplePoints.forEach((point) => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  });

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function doesProjectedFootprintOverlapViewport(
  footprint: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  },
  viewportWidth: number,
  viewportHeight: number
) {
  return !(
    footprint.maxX < -ENVELOPE_VIEWPORT_MARGIN_PX ||
    footprint.minX > viewportWidth + ENVELOPE_VIEWPORT_MARGIN_PX ||
    footprint.maxY < -ENVELOPE_VIEWPORT_MARGIN_PX ||
    footprint.minY > viewportHeight + ENVELOPE_VIEWPORT_MARGIN_PX
  );
}

export function createMercatorSceneLayer(
  id: string,
  envelopeScene: EnvelopeScene
): EnvelopeSceneLayer {
  const camera = new THREE.Camera();
  const scene = new THREE.Scene();
  scene.add(envelopeScene.root);
  let mapInstance: mapboxgl.Map | null = null;
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
  let latestInverseProjectionMatrix: THREE.Matrix4 | null = null;
  let selectedItemId: string | null = null;
  const raycaster = new THREE.Raycaster();
  const rayNearPoint = new THREE.Vector3();
  const rayFarPoint = new THREE.Vector3();
  const rayDirection = new THREE.Vector3();
  const pickTargets = envelopeScene.items
    .map((item) => item.faceMesh)
    .filter((mesh): mesh is THREE.Mesh => mesh !== null);
  const pickTargetLookup = new Map<THREE.Object3D, EnvelopeSceneItem>();

  envelopeScene.items.forEach((item) => {
    if (item.faceMesh) {
      pickTargetLookup.set(item.faceMesh, item);
    }
  });

  function updateBlockVisibility() {
    if (!mapInstance) {
      return false;
    }

    const activeMap = mapInstance;
    const canvas = activeMap.getCanvas();
    const viewportWidth = canvas.clientWidth;
    const viewportHeight = canvas.clientHeight;
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      envelopeScene.blocks.forEach((block) => {
        block.group.visible = false;
      });
      return false;
    }

    let hasVisibleBlocks = false;

    envelopeScene.blocks.forEach((block) => {
      const footprint = getProjectedBlockFootprint(activeMap, block);
      const overlapsViewport = doesProjectedFootprintOverlapViewport(
        footprint,
        viewportWidth,
        viewportHeight
      );
      const footprintSize = Math.max(footprint.width, footprint.height);
      const isVisible =
        overlapsViewport && footprintSize >= ENVELOPE_MIN_BLOCK_FOOTPRINT_PX;
      block.group.visible = isVisible;
      hasVisibleBlocks ||= isVisible;
    });

    return hasVisibleBlocks;
  }

  function setSelectedItem(itemId: string | null) {
    if (selectedItemId === itemId) {
      return;
    }

    selectedItemId = itemId;
    envelopeScene.items.forEach((item) => {
      setEnvelopeItemSelectedState(item, item.id === itemId);
    });
  }

  function pickItemAtScreenPoint(
    x: number,
    y: number,
    viewportWidth: number,
    viewportHeight: number
  ) {
    const hasVisibleBlocks = updateBlockVisibility();
    if (!hasVisibleBlocks) {
      return null;
    }

    if (!latestInverseProjectionMatrix || viewportWidth <= 0 || viewportHeight <= 0) {
      return null;
    }

    envelopeScene.root.updateMatrixWorld(true);

    const normalizedX = (x / viewportWidth) * 2 - 1;
    const normalizedY = -(y / viewportHeight) * 2 + 1;

    rayNearPoint
      .set(normalizedX, normalizedY, -1)
      .applyMatrix4(latestInverseProjectionMatrix);
    rayFarPoint
      .set(normalizedX, normalizedY, 1)
      .applyMatrix4(latestInverseProjectionMatrix);

    rayDirection.copy(rayFarPoint).sub(rayNearPoint).normalize();
    raycaster.ray.origin.copy(rayNearPoint);
    raycaster.ray.direction.copy(rayDirection);

    const visiblePickTargets = pickTargets.filter((mesh) => {
      const item = pickTargetLookup.get(mesh);
      return item?.blockGroup.visible ?? false;
    });

    const intersections = raycaster.intersectObjects(visiblePickTargets, false);
    if (!intersections.length) {
      return null;
    }

    const hitItem = pickTargetLookup.get(intersections[0].object);
    if (!hitItem) {
      return null;
    }

    return {
      id: hitItem.id,
      bbl: hitItem.bbl,
    };
  }

  return {
    id,
    type: 'custom',
    renderingMode: '3d',
    pickItemAtScreenPoint,
    setSelectedItem,
    onAdd: (map, gl) => {
      mapInstance = map;
      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
    },
    render: (_gl, matrix) => {
      if (!renderer || !mapInstance) {
        return;
      }

      if (!updateBlockVisibility()) {
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
      latestInverseProjectionMatrix = camera.projectionMatrix.clone().invert();
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
