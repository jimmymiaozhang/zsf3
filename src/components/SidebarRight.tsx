import {
  formatNumber,
  getApplicableCodes,
  type LotZoningRequirements,
} from '../lib/lotZoningRequirements';
import type { ReactNode } from 'react';

type SidebarRightProps = {
  isVisible: boolean;
  onHide: () => void;
  activeBbl: string | null;
  lotRequirements: LotZoningRequirements | null;
  lotRequirementsLoading: boolean;
  lotRequirementsError: string | null;
};

function SidebarRight({
  isVisible,
  onHide,
  activeBbl,
  lotRequirements,
  lotRequirementsLoading,
  lotRequirementsError,
}: SidebarRightProps) {
  const metadata = lotRequirements?.metadata;
  const legalLotArea = lotRequirements?.spatial_data?.lot_area?.legal?.area;
  const existingFloorArea = metadata?.existing_floor_area;
  const existingFar =
    existingFloorArea !== null &&
    existingFloorArea !== undefined &&
    legalLotArea !== null &&
    legalLotArea !== undefined &&
    legalLotArea > 0
      ? existingFloorArea / legalLotArea
      : null;
  const frontages = (lotRequirements?.spatial_data?.lot_lines ?? [])
    .filter((line) => line.lot_line_type === 'front')
    .map((line) =>
      [
        line.street_type ? `${line.street_type} street` : null,
        line.calculated_length !== null && line.calculated_length !== undefined
          ? `${formatNumber(line.calculated_length, 1)} ft`
          : null,
      ]
        .filter(Boolean)
        .join(' - ')
    )
    .filter(Boolean);

  const zoningContext = lotRequirements?.zoning_context;
  const primaryDistricts = getApplicableCodes(
    zoningContext?.primary_zoning_districts
  );
  const commercialOverlays = getApplicableCodes(
    zoningContext?.commercial_overlays
  );
  const specialDistricts = getApplicableCodes(
    zoningContext?.special_district_overlays
  );
  const historicDistricts = getApplicableCodes(
    zoningContext?.historic_district_overlays
  );

  const scenario = lotRequirements?.zoning_scenarios?.[0];
  const byUse = scenario?.bulk_far?.by_use;
  const maxFloorArea = scenario?.bulk_far?.max_permitted_floor_area;
  const narrowStreet = scenario?.height_and_setback?.narrow_street;
  const wideStreet = scenario?.height_and_setback?.wide_street;
  const parking = scenario?.parking_and_loading;
  const density = scenario?.residential_density;
  const hasSelection = Boolean(activeBbl);
  const selectedLotMessage = lotRequirementsLoading
    ? `Loading zoning requirements for ${activeBbl}...`
    : lotRequirementsError
      ? lotRequirementsError
      : !hasSelection
        ? 'Select a zoning envelope to inspect the lot-level zoning requirements.'
        : !lotRequirements || !metadata
          ? 'No zoning requirements loaded for the selected lot.'
          : null;

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
            Requirements
          </button>
          <button type="button">Context</button>
          <button type="button">Metrics</button>
        </div>

        <div className="sidebar-content">
          <section className="sidebar-section">
            <h3>Selected Lot</h3>
            <p className="muted">
              Click a zoning envelope to inspect the lot-level zoning
              requirements JSON associated with that BBL.
            </p>

            {selectedLotMessage ? <p className="muted">{selectedLotMessage}</p> : null}

            <div className="sidebar-data-grid">
              <InfoRow label="Address" value={metadata?.lot_address ?? 'N/A'} />
              <InfoRow
                label="BBL"
                value={metadata ? String(metadata.bbl) : 'N/A'}
              />
              <InfoRow
                label="Block / Lot"
                value={
                  metadata ? `${metadata.block} / ${metadata.lot}` : 'N/A'
                }
              />
              <InfoRow
                label="Zoning Map"
                value={metadata?.zoning_map ?? 'N/A'}
              />
              <InfoRow
                label="Community District"
                value={metadata ? String(metadata.community_district ?? 'N/A') : 'N/A'}
              />
              <InfoRow
                label="Existing Floor Area"
                value={
                  existingFloorArea !== null && existingFloorArea !== undefined
                    ? `${formatNumber(existingFloorArea)} sf`
                    : 'N/A'
                }
              />
              <InfoRow
                label="Legal Lot Area"
                value={
                  legalLotArea !== null && legalLotArea !== undefined
                    ? `${formatNumber(legalLotArea)} sf`
                    : 'N/A'
                }
              />
              <InfoRow
                label="Existing FAR"
                value={formatNumber(existingFar, 2)}
              />
              <InfoRow
                label="Frontages"
                value={
                  frontages.length ? (
                    <span className="sidebar-data-row__stack">
                      {frontages.map((frontage) => (
                        <span key={frontage}>{frontage}</span>
                      ))}
                    </span>
                  ) : (
                    'N/A'
                  )
                }
              />
            </div>
          </section>

          <section className="sidebar-section">
            <h4>Zoning Context</h4>
            <div className="sidebar-data-grid">
              <InfoRow
                label="Primary Districts"
                value={primaryDistricts.join(', ') || 'N/A'}
              />
              <InfoRow
                label="Commercial Overlays"
                value={commercialOverlays.join(', ') || 'None'}
              />
              <InfoRow
                label="Special Districts"
                value={specialDistricts.join(', ') || 'None'}
              />
              <InfoRow
                label="Historic Districts"
                value={historicDistricts.join(', ') || 'None'}
              />
            </div>
          </section>

          <section className="sidebar-section">
            <h4>Bulk + Envelope</h4>
            <div className="sidebar-data-grid">
              <InfoRow
                label="Residential FAR"
                value={formatNumber(byUse?.residential?.max_far, 1)}
              />
              <InfoRow
                label="Commercial FAR"
                value={formatNumber(byUse?.commercial?.max_far, 1)}
              />
              <InfoRow
                label="Community Facility FAR"
                value={formatNumber(byUse?.community_facility?.max_far, 1)}
              />
              <InfoRow
                label="Max Floor Area"
                value={
                  maxFloorArea?.all_uses !== null &&
                  maxFloorArea?.all_uses !== undefined
                    ? `${formatNumber(maxFloorArea.all_uses)} sf`
                    : 'N/A'
                }
              />
              <InfoRow
                label="Narrow St. Height"
                value={
                  narrowStreet?.max_building_height !== null &&
                  narrowStreet?.max_building_height !== undefined
                    ? `${formatNumber(narrowStreet.max_building_height, 1)} ft`
                    : 'N/A'
                }
              />
              <InfoRow
                label="Narrow St. Setback"
                value={
                  narrowStreet?.setback !== null &&
                  narrowStreet?.setback !== undefined
                    ? `${formatNumber(narrowStreet.setback, 1)} ft`
                    : 'N/A'
                }
              />
              <InfoRow
                label="Wide St. Height"
                value={
                  wideStreet?.max_building_height !== null &&
                  wideStreet?.max_building_height !== undefined
                    ? `${formatNumber(wideStreet.max_building_height, 1)} ft`
                    : 'N/A'
                }
              />
              <InfoRow
                label="Wide St. Setback"
                value={
                  wideStreet?.setback !== null &&
                  wideStreet?.setback !== undefined
                    ? `${formatNumber(wideStreet.setback, 1)} ft`
                    : 'N/A'
                }
              />
            </div>
          </section>

          <section className="sidebar-section">
            <h4>Parking + Density</h4>
            <div className="sidebar-data-grid">
              <InfoRow
                label="Residential Parking"
                value={formatNumber(parking?.residential_parking?.required, 4)}
              />
              <InfoRow
                label="Commercial Parking"
                value={formatNumber(parking?.commercial_parking?.required, 4)}
              />
              <InfoRow
                label="Community Facility Parking"
                value={formatNumber(
                  parking?.community_facility_parking?.required,
                  4
                )}
              />
              <InfoRow
                label="Density Factor"
                value={formatNumber(density?.residential_density_factor, 2)}
              />
              <InfoRow
                label="Max Dwelling Units"
                value={formatNumber(density?.max_dwelling_units)}
              />
            </div>
          </section>
        </div>
      </div>
    </aside>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="sidebar-data-row">
      <span className="sidebar-data-row__label">{label}</span>
      <span
        className={`sidebar-data-row__value ${
          mono ? 'sidebar-data-row__value--mono' : ''
        }`.trim()}
      >
        {value}
      </span>
    </div>
  );
}

export default SidebarRight;
