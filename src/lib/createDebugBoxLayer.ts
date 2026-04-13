import mapboxgl, { type CustomLayerInterface, type Map } from 'mapbox-gl';
import * as THREE from 'three';

export const DEBUG_BOX_ORIGIN: [number, number] = [-73.9721, 40.72145];
export const DEBUG_BOX_ALTITUDE_METERS = 120;

const BOX_WIDTH_METERS = 160;
const BOX_DEPTH_METERS = 160;
const BOX_HEIGHT_METERS = 220;

export function createDebugBoxLayer(map: Map): CustomLayerInterface {
  const modelAsMercatorCoordinate = mapboxgl.MercatorCoordinate.fromLngLat(
    {
      lng: DEBUG_BOX_ORIGIN[0],
      lat: DEBUG_BOX_ORIGIN[1],
    },
    DEBUG_BOX_ALTITUDE_METERS
  );

  const modelTransform = {
    translateX: modelAsMercatorCoordinate.x,
    translateY: modelAsMercatorCoordinate.y,
    translateZ: modelAsMercatorCoordinate.z,
    rotateX: 0,
    rotateY: 0,
    rotateZ: 0,
    scale: modelAsMercatorCoordinate.meterInMercatorCoordinateUnits(),
  };

  const camera = new THREE.Camera();
  const scene = new THREE.Scene();

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
  directionalLight.position.set(100, -120, 180);
  scene.add(directionalLight);

  const root = new THREE.Group();
  scene.add(root);

  const boxMesh = new THREE.Mesh(
    new THREE.BoxGeometry(
      BOX_WIDTH_METERS,
      BOX_DEPTH_METERS,
      BOX_HEIGHT_METERS
    ),
    new THREE.MeshPhongMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0.72,
    })
  );
  boxMesh.position.set(0, 0, BOX_HEIGHT_METERS / 2);
  root.add(boxMesh);

  const boxEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(
      new THREE.BoxGeometry(
        BOX_WIDTH_METERS,
        BOX_DEPTH_METERS,
        BOX_HEIGHT_METERS
      )
    ),
    new THREE.LineBasicMaterial({ color: 0xffffff })
  );
  boxEdges.position.copy(boxMesh.position);
  root.add(boxEdges);

  let renderer: THREE.WebGLRenderer | null = null;

  return {
    id: 'debug-box-layer',
    type: 'custom',
    renderingMode: '3d',
    onAdd: (_map, gl) => {
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

      const rotationX = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(1, 0, 0),
        modelTransform.rotateX
      );
      const rotationY = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(0, 1, 0),
        modelTransform.rotateY
      );
      const rotationZ = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(0, 0, 1),
        modelTransform.rotateZ
      );

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
            -modelTransform.scale,
            modelTransform.scale
          )
        )
        .multiply(rotationX)
        .multiply(rotationY)
        .multiply(rotationZ);

      camera.projectionMatrix = projectionMatrix.multiply(modelMatrix);
      renderer.resetState();
      renderer.render(scene, camera);
      map.triggerRepaint();
    },
  };
}
