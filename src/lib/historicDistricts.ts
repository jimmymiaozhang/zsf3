import {
  type AnyLayer,
  type ExpressionSpecification,
  type GeoJSONSource,
  type Map as MapboxMap,
} from 'mapbox-gl';

const HISTORIC_DISTRICTS_URL =
  "https://data.cityofnewyork.us/resource/skyk-mpzq.geojson?$limit=5000&$where=current_%20=%20'Yes'%20AND%20status_of_%20=%20'DESIGNATED'";

const HISTORIC_DISTRICT_COLORS = [
  '#b45309',
  '#be123c',
  '#7c3aed',
  '#2563eb',
  '#0891b2',
  '#0f766e',
  '#65a30d',
  '#ca8a04',
  '#dc2626',
  '#9333ea',
  '#0284c7',
  '#15803d',
] as const;

export const HISTORIC_DISTRICTS_SOURCE_ID = 'historic-districts';
export const HISTORIC_DISTRICTS_FILL_LAYER_ID = 'historic-districts-fill';
export const HISTORIC_DISTRICTS_LINE_LAYER_ID = 'historic-districts-outline';

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

  throw new Error('Historic districts service did not return valid GeoJSON.');
}

function getHistoricDistrictColor(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return HISTORIC_DISTRICT_COLORS[hash % HISTORIC_DISTRICT_COLORS.length];
}

export async function fetchHistoricDistricts() {
  const response = await fetch(HISTORIC_DISTRICTS_URL);
  if (!response.ok) {
    throw new Error(`Unable to load historic districts: ${response.status}`);
  }

  const collection = assertFeatureCollection(await response.json());

  return {
    type: 'FeatureCollection',
    features: collection.features
      .filter((feature) => feature.geometry)
      .map((feature) => {
        const properties = feature.properties ?? {};
        const districtName =
          typeof properties.area_name === 'string' && properties.area_name.trim()
            ? properties.area_name.trim()
            : typeof properties.lp_number === 'string'
              ? properties.lp_number
              : 'Historic District';

        return {
          ...feature,
          properties: {
            ...properties,
            HISTORIC_DISTRICT_NAME: districtName,
            HISTORIC_DISTRICT_COLOR: getHistoricDistrictColor(districtName),
          },
        };
      }),
  } as GeoJSON.FeatureCollection;
}

function getHistoricDistrictColorExpression(): ExpressionSpecification {
  return ['coalesce', ['get', 'HISTORIC_DISTRICT_COLOR'], '#6b7280'];
}

export function addHistoricDistrictLayers(
  map: MapboxMap,
  data: GeoJSON.FeatureCollection,
  visible: boolean
) {
  const existingSource = map.getSource(HISTORIC_DISTRICTS_SOURCE_ID) as
    | GeoJSONSource
    | undefined;

  if (existingSource) {
    existingSource.setData(data);
  } else {
    map.addSource(HISTORIC_DISTRICTS_SOURCE_ID, {
      type: 'geojson',
      data,
    });
  }

  const visibility = visible ? 'visible' : 'none';
  const colorExpression = getHistoricDistrictColorExpression();

  if (!map.getLayer(HISTORIC_DISTRICTS_FILL_LAYER_ID)) {
    const fillLayer: AnyLayer = {
      id: HISTORIC_DISTRICTS_FILL_LAYER_ID,
      type: 'fill',
      source: HISTORIC_DISTRICTS_SOURCE_ID,
      slot: 'middle',
      layout: {
        visibility,
      },
      paint: {
        'fill-color': colorExpression,
        'fill-opacity': 0.2,
      },
    };

    map.addLayer(fillLayer);
  }

  if (!map.getLayer(HISTORIC_DISTRICTS_LINE_LAYER_ID)) {
    const lineLayer: AnyLayer = {
      id: HISTORIC_DISTRICTS_LINE_LAYER_ID,
      type: 'line',
      source: HISTORIC_DISTRICTS_SOURCE_ID,
      slot: 'middle',
      layout: {
        visibility,
      },
      paint: {
        'line-color': colorExpression,
        'line-width': 1.2,
        'line-opacity': 0.9,
      },
    };

    map.addLayer(lineLayer);
  }

  setHistoricDistrictVisibility(map, visible);
}

export function setHistoricDistrictVisibility(
  map: MapboxMap,
  visible: boolean
) {
  const visibility = visible ? 'visible' : 'none';

  [HISTORIC_DISTRICTS_FILL_LAYER_ID, HISTORIC_DISTRICTS_LINE_LAYER_ID].forEach(
    (layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visibility);
      }
    }
  );
}
