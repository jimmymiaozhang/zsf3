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

const SAMPLE_ENVELOPE_PATH =
  '/data/test_one_sample/3026790056_automatically_gpt_4o_mini_envelope.json';
const DEFAULT_BEARING = 18;
const DEFAULT_PITCH = 68;

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
        const response = await fetch(SAMPLE_ENVELOPE_PATH);
        if (!response.ok) {
          throw new Error(`Unable to load sample JSON: ${response.status}`);
        }

        const collection =
          (await response.json()) as ZoningEnvelopeCollection;
        if (!collection.items.length) {
          throw new Error('Sample JSON does not contain any envelope items.');
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
          error instanceof Error ? error.message : 'Failed to load sample JSON.';
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
          <h1>Sample envelope failed to load</h1>
          <p>{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div ref={mapContainerRef} className="map-container" />

      <div className="panel">
        <h1>zsf3 sample envelope</h1>
        <p>
          This view loads the sample envelope JSON from `public/data` into a raw
          `three.js` custom layer.
        </p>
        <p>
          Current dataset: {itemCount} item, BBL {activeBbl ?? 'loading...'}.
        </p>
        <button type="button" onClick={handleReset}>
          Reset view
        </button>
      </div>
    </div>
  );
}

export default App;
