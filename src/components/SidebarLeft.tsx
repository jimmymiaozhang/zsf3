import { useState } from 'react';
import type { MapLayerId, MapLayerVisibilityState } from '../App';
import {
  BASEMAP_STYLE_PRESETS,
  getBasemapStylePreset,
  type BasemapStyleId,
} from '../lib/basemapStyles';

type SidebarLeftProps = {
  isVisible: boolean;
  mapLayers: MapLayerVisibilityState;
  basemapStyle: BasemapStyleId;
  datasetFolder: string;
  itemCount: number;
  activeBbl: string | null;
  zoningLoadError: string | null;
  onSelectBasemapStyle: (styleId: BasemapStyleId) => void;
  onToggleLayer: (layerId: MapLayerId) => void;
  onHide: () => void;
};

const layerRows: Array<{ id: MapLayerId; name: string }> = [
  { id: 'zoningMap', name: 'Zoning Map' },
  { id: 'zoningEnvelopes', name: 'Zoning Envelopes' },
  { id: 'placeLabels', name: 'Place Labels' },
  { id: 'roadLabels', name: 'Road Labels' },
  { id: 'transitLabels', name: 'Transit Labels' },
  { id: 'poiLabels', name: 'Point of Interest Labels' },
  { id: 'show3dObjects', name: '3D Buildings / Objects' },
];

const classicStyleDisabledLayerIds: MapLayerId[] = [
  'placeLabels',
  'roadLabels',
  'transitLabels',
  'poiLabels',
  'show3dObjects',
];

function SidebarLeft({
  isVisible,
  mapLayers,
  basemapStyle,
  datasetFolder,
  itemCount,
  activeBbl,
  zoningLoadError,
  onSelectBasemapStyle,
  onToggleLayer,
  onHide,
}: SidebarLeftProps) {
  const [activeTab, setActiveTab] = useState<'layers' | 'styles' | 'data'>('layers');
  const activeBasemapPreset = getBasemapStylePreset(basemapStyle);

  return (
    <aside
      className={`sidebar sidebar-left ${isVisible ? 'open' : 'closed'}`}
      aria-hidden={!isVisible}
    >
      {isVisible ? (
        <button
          className="sidebar-handle sidebar-handle--left"
          type="button"
          onClick={onHide}
          aria-label="Hide left sidebar"
          title="Hide left sidebar"
        >
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M11 4L7 9L11 14" />
          </svg>
        </button>
      ) : null}
      <div className="sidebar-inner">
        <div className="sidebar-toolbar">
          <button
            className={activeTab === 'layers' ? 'active' : ''}
            type="button"
            onClick={() => setActiveTab('layers')}
          >
            Layers
          </button>
          <button
            className={activeTab === 'styles' ? 'active' : ''}
            type="button"
            onClick={() => setActiveTab('styles')}
          >
            Styles
          </button>
          <button
            className={activeTab === 'data' ? 'active' : ''}
            type="button"
            onClick={() => setActiveTab('data')}
          >
            Data
          </button>
        </div>

        <div className="sidebar-content">
          {activeTab === 'layers' ? (
            <section className="sidebar-section">
              <h3>Map Layers</h3>
              <p className="muted">
                Core zoning-envelope overlays and base-map label settings for the
                current workspace.
              </p>
              <ul className="sidebar-list">
                {layerRows.map((layer) => {
                  const isClassicStyleRestricted =
                    activeBasemapPreset.mode === 'classic' &&
                    classicStyleDisabledLayerIds.includes(layer.id);
                  const isLayerOn = isClassicStyleRestricted
                    ? false
                    : mapLayers[layer.id];

                  return (
                    <li
                      key={layer.name}
                      className={`sidebar-row ${
                        isClassicStyleRestricted ? 'sidebar-row--disabled' : ''
                      }`.trim()}
                    >
                      <span>{layer.name}</span>
                      <button
                        className={`layer-switch ${
                          isLayerOn ? 'is-on' : 'is-off'
                        } ${isClassicStyleRestricted ? 'is-disabled' : ''}`.trim()}
                        disabled={isClassicStyleRestricted}
                        type="button"
                        onClick={() => {
                          if (!isClassicStyleRestricted) {
                            onToggleLayer(layer.id);
                          }
                        }}
                        aria-disabled={isClassicStyleRestricted}
                        aria-pressed={isLayerOn}
                        aria-label={`${layer.name} ${
                          isClassicStyleRestricted
                            ? 'unavailable for this style'
                            : isLayerOn
                              ? 'on'
                              : 'off'
                        }`}
                        title={
                          isClassicStyleRestricted
                            ? 'Unavailable for the current basemap style'
                            : undefined
                        }
                      >
                        <span className="layer-switch__thumb" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {activeTab === 'styles' ? (
            <section className="sidebar-section">
              <h3>Basemap Styles</h3>
              <p className="muted">
                Choose one basemap preset at a time. Turning one on switches the
                others off automatically. Standard themes preserve the richest
                label and 3D toggle behavior; classic styles are included for
                visual review.
              </p>
              <ul className="sidebar-list">
                {BASEMAP_STYLE_PRESETS.map((style) => (
                  <li key={style.id} className="sidebar-row">
                    <span>{style.name}</span>
                    <button
                      className={`layer-switch ${
                        basemapStyle === style.id ? 'is-on' : 'is-off'
                      }`.trim()}
                      type="button"
                      onClick={() => onSelectBasemapStyle(style.id)}
                      aria-pressed={basemapStyle === style.id}
                      aria-label={`${style.name} ${
                        basemapStyle === style.id ? 'on' : 'off'
                      }`}
                    >
                      <span className="layer-switch__thumb" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {activeTab === 'data' ? (
            <section className="sidebar-section">
              <h3>zsf3 block envelopes</h3>
              <p>Dataset folder: {datasetFolder}</p>
              <p>
                Current dataset: {itemCount} items, selected BBL{' '}
                {activeBbl ?? 'N/A'}.
              </p>
              {zoningLoadError ? (
                <p>Zoning overlay unavailable: {zoningLoadError}</p>
              ) : null}
            </section>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

export default SidebarLeft;
