type SidebarRightProps = {
  isVisible: boolean;
  onHide: () => void;
};

const insightCards = [
  { name: 'Selection Mode', value: 'Click to select', tone: 'success' },
  { name: 'Rendering', value: 'Custom three.js layer', tone: 'warning' },
  { name: 'Basemap', value: 'Mapbox Standard', tone: '' },
];

function SidebarRight({ isVisible, onHide }: SidebarRightProps) {
  return (
    <aside
      className={`sidebar sidebar-right ${isVisible ? 'open' : 'closed'}`}
      aria-hidden={!isVisible}
    >
      {isVisible ? (
        <button
          className="sidebar-handle sidebar-handle--right"
          type="button"
          onClick={onHide}
          aria-label="Hide right sidebar"
          title="Hide right sidebar"
        >
          <svg viewBox="0 0 18 18" aria-hidden="true">
            <path d="M5 5L13 13M13 5L5 13" />
          </svg>
        </button>
      ) : null}
      <div className="sidebar-inner">
        <div className="sidebar-toolbar">
          <button className="active" type="button">
            Analysis
          </button>
          <button type="button">Export</button>
          <button type="button">Settings</button>
        </div>

        <div className="sidebar-content">
          <section className="sidebar-section">
            <h3>Workspace Summary</h3>
            <p className="muted">
              Keep project notes, export settings, and interpretation guidance
              here as the UI evolves.
            </p>
            <ul className="sidebar-list">
              {insightCards.map((card) => (
                <li key={card.name} className="sidebar-row">
                  <span>{card.name}</span>
                  <span className={`status-pill ${card.tone}`.trim()}>
                    {card.value}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="sidebar-section">
            <h4>Current Goal</h4>
            <p className="muted">
              This panel is ready for lot details, zoning metrics, and export
              actions for the selected envelope.
            </p>
          </section>

          <section className="sidebar-section">
            <h4>Next Steps</h4>
            <p className="muted">
              Natural follow-ups include richer sidebar content, dataset
              switching, and lot-specific summaries.
            </p>
          </section>
        </div>
      </div>
    </aside>
  );
}

export default SidebarRight;
