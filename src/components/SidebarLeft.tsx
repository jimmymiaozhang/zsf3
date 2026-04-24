import type { MapLayerId, MapLayerVisibilityState } from '../App';

type SidebarLeftProps = {
  isVisible: boolean;
  mapLayers: MapLayerVisibilityState;
  onToggleLayer: (layerId: MapLayerId) => void;
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
  onToggleLayer,
}: SidebarLeftProps) {
  return (
    <aside
      className={`sidebar sidebar-left ${isVisible ? 'open' : 'closed'}`}
      aria-hidden={!isVisible}
    >
      <div className="sidebar-inner">
        <div className="sidebar-toolbar">
          <button className="active" type="button">
            Layers
          </button>
          <button type="button">Filters</button>
          <button type="button">Data</button>
        </div>

        <div className="sidebar-content">
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

          <section className="sidebar-section">
            <h4>Dataset Loading</h4>
            <p className="muted">
              Block files are discovered through an auto-generated `index.json`
              manifest in each data folder.
            </p>
          </section>

          <section className="sidebar-section">
            <h4>Selection</h4>
            <p className="muted">
              Click an envelope to reveal its full geometry. Click empty map
              space to clear the selection.
            </p>
          </section>
        </div>
      </div>
    </aside>
  );
}

export default SidebarLeft;
