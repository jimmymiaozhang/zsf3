import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import mapboxgl from 'mapbox-gl';
import type { MapDataStatus, MapLayerVisibilityState } from '../App';
import {
  getBasemapStylePreset,
  type BasemapStyleId,
} from '../lib/basemapStyles';
import {
  addHistoricDistrictLayers,
  fetchHistoricDistricts,
  setHistoricDistrictVisibility,
} from '../lib/historicDistricts';
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
import type {
  DatasetIndex,
  LotRequirementsIndex,
  LotSelectionState,
  LotZoningRequirements,
} from '../lib/lotZoningRequirements';

type MapAreaProps = {
  leftSidebarVisible: boolean;
  rightSidebarVisible: boolean;
  mapLayers: MapLayerVisibilityState;
  basemapStyle: BasemapStyleId;
  onLotSelectionChange: (next: LotSelectionState) => void;
  onMapDataStatusChange: (next: MapDataStatus) => void;
  onToggleLeft: () => void;
  onToggleRight: () => void;
};

const DATASET_FOLDER_PATH = '/data/test_multiple_blocks';
const BLOCK_INDEX_PATH = `${DATASET_FOLDER_PATH}/index.json`;
const DEFAULT_BEARING = 0;
const DEFAULT_PITCH = 68;
const LEFT_SIDEBAR_WIDTH = 320;
const RIGHT_SIDEBAR_WIDTH = 480;

function supportsStandardBasemapConfig(basemapStyle: BasemapStyleId) {
  return getBasemapStylePreset(basemapStyle).mode === 'standard';
}

function applyBasemapLayerVisibility(
  map: mapboxgl.Map,
  mapLayers: MapLayerVisibilityState,
  basemapStyle: BasemapStyleId
) {
  if (!supportsStandardBasemapConfig(basemapStyle)) {
    return;
  }

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

function applyBasemapStylePreset(
  map: mapboxgl.Map,
  basemapStyle: BasemapStyleId
) {
  const preset = getBasemapStylePreset(basemapStyle);
  if (preset.mode === 'standard' && preset.theme) {
    map.setConfigProperty('basemap', 'theme', preset.theme);
  }
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
  basemapStyle,
  onLotSelectionChange,
  onMapDataStatusChange,
  onToggleLeft,
  onToggleRight,
}: MapAreaProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const dataBoundsRef = useRef<mapboxgl.LngLatBounds | null>(null);
  const mapLayersRef = useRef(mapLayers);
  const basemapStyleRef = useRef(basemapStyle);
  const previousBasemapStyleRef = useRef(basemapStyle);
  const historicDistrictsDataRef = useRef<GeoJSON.FeatureCollection | null>(null);
  const envelopeLayerRef = useRef<EnvelopeSceneLayer | null>(null);
  const loadHistoricDistrictsRef = useRef<(() => Promise<void>) | null>(null);
  const loadLotRequirementsForBblRef = useRef<((bbl: string) => Promise<void>) | null>(
    null
  );
  const lotRequirementsIndexRef = useRef<LotRequirementsIndex>({});
  const lotRequirementsCacheRef = useRef<Record<string, LotZoningRequirements>>({});
  const lotSelectionRequestRef = useRef(0);
  const searchRequestRef = useRef(0);
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [zoningLoadError, setZoningLoadError] = useState<string | null>(null);
  const [itemCount, setItemCount] = useState(0);
  const [envelopeDataLoading, setEnvelopeDataLoading] = useState(true);
  const [zoningDataLoading, setZoningDataLoading] = useState(true);
  const [mapBearing, setMapBearing] = useState(DEFAULT_BEARING);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const floatingControlsOffset =
    ((leftSidebarVisible ? LEFT_SIDEBAR_WIDTH : 0) -
      (rightSidebarVisible ? RIGHT_SIDEBAR_WIDTH : 0)) /
    2;

  const clearSelectedLot = useCallback(() => {
    envelopeLayerRef.current?.setSelectedItem(null);
    onLotSelectionChange({
      activeBbl: null,
      lotRequirements: null,
      lotRequirementsLoading: false,
      lotRequirementsError: null,
    });
  }, [onLotSelectionChange]);

  useEffect(() => {
    mapRef.current?.resize();
  }, [leftSidebarVisible, rightSidebarVisible]);

  useEffect(() => {
    mapLayersRef.current = mapLayers;

    if (mapRef.current?.isStyleLoaded()) {
      applyBasemapLayerVisibility(
        mapRef.current,
        mapLayers,
        basemapStyleRef.current
      );
      setZoningVisibility(mapRef.current, mapLayers.zoningMap);
      if (mapLayers.historicDistricts) {
        void loadHistoricDistrictsRef.current?.();
      } else {
        setHistoricDistrictVisibility(mapRef.current, false);
      }
    }

    envelopeLayerRef.current?.setVisible(mapLayers.zoningEnvelopes);
  }, [mapLayers]);

  useEffect(() => {
    basemapStyleRef.current = basemapStyle;

    if (mapRef.current?.isStyleLoaded()) {
      const nextPreset = getBasemapStylePreset(basemapStyle);
      const previousPreset = getBasemapStylePreset(previousBasemapStyleRef.current);

      if (
        nextPreset.mode === 'standard' &&
        previousPreset.mode === 'standard' &&
        nextPreset.styleUrl === previousPreset.styleUrl
      ) {
        applyBasemapStylePreset(mapRef.current, basemapStyle);
        applyBasemapLayerVisibility(mapRef.current, mapLayersRef.current, basemapStyle);
      } else {
        mapRef.current.setStyle(nextPreset.styleUrl);
      }
    }

    previousBasemapStyleRef.current = basemapStyle;
  }, [basemapStyle]);

  useEffect(() => {
    onMapDataStatusChange({
      itemCount,
      zoningLoadError,
      isDataLoading: envelopeDataLoading || zoningDataLoading,
    });
  }, [
    itemCount,
    zoningLoadError,
    envelopeDataLoading,
    zoningDataLoading,
    onMapDataStatusChange,
  ]);

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
        setEnvelopeDataLoading(true);
        setZoningDataLoading(true);
        const blockIndex = await fetchJson<DatasetIndex>(BLOCK_INDEX_PATH);
        if (!blockIndex.blocks.length) {
          throw new Error('Block index does not list any envelope files.');
        }
        lotRequirementsIndexRef.current = blockIndex.lotZoningRequirements ?? {};

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
        setEnvelopeDataLoading(false);

        const bounds = getEnvelopeCollectionBounds(collection);
        dataBoundsRef.current = bounds;
        envelopeRoot = buildEnvelopeSceneGroup(collections);
        const loadLotRequirementsForBbl = async (bbl: string) => {
          const requestId = ++lotSelectionRequestRef.current;
          const cached = lotRequirementsCacheRef.current[bbl];
          if (cached) {
            onLotSelectionChange({
              activeBbl: bbl,
              lotRequirements: cached,
              lotRequirementsLoading: false,
              lotRequirementsError: null,
            });
            return;
          }

          const requirementsPath = lotRequirementsIndexRef.current[bbl];
          if (!requirementsPath) {
            onLotSelectionChange({
              activeBbl: bbl,
              lotRequirements: null,
              lotRequirementsLoading: false,
              lotRequirementsError: 'No zoning requirements file found for this lot.',
            });
            return;
          }

          onLotSelectionChange({
            activeBbl: bbl,
            lotRequirements: null,
            lotRequirementsLoading: true,
            lotRequirementsError: null,
          });

          try {
            const lotRequirements = await fetchJson<LotZoningRequirements>(
              requirementsPath
            );
            if (isCancelled || requestId !== lotSelectionRequestRef.current) {
              return;
            }

            lotRequirementsCacheRef.current[bbl] = lotRequirements;
            onLotSelectionChange({
              activeBbl: bbl,
              lotRequirements,
              lotRequirementsLoading: false,
              lotRequirementsError: null,
            });
          } catch (error) {
            if (isCancelled || requestId !== lotSelectionRequestRef.current) {
              return;
            }

            onLotSelectionChange({
              activeBbl: bbl,
              lotRequirements: null,
              lotRequirementsLoading: false,
              lotRequirementsError:
                error instanceof Error
                  ? error.message
                  : 'Failed to load zoning requirements.',
            });
          }
        };
        loadLotRequirementsForBblRef.current = loadLotRequirementsForBbl;

        mapboxgl.accessToken = token;

        const initialBasemapPreset = getBasemapStylePreset(
          basemapStyleRef.current
        );

        map = new mapboxgl.Map({
          container: mapContainerRef.current as HTMLDivElement,
          style: initialBasemapPreset.styleUrl,
          config:
            initialBasemapPreset.mode === 'standard' && initialBasemapPreset.theme
              ? {
                  basemap: {
                    theme: initialBasemapPreset.theme,
                  },
                }
              : undefined,
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

        const syncHistoricDistrictsWithMap = async () => {
          if (!map) {
            return;
          }

          if (historicDistrictsDataRef.current) {
            addHistoricDistrictLayers(
              map,
              historicDistrictsDataRef.current,
              mapLayersRef.current.historicDistricts
            );
            return;
          }

          if (!mapLayersRef.current.historicDistricts) {
            setHistoricDistrictVisibility(map, false);
            return;
          }

          const historicDistrictsData = await fetchHistoricDistricts();
          if (isCancelled || !map) {
            return;
          }

          historicDistrictsDataRef.current = historicDistrictsData;
          addHistoricDistrictLayers(
            map,
            historicDistrictsData,
            mapLayersRef.current.historicDistricts
          );
        };
        loadHistoricDistrictsRef.current = syncHistoricDistrictsWithMap;

        map.on('style.load', () => {
          const syncLayersWithStyle = async () => {
            if (!map) {
              return;
            }

            try {
              setZoningDataLoading(true);
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
              setZoningDataLoading(false);
            } catch (error) {
              if (!isCancelled) {
                setZoningLoadError(
                  error instanceof Error
                    ? error.message
                    : 'Failed to load zoning overlay.'
                );
                setZoningDataLoading(false);
              }
            }

            try {
              await syncHistoricDistrictsWithMap();
            } catch (error) {
              if (!isCancelled) {
                console.error('Failed to load historic districts overlay.', error);
              }
            }

            if (map && !map.getLayer('sample-envelope-layer')) {
              map.addLayer(envelopeLayer);
            }
          };

          if (map) {
            applyBasemapStylePreset(map, basemapStyleRef.current);
            applyBasemapLayerVisibility(
              map,
              mapLayersRef.current,
              basemapStyleRef.current
            );
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
          if (!pickedEnvelope?.bbl) {
            clearSelectedLot();
            return;
          }

          void loadLotRequirementsForBbl(pickedEnvelope.bbl);
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
        setEnvelopeDataLoading(false);
        setZoningDataLoading(false);
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
      historicDistrictsDataRef.current = null;
      loadHistoricDistrictsRef.current = null;
      loadLotRequirementsForBblRef.current = null;
      envelopeLayerRef.current = null;
      mapRef.current = null;
      dataBoundsRef.current = null;
    };
  }, [token, onLotSelectionChange, clearSelectedLot]);

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

  const handleSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const query = searchQuery.trim();
    if (!query) {
      setSearchError('Enter an address to search.');
      return;
    }

    if (!mapRef.current) {
      setSearchError('Map is not ready yet.');
      return;
    }

    setSearching(true);
    setSearchError(null);
    const searchRequestId = ++searchRequestRef.current;

    try {
      const center = mapRef.current.getCenter();
      const url = new URL(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query
        )}.json`
      );
      url.searchParams.set('access_token', token);
      url.searchParams.set('autocomplete', 'true');
      url.searchParams.set('limit', '1');
      url.searchParams.set('proximity', `${center.lng},${center.lat}`);
      url.searchParams.set('bbox', '-74.30,40.45,-73.65,40.95');

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Search failed with HTTP ${response.status}`);
      }

      const data = (await response.json()) as {
        features?: Array<{ center?: [number, number] }>;
      };
      const feature = data.features?.[0];
      const nextCenter = feature?.center;

      if (!nextCenter) {
        setSearchError('No matching address found.');
        return;
      }

      mapRef.current.easeTo({
        center: nextCenter,
        zoom: Math.max(mapRef.current.getZoom(), 17),
        duration: 900,
      });

      mapRef.current.once('moveend', () => {
        if (searchRequestId !== searchRequestRef.current) {
          return;
        }

        const activeMap = mapRef.current;
        const envelopeLayer = envelopeLayerRef.current;
        const loadLotRequirementsForBbl = loadLotRequirementsForBblRef.current;
        if (!activeMap || !envelopeLayer || !loadLotRequirementsForBbl) {
          return;
        }

        const projectedPoint = activeMap.project({
          lng: nextCenter[0],
          lat: nextCenter[1],
        });
        const pickedEnvelope = envelopeLayer.pickItemAtScreenPoint(
          projectedPoint.x,
          projectedPoint.y,
          activeMap.getCanvas().clientWidth,
          activeMap.getCanvas().clientHeight
        );

        envelopeLayer.setSelectedItem(pickedEnvelope?.id ?? null);
        if (!pickedEnvelope?.bbl) {
          clearSelectedLot();
          return;
        }

        void loadLotRequirementsForBbl(pickedEnvelope.bbl);
      });
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : 'Address search failed.'
      );
    } finally {
      setSearching(false);
    }
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

        <div
          className="map-floating-controls"
          style={{ left: `calc(50% + ${floatingControlsOffset}px)` }}
        >
          <form className="map-search" onSubmit={handleSearchSubmit}>
            <input
              ref={searchInputRef}
              className="map-search__input"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search address"
              aria-label="Search address"
            />
            <button
              className={`map-search__clear ${searchQuery ? '' : 'map-search__clear--hidden'}`.trim()}
              type="button"
              aria-label="Clear search"
              title="Clear search"
              aria-hidden={!searchQuery}
              tabIndex={searchQuery ? 0 : -1}
              onClick={() => {
                setSearchQuery('');
                setSearchError(null);
                searchInputRef.current?.focus();
              }}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path d="M6 6L14 14" />
                <path d="M14 6L6 14" />
              </svg>
            </button>
            <button
              className="map-search__button"
              type="submit"
              aria-label="Search address"
              title="Search address"
              disabled={searching}
            >
              <svg
                className="map-search__icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M10.25 4.25A6 6 0 1 1 6 6a6 6 0 0 1 4.25-1.75Z" />
                <path d="M14.75 14.75L20 20" />
              </svg>
            </button>
          </form>
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

        {envelopeDataLoading || zoningDataLoading ? (
          <div className="map-loading-overlay" aria-live="polite">
            Data Loading...
          </div>
        ) : null}
        {searchError ? (
          <div className="map-overlay map-overlay--search-error">
            <p>Search: {searchError}</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default MapArea;
