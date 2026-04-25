import {
  type AnyLayer,
  type ExpressionSpecification,
  type GeoJSONSource,
  type Map as MapboxMap,
} from 'mapbox-gl';

const FLOOD_RESILIENCY_QUERY_URL =
  'https://services.arcgis.com/g8EzU2gNHvGpFUGY/ArcGIS/rest/services/New_York_City_Map_WFL1/FeatureServer/2/query';
const PAGE_SIZE = 2000;

export const FLOOD_RESILIENCY_SOURCE_ID = 'flood-resiliency';
export const FLOOD_RESILIENCY_FILL_LAYER_ID = 'flood-resiliency-fill';
export const FLOOD_RESILIENCY_LINE_LAYER_ID = 'flood-resiliency-outline';

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

  throw new Error('Flood resiliency service did not return valid GeoJSON.');
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
      throw new Error(`Unable to load flood resiliency polygons: ${response.status}`);
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

function getFloodCategoryLabel(value: unknown) {
  const normalizedValue = String(value ?? '').trim();
  if (normalizedValue === '1') {
    return 'Nuisance Flooding';
  }
  if (normalizedValue === '2') {
    return 'Deep and Contiguous Flooding';
  }
  if (normalizedValue === '3') {
    return 'Future High Tides 2050';
  }
  return 'Flood / Resiliency';
}

function getFloodCategoryColor(value: unknown) {
  const normalizedValue = String(value ?? '').trim();
  if (normalizedValue === '1') {
    return '#00a9e6';
  }
  if (normalizedValue === '2') {
    return '#005ce6';
  }
  if (normalizedValue === '3') {
    return '#ffaa00';
  }
  return '#6b7280';
}

export async function fetchFloodResiliencyOverlay() {
  const collection = await fetchAllGeoJsonPages(FLOOD_RESILIENCY_QUERY_URL, {
    where: '1=1',
    outFields: 'Flooding_Category',
    returnGeometry: 'true',
    outSR: '4326',
  });

  return {
    type: 'FeatureCollection',
    features: collection.features
      .filter((feature) => feature.geometry)
      .map((feature) => {
        const properties = feature.properties ?? {};
        const floodingCategory = properties.Flooding_Category;

        return {
          ...feature,
          properties: {
            ...properties,
            FLOOD_RESILIENCY_NAME: getFloodCategoryLabel(floodingCategory),
            FLOOD_RESILIENCY_COLOR: getFloodCategoryColor(floodingCategory),
          },
        };
      }),
  } as GeoJSON.FeatureCollection;
}

function getFloodResiliencyColorExpression(): ExpressionSpecification {
  return ['coalesce', ['get', 'FLOOD_RESILIENCY_COLOR'], '#6b7280'];
}

export function addFloodResiliencyLayers(
  map: MapboxMap,
  data: GeoJSON.FeatureCollection,
  visible: boolean
) {
  const existingSource = map.getSource(FLOOD_RESILIENCY_SOURCE_ID) as
    | GeoJSONSource
    | undefined;

  if (existingSource) {
    existingSource.setData(data);
  } else {
    map.addSource(FLOOD_RESILIENCY_SOURCE_ID, {
      type: 'geojson',
      data,
    });
  }

  const visibility = visible ? 'visible' : 'none';
  const colorExpression = getFloodResiliencyColorExpression();

  if (!map.getLayer(FLOOD_RESILIENCY_FILL_LAYER_ID)) {
    const fillLayer: AnyLayer = {
      id: FLOOD_RESILIENCY_FILL_LAYER_ID,
      type: 'fill',
      source: FLOOD_RESILIENCY_SOURCE_ID,
      slot: 'middle',
      layout: {
        visibility,
      },
      paint: {
        'fill-color': colorExpression,
        'fill-opacity': 0.18,
      },
    };

    map.addLayer(fillLayer);
  }

  if (!map.getLayer(FLOOD_RESILIENCY_LINE_LAYER_ID)) {
    const lineLayer: AnyLayer = {
      id: FLOOD_RESILIENCY_LINE_LAYER_ID,
      type: 'line',
      source: FLOOD_RESILIENCY_SOURCE_ID,
      slot: 'middle',
      layout: {
        visibility,
      },
      paint: {
        'line-color': colorExpression,
        'line-width': 1.1,
        'line-opacity': 0.8,
      },
    };

    map.addLayer(lineLayer);
  }

  setFloodResiliencyVisibility(map, visible);
}

export function setFloodResiliencyVisibility(map: MapboxMap, visible: boolean) {
  const visibility = visible ? 'visible' : 'none';

  [FLOOD_RESILIENCY_FILL_LAYER_ID, FLOOD_RESILIENCY_LINE_LAYER_ID].forEach(
    (layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility);
      }
    }
  );
}
