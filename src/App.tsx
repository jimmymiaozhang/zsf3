import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import './App.css';
import {
  buildEnvelopeSceneGroup,
  createMercatorSceneLayer,
  disposeThreeObject,
  getEnvelopeCollectionBounds,
  type ZoningEnvelopeCollection,
} from './lib/zoningEnvelope';

type BlockIndex = {
  blocks: string[];
};

const DATASET_FOLDER_PATH = '/data/test_multiple_blocks';
const BLOCK_INDEX_PATH = `${DATASET_FOLDER_PATH}/index.json`;
const DEFAULT_BEARING = 18;
const DEFAULT_PITCH = 68;

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

function App() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const dataBoundsRef = useRef<mapboxgl.LngLatBounds | null>(null);
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN?.trim();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [itemCount, setItemCount] = useState(0);
  const [activeBbl, setActiveBbl] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || !token) {
      return;
    }

    let isCancelled = false;
    let map: mapboxgl.Map | null = null;
    let envelopeRoot: ReturnType<typeof buildEnvelopeSceneGroup> | null = null;

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
        envelopeRoot = buildEnvelopeSceneGroup(collection);

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

        const envelopeLayer = createMercatorSceneLayer(
          'sample-envelope-layer',
          envelopeRoot.root,
          envelopeRoot.anchor
        );

        map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        map.on('style.load', () => {
          map?.setConfigProperty(
            'basemap',
            'showPointOfInterestLabels',
            false
          );
          map?.setConfigProperty('basemap', 'showTransitLabels', false);
          map?.setConfigProperty('basemap', 'showLandmarkIconLabels', false);
          map?.setConfigProperty('basemap', 'showRoadLabels', true);
          map?.setConfigProperty('basemap', 'showPlaceLabels', true);

          if (map && !map.getLayer('sample-envelope-layer')) {
            map.addLayer(envelopeLayer);
          }
        });

        map.on('load', () => {
          if (map && dataBoundsRef.current) {
            fitMapToBounds(map, dataBoundsRef.current, 0);
          }
        });

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
      map?.remove();
      if (envelopeRoot) {
        disposeThreeObject(envelopeRoot.root);
      }
      mapRef.current = null;
      dataBoundsRef.current = null;
    };
  }, [token]);

  const handleReset = () => {
    if (mapRef.current && dataBoundsRef.current) {
      fitMapToBounds(mapRef.current, dataBoundsRef.current, 1200);
    }
  };

  if (!token) {
    return (
      <div className="app-shell">
        <div className="panel">
          <h1>`zsf3` needs a Mapbox token</h1>
          <p>
            Create a `.env` file in `zsf3` and add:
            <code>VITE_MAPBOX_ACCESS_TOKEN=your_public_token_here</code>
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="app-shell">
        <div className="panel">
          <h1>Envelope data failed to load</h1>
          <p>{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div ref={mapContainerRef} className="map-container" />

      <div className="panel">
        <h1>zsf3 block envelopes</h1>
        <p>
          This view loads block envelope files from `public/data` through a
          manifest JSON and merges them into one `three.js` custom layer.
        </p>
        <p>
          Current dataset folder: {DATASET_FOLDER_PATH}.
        </p>
        <p>
          Current dataset: {itemCount} items, first BBL{' '}
          {activeBbl ?? 'loading...'}.
        </p>
        <button type="button" onClick={handleReset}>
          Reset view
        </button>
      </div>
    </div>
  );
}

export default App;
