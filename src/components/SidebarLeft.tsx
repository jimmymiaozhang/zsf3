type SidebarLeftProps = {
  isVisible: boolean;
};

const layerRows = [
  { name: 'Zoning Envelopes', status: 'Active' },
  { name: 'Road Labels', status: 'Visible' },
  { name: 'Neighborhood Labels', status: 'Visible' },
];

function SidebarLeft({ isVisible }: SidebarLeftProps) {
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
                  <span className="status-pill">{layer.status}</span>
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
