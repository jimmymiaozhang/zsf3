export type BasemapStyleId =
  | 'monochrome'
  | 'faded'
  | 'light'
  | 'dark'
  | 'satellite';

export type BasemapStylePreset = {
  id: BasemapStyleId;
  name: string;
  mode: 'standard' | 'classic';
  styleUrl: string;
  theme?: 'default' | 'monochrome' | 'faded';
};

export const BASEMAP_STYLE_PRESETS: BasemapStylePreset[] = [
  {
    id: 'monochrome',
    name: 'Monochrome',
    mode: 'standard',
    styleUrl: 'mapbox://styles/mapbox/standard',
    theme: 'monochrome',
  },
  {
    id: 'faded',
    name: 'Faded',
    mode: 'standard',
    styleUrl: 'mapbox://styles/mapbox/standard',
    theme: 'faded',
  },
  {
    id: 'light',
    name: 'Light',
    mode: 'classic',
    styleUrl: 'mapbox://styles/mapbox/light-v11',
  },
  {
    id: 'dark',
    name: 'Dark',
    mode: 'classic',
    styleUrl: 'mapbox://styles/mapbox/dark-v11',
  },
  {
    id: 'satellite',
    name: 'Satellite',
    mode: 'classic',
    styleUrl: 'mapbox://styles/mapbox/satellite-v9',
  },
];

export function getBasemapStylePreset(styleId: BasemapStyleId) {
  return (
    BASEMAP_STYLE_PRESETS.find((preset) => preset.id === styleId) ??
    BASEMAP_STYLE_PRESETS[0]
  );
}
