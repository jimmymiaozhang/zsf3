import { useState } from 'react';
import type { MapLayerId, MapLayerVisibilityState } from '../App';

type SidebarLeftProps = {
  isVisible: boolean;
  mapLayers: MapLayerVisibilityState;
  datasetFolder: string;
  itemCount: number;
  activeBbl: string | null;
  zoningLoadError: string | null;
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

function SidebarLeft({
  isVisible,
  mapLayers,
  datasetFolder,
  itemCount,
  activeBbl,
  zoningLoadError,
  onToggleLayer,
  onHide,
}: SidebarLeftProps) {
  const [activeTab, setActiveTab] = useState<'layers' | 'filters' | 'data'>('layers');

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
            className={activeTab === 'filters' ? 'active' : ''}
            type="button"
            onClick={() => setActiveTab('filters')}
          >
            Filters
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
                {layerRows.map((layer) => (
                  <li key={layer.name} className="sidebar-row">
                    <span>{layer.name}</span>
                    <button
                      className={`layer-switch ${
                        mapLayers[layer.id] ? 'is-on' : 'is-off'
                      }`.trim()}
                      type="button"
                      onClick={() => onToggleLayer(layer.id)}
                      aria-pressed={mapLayers[layer.id]}
                      aria-label={`${layer.name} ${
                        mapLayers[layer.id] ? 'on' : 'off'
                      }`}
                    >
                      <span className="layer-switch__thumb" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {activeTab === 'filters' ? (
            <section className="sidebar-section">
              <h3>Filters</h3>
              <p className="muted">No filters are configured yet.</p>
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
