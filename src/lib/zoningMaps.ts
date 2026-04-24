import {
  type AnyLayer,
  type ExpressionSpecification,
  type GeoJSONSource,
  type Map as MapboxMap,
} from 'mapbox-gl';

const ZONING_SERVICE_URL =
  'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/nyzd/FeatureServer/0/query';
const PAGE_SIZE = 2000;

export const ZONING_SOURCE_ID = 'zoning-districts';
export const ZONING_FILL_LAYER_ID = 'zoning-fill';
export const ZONING_LINE_LAYER_ID = 'zoning-outline';

function assertFeatureCollection(data: unknown): GeoJSON.FeatureCollection {
  if (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === 'FeatureCollection' &&
    'features' in data &&
    Array.isArray(data.features)
  ) {
    return data as GeoJSON.FeatureCollection;
  }

  throw new Error('Zoning service did not return valid GeoJSON.');
}

async function fetchAllGeoJsonPages(
  baseUrl: string,
  params: Record<string, string>
): Promise<GeoJSON.FeatureCollection> {
  const features: GeoJSON.Feature[] = [];
  let offset = 0;
  let hasMorePages = true;

  while (hasMorePages) {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
    url.searchParams.set('resultOffset', String(offset));
    url.searchParams.set('resultRecordCount', String(PAGE_SIZE));
    url.searchParams.set('f', 'geojson');

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`Unable to load zoning polygons: ${response.status}`);
    }

    const page = assertFeatureCollection(await response.json());
    features.push(...page.features);

    hasMorePages = page.features.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

export async function fetchZoningDistricts() {
  return fetchAllGeoJsonPages(ZONING_SERVICE_URL, {
    where: '1=1',
    outFields: 'ZONEDIST',
    returnGeometry: 'true',
    outSR: '4326',
  });
}

function getZoningColorExpression(): ExpressionSpecification {
  return [
    'match',
    ['upcase', ['slice', ['coalesce', ['get', 'ZONEDIST'], ''], 0, 1]],
    'R',
    '#f59e0b',
    'C',
    '#ef4444',
    'M',
    '#a855f7',
    'P',
    '#22c55e',
    'B',
    '#3b82f6',
    '#b4b4b4',
  ] as ExpressionSpecification;
}

export function addZoningLayers(
  map: MapboxMap,
  data: GeoJSON.FeatureCollection,
  visible: boolean
) {
  const existingSource = map.getSource(ZONING_SOURCE_ID) as
    | GeoJSONSource
    | undefined;

  if (existingSource) {
    existingSource.setData(data);
  } else {
    map.addSource(ZONING_SOURCE_ID, {
      type: 'geojson',
      data,
    });
  }

  const visibility = visible ? 'visible' : 'none';
  const colorExpression = getZoningColorExpression();

  if (!map.getLayer(ZONING_FILL_LAYER_ID)) {
    const fillLayer: AnyLayer = {
      id: ZONING_FILL_LAYER_ID,
      type: 'fill',
      source: ZONING_SOURCE_ID,
      slot: 'middle',
      layout: {
        visibility,
      },
      paint: {
        'fill-color': colorExpression,
        'fill-opacity': 0.14,
      },
    };

    map.addLayer(fillLayer);
  }

  if (!map.getLayer(ZONING_LINE_LAYER_ID)) {
    const lineLayer: AnyLayer = {
      id: ZONING_LINE_LAYER_ID,
      type: 'line',
      source: ZONING_SOURCE_ID,
      slot: 'middle',
      layout: {
        visibility,
      },
      paint: {
        'line-color': colorExpression,
        'line-width': 1,
        'line-opacity': 0.7,
      },
    };

    map.addLayer(lineLayer);
  }

  setZoningVisibility(map, visible);
}

export function setZoningVisibility(map: MapboxMap, visible: boolean) {
  const visibility = visible ? 'visible' : 'none';

  [ZONING_FILL_LAYER_ID, ZONING_LINE_LAYER_ID].forEach((layerId) => {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  });
}
