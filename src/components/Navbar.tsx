import { useState } from 'react';

function Navbar() {
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <header className="navbar">
        <div className="navbar-logo">Per Lot Automated Zoning Analysis (PLAZA)</div>
        <div className="navbar-version">Beta Version 0.1</div>
        <nav className="navbar-menu" aria-label="Primary">
          <button type="button" onClick={() => setAboutOpen(true)}>
            About
          </button>
        </nav>
      </header>
      {aboutOpen ? (
        <div
          className="about-dialog-backdrop"
          role="presentation"
          onClick={() => setAboutOpen(false)}
        >
          <div
            className="about-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="about-dialog__close"
              type="button"
              aria-label="Close about dialog"
              title="Close"
              onClick={() => setAboutOpen(false)}
            >
              <svg viewBox="0 0 18 18" aria-hidden="true">
                <path d="M5 5L13 13M13 5L5 13" />
              </svg>
            </button>
            <h2 id="about-dialog-title">About PLAZA.place</h2>
            <p>
              Per-Lot Automated Zoning Analysis (PLAZA.place) is an
              AI-assisted urban planning and zoning tool that translates lot-level
              zoning regulations into spatialized analysis, interactive map views,
              and envelope-based visualization for faster site understanding.
            </p>
            <br />
            <p>Beta Version 0.1</p>
            <p>2026-04-24</p>
            <p>{'\u00A9'} 2026 PLAZA.place. All rights reserved.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default Navbar;
