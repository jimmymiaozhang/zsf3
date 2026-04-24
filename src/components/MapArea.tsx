import { type ReactNode, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import type { MapLayerVisibilityState } from '../App';
import {
  buildEnvelopeSceneGroup,
  createMercatorSceneLayer,
  disposeThreeObject,
  getEnvelopeCollectionBounds,
  type EnvelopeSceneLayer,
  type ZoningEnvelopeCollection,
} from '../lib/zoningEnvelope';
import {
  addZoningLayers,
  fetchZoningDistricts,
  setZoningVisibility,
} from '../lib/zoningMaps';

type BlockIndex = {
  blocks: string[];
};

type MapAreaProps = {
  leftSidebarVisible: boolean;
  rightSidebarVisible: boolean;
  mapLayers: MapLayerVisibilityState;
  onToggleLeft: () => void;
  onToggleRight: () => void;
};

const DATASET_FOLDER_PATH = '/data/test_multiple_blocks';
const BLOCK_INDEX_PATH = `${DATASET_FOLDER_PATH}/index.json`;
const DEFAULT_BEARING = 0;
const DEFAULT_PITCH = 68;

function applyBasemapLayerVisibility(
  map: mapboxgl.Map,
  mapLayers: MapLayerVisibilityState
) {
  map.setConfigProperty(
    'basemap',
    'showPointOfInterestLabels',
    mapLayers.poiLabels
  );
  map.setConfigProperty('basemap', 'showTransitLabels', mapLayers.transitLabels);
  map.setConfigProperty(
    'basemap',
    'showLandmarkIconLabels',
    mapLayers.landmarkIconLabels
  );
  map.setConfigProperty('basemap', 'showRoadLabels', mapLayers.roadLabels);
  map.setConfigProperty('basemap', 'showPlaceLabels', mapLayers.placeLabels);
  map.setConfigProperty('basemap', 'show3dObjects', mapLayers.show3dObjects);
}

async function fetchJson<T>(path: string) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Unable to load ${path}: ${response.status}`);
  }

  return (await response.json()) as T;
}

function mergeCollections(
  collections: ZoningEnvelopeCollection[]
): ZoningEnvelopeCollection {
  if (!collections.length) {
    throw new Error('Block index does not contain any envelope files.');
  }

  const [firstCollection, ...restCollections] = collections;

  restCollections.forEach((collection) => {
    if (collection.coordinate_system !== firstCollection.coordinate_system) {
      throw new Error(
        `Envelope files use mixed coordinate systems: ${firstCollection.coordinate_system} and ${collection.coordinate_system}.`
      );
    }

    if (collection.units !== firstCollection.units) {
      throw new Error(
        `Envelope files use mixed units: ${firstCollection.units} and ${collection.units}.`
      );
    }
  });

  return {
    version: firstCollection.version,
    coordinate_system: firstCollection.coordinate_system,
    units: firstCollection.units,
    items: collections.flatMap((collection) => collection.items),
  };
}

function fitMapToBounds(
  map: mapboxgl.Map,
  bounds: mapboxgl.LngLatBounds,
  duration: number
) {
  map.fitBounds(bounds, {
    padding: { top: 120, right: 80, bottom: 80, left: 80 },
    maxZoom: 18.5,
    bearing: DEFAULT_BEARING,
    pitch: DEFAULT_PITCH,
    duration,
  });
}

function SidebarToggleButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      className="map-toggle map-toggle--icon"
      type="button"
      onClick={onClick}
      aria-label="Show sidebar"
      title="Show sidebar"
    >
      <svg
        className="map-toggle__icon"
        viewBox="0 0 18 18"
        aria-hidden="true"
      >
        <path d="M4 5H14" className="map-toggle__menu-line" />
        <path d="M4 9H14" className="map-toggle__menu-line" />
        <path d="M4 13H14" className="map-toggle__menu-line" />
      </svg>
    </button>
  );
}

function MapControlButton({
  ariaLabel,
  title,
  onClick,
  children,
  className = '',
}: {
  ariaLabel: string;
  title: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      className={`map-control-button ${className}`.trim()}
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </button>
  );
}

function MapArea({
  leftSidebarVisible,
  rightSidebarVisible,
  mapLayers,
  onToggleLeft,
  onToggleRight,
}: MapAreaProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const dataBoundsRef = useRef<mapboxgl.LngLatBounds | null>(null);
  const mapLayersRef = useRef(mapLayers);
  const envelopeLayerRef = useRef<EnvelopeSceneLayer | null>(null);
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoningLoadError, setZoningLoadError] = useState<string | null>(null);
  const [itemCount, setItemCount] = useState(0);
  const [activeBbl, setActiveBbl] = useState<string | null>(null);
  const [mapBearing, setMapBearing] = useState(DEFAULT_BEARING);

  useEffect(() => {
    mapRef.current?.resize();
  }, [leftSidebarVisible, rightSidebarVisible]);

  useEffect(() => {
    mapLayersRef.current = mapLayers;

    if (mapRef.current?.isStyleLoaded()) {
      applyBasemapLayerVisibility(mapRef.current, mapLayers);
      setZoningVisibility(mapRef.current, mapLayers.zoningMap);
    }

    envelopeLayerRef.current?.setVisible(mapLayers.zoningEnvelopes);
  }, [mapLayers]);

  useEffect(() => {
    if (!mapContainerRef.current || !token) {
      return;
    }

    let isCancelled = false;
    let map: mapboxgl.Map | null = null;
    let envelopeRoot: ReturnType<typeof buildEnvelopeSceneGroup> | null = null;
    let cleanupInteraction: (() => void) | null = null;

    const initialize = async () => {
      try {
        const blockIndex = await fetchJson<BlockIndex>(BLOCK_INDEX_PATH);
        if (!blockIndex.blocks.length) {
          throw new Error('Block index does not list any envelope files.');
        }

        const collections = await Promise.all(
          blockIndex.blocks.map((path) =>
            fetchJson<ZoningEnvelopeCollection>(path)
          )
        );
        const collection = mergeCollections(collections);
        if (!collection.items.length) {
          throw new Error('Loaded envelope files do not contain any items.');
        }

        if (isCancelled) {
          return;
        }

        setLoadError(null);
        setItemCount(collection.items.length);
        setActiveBbl(collection.items[0].bbl);

        const bounds = getEnvelopeCollectionBounds(collection);
        dataBoundsRef.current = bounds;
        envelopeRoot = buildEnvelopeSceneGroup(collections);
        const defaultBbl = collection.items[0].bbl;

        mapboxgl.accessToken = token;

        map = new mapboxgl.Map({
          container: mapContainerRef.current as HTMLDivElement,
          style: 'mapbox://styles/mapbox/standard',
          config: {
            basemap: {
              theme: 'monochrome',
            },
          },
          center: bounds.getCenter(),
          zoom: 16.8,
          pitch: DEFAULT_PITCH,
          bearing: DEFAULT_BEARING,
          antialias: true,
        });

        const envelopeLayer: EnvelopeSceneLayer = createMercatorSceneLayer(
          'sample-envelope-layer',
          envelopeRoot
        );
        envelopeLayer.setVisible(mapLayersRef.current.zoningEnvelopes);
        envelopeLayerRef.current = envelopeLayer;

        map.on('style.load', () => {
          const syncLayersWithStyle = async () => {
            if (!map) {
              return;
            }

            try {
              const zoningData = await fetchZoningDistricts();
              if (isCancelled || !map) {
                return;
              }

              addZoningLayers(
                map,
                zoningData,
                mapLayersRef.current.zoningMap
              );
              setZoningLoadError(null);
            } catch (error) {
              if (!isCancelled) {
                setZoningLoadError(
                  error instanceof Error
                    ? error.message
                    : 'Failed to load zoning overlay.'
                );
              }
            }

            if (map && !map.getLayer('sample-envelope-layer')) {
              map.addLayer(envelopeLayer);
            }
          };

          if (map) {
            applyBasemapLayerVisibility(map, mapLayersRef.current);
          }

          void syncLayersWithStyle();
        });

        map.on('load', () => {
          if (map && dataBoundsRef.current) {
            fitMapToBounds(map, dataBoundsRef.current, 0);
            setMapBearing(map.getBearing());
          }
        });

        const handleMouseMove = (event: mapboxgl.MapMouseEvent) => {
          if (!map) {
            return;
          }

          const hoveredEnvelope = envelopeLayer.pickItemAtScreenPoint(
            event.point.x,
            event.point.y,
            map.getCanvas().clientWidth,
            map.getCanvas().clientHeight
          );

          map.getCanvas().style.cursor = hoveredEnvelope ? 'pointer' : '';
        };

        const handleClick = (event: mapboxgl.MapMouseEvent) => {
          if (!map) {
            return;
          }

          const pickedEnvelope = envelopeLayer.pickItemAtScreenPoint(
            event.point.x,
            event.point.y,
            map.getCanvas().clientWidth,
            map.getCanvas().clientHeight
          );

          envelopeLayer.setSelectedItem(pickedEnvelope?.id ?? null);
          setActiveBbl(pickedEnvelope?.bbl ?? defaultBbl);
        };

        const handleMouseLeave = () => {
          if (!map) {
            return;
          }

          map.getCanvas().style.cursor = '';
        };

        const handleRotate = () => {
          if (!map) {
            return;
          }

          setMapBearing(map.getBearing());
        };

        map.on('mousemove', handleMouseMove);
        map.on('click', handleClick);
        map.on('rotate', handleRotate);
        map.getCanvas().addEventListener('mouseleave', handleMouseLeave);
        cleanupInteraction = () => {
          map?.off('mousemove', handleMouseMove);
          map?.off('click', handleClick);
          map?.off('rotate', handleRotate);
          map?.getCanvas().removeEventListener('mouseleave', handleMouseLeave);
        };

        mapRef.current = map;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load block envelope files.';
        setLoadError(message);
      }
    };

    initialize();

    return () => {
      isCancelled = true;
      cleanupInteraction?.();
      map?.remove();
      if (envelopeRoot) {
        disposeThreeObject(envelopeRoot.root);
      }
      envelopeLayerRef.current = null;
      mapRef.current = null;
      dataBoundsRef.current = null;
    };
  }, [token]);

  const handleReset = () => {
    if (mapRef.current && dataBoundsRef.current) {
      fitMapToBounds(mapRef.current, dataBoundsRef.current, 1200);
    }
  };

  const handleZoomIn = () => {
    mapRef.current?.zoomIn({ duration: 250 });
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut({ duration: 250 });
  };

  const handleResetNorth = () => {
    if (!mapRef.current) {
      return;
    }

    mapRef.current.easeTo({
      bearing: DEFAULT_BEARING,
      duration: 400,
    });
  };

  if (!token) {
    return (
      <main className="map-panel">
        <div className="map-overlay">
          <h2>`zsf3` needs a Mapbox token</h2>
          <p>
            Create a `.env` file in `zsf3` and add
            `VITE_MAPBOX_ACCESS_TOKEN=your_public_token_here`.
          </p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="map-panel">
        <div className="map-overlay">
          <h2>Envelope data failed to load</h2>
          <p>{loadError}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="map-panel">
      <div className="map-stage">
        <div ref={mapContainerRef} className="map-canvas" />

        {!leftSidebarVisible ? (
          <div className="map-map-corner map-map-corner--left">
            <SidebarToggleButton
              onClick={onToggleLeft}
            />
          </div>
        ) : null}

        <div className="map-floating-controls">
          <MapControlButton
            ariaLabel="Reset map view"
            title="Reset view"
            onClick={handleReset}
            className="map-control-button--label"
          >
            Reset View
          </MapControlButton>
          <MapControlButton
            ariaLabel="Zoom in"
            title="Zoom in"
            onClick={handleZoomIn}
            className="map-control-button--icon"
          >
            <svg
              className="map-control-button__glyph"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M10 5V15" />
              <path d="M5 10H15" />
            </svg>
          </MapControlButton>
          <MapControlButton
            ariaLabel="Zoom out"
            title="Zoom out"
            onClick={handleZoomOut}
            className="map-control-button--icon"
          >
            <svg
              className="map-control-button__glyph"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M5 10H15" />
            </svg>
          </MapControlButton>
          <MapControlButton
            ariaLabel="Reset map north"
            title="Reset north"
            onClick={handleResetNorth}
            className="map-control-button--icon map-control-button--compass"
          >
            <svg
              className="map-control-button__compass"
              viewBox="0 0 20 20"
              aria-hidden="true"
              style={{ transform: `rotate(${-mapBearing}deg)` }}
            >
              <path
                className="map-control-button__compass-top"
                d="M10 2.8L13.8 10H6.2L10 2.8Z"
              />
              <path
                className="map-control-button__compass-bottom"
                d="M6.2 10L10 17.2L13.8 10H6.2Z"
              />
            </svg>
          </MapControlButton>
        </div>

        {!rightSidebarVisible ? (
          <div className="map-map-corner map-map-corner--right">
            <SidebarToggleButton
              onClick={onToggleRight}
            />
          </div>
        ) : null}

        <div className="map-overlay map-overlay--info">
          <h2>zsf3 block envelopes</h2>
          <p>Dataset folder: {DATASET_FOLDER_PATH}</p>
          <p>
            Current dataset: {itemCount} items, selected BBL{' '}
            {activeBbl ?? 'loading...'}.
          </p>
          {zoningLoadError ? (
            <p>Zoning overlay unavailable: {zoningLoadError}</p>
          ) : null}
        </div>
      </div>
    </main>
  );
}

export default MapArea;
