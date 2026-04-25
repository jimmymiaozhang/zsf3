import {
  formatNumber,
  getApplicableCodes,
  type LotZoningRequirements,
} from '../lib/lotZoningRequirements';
import {
  formatBoroughLabel,
  formatLandUseLabel,
  formatLotTypeLabel,
} from '../lib/plutoLookups';
import { useState, type ReactNode } from 'react';

type ExportRow = {
  label: string;
  value: string;
};

function stringifyValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return 'N/A';
  }

  return String(value);
}

function escapeHtml(value: string) {
  return value
    .split('&')
    .join('&amp;')
    .split('<')
    .join('&lt;')
    .split('>')
    .join('&gt;')
    .split('"')
    .join('&quot;')
    .split("'")
    .join('&#39;');
}

function formatExportValue(value: string) {
  return escapeHtml(value).split('\n').join('<br />');
}

function buildExportSection(title: string, rows: ExportRow[]) {
  return `
    <section class="report-section">
      <h2>${escapeHtml(title)}</h2>
      <div class="report-grid">
        ${rows
          .map(
            (row) => `
              <div class="report-row">
                <span class="report-label">${escapeHtml(row.label)}</span>
                <span class="report-value">${formatExportValue(row.value)}</span>
              </div>
            `
          )
          .join('')}
      </div>
    </section>
  `;
}

function openPrintableReport(
  lotAddress: string,
  sectionsHtml: string,
  rawJson: string
) {
  const reportWindow = window.open('', '_blank', 'noopener,noreferrer');
  if (!reportWindow) {
    return;
  }

  reportWindow.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>PLAZA Zoning Requirements Report</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        padding: 32px;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #111827;
        background: #ffffff;
      }
      .report-header {
        margin-bottom: 24px;
        padding-bottom: 20px;
        border-bottom: 2px solid #e5e7eb;
      }
      .report-header h1 {
        margin: 0 0 6px;
        font-size: 1.5rem;
      }
      .report-header p {
        margin: 0;
        color: #6b7280;
        line-height: 1.5;
      }
      .report-section {
        margin-bottom: 24px;
        page-break-inside: avoid;
      }
      .report-section h2 {
        margin: 0 0 12px;
        font-size: 1.05rem;
      }
      .report-grid {
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        overflow: hidden;
      }
      .report-row {
        display: grid;
        grid-template-columns: minmax(180px, 240px) 1fr;
        gap: 16px;
        padding: 10px 14px;
        border-bottom: 1px solid #e5e7eb;
      }
      .report-row:last-child {
        border-bottom: none;
      }
      .report-label {
        color: #6b7280;
        font-size: 0.9rem;
      }
      .report-value {
        color: #111827;
        font-size: 0.94rem;
        font-weight: 600;
        text-align: right;
      }
      .report-json {
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        background: #f8fafc;
        padding: 16px;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 0.78rem;
        line-height: 1.5;
      }
      @media print {
        body {
          padding: 20px;
        }
      }
    </style>
  </head>
  <body>
    <header class="report-header">
      <h1>Per-Lot Automated Zoning Analysis (PLAZA.place)</h1>
      <p>Full zoning requirements export for ${escapeHtml(lotAddress)}.</p>
    </header>
    ${sectionsHtml}
    <section class="report-section">
      <h2>Raw Zoning Requirements JSON</h2>
      <pre class="report-json">${escapeHtml(rawJson)}</pre>
    </section>
    <script>
      window.addEventListener('load', () => {
        window.print();
      });
    </script>
  </body>
</html>`);
  reportWindow.document.close();
}

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
  const [activeTab, setActiveTab] = useState<'preview' | 'export'>(
    'preview'
  );
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
  const selectedLotRows: ExportRow[] = [
    { label: 'Address', value: stringifyValue(metadata?.lot_address) },
    { label: 'BBL', value: metadata ? String(metadata.bbl) : 'N/A' },
    {
      label: 'Block / Lot',
      value: metadata ? `${metadata.block} / ${metadata.lot}` : 'N/A',
    },
    { label: 'Borough', value: formatBoroughLabel(metadata?.borough) },
    { label: 'Zoning Map', value: stringifyValue(metadata?.zoning_map) },
    {
      label: 'Community District',
      value: metadata ? String(metadata.community_district ?? 'N/A') : 'N/A',
    },
    { label: 'Current Use', value: formatLandUseLabel(metadata?.current_use) },
    { label: 'Lot Type', value: formatLotTypeLabel(metadata?.lot_type) },
    {
      label: 'Landmark Status',
      value: stringifyValue(metadata?.nyc_designated_landmark ?? 'None'),
    },
    {
      label: 'Existing Floor Area',
      value:
        existingFloorArea !== null && existingFloorArea !== undefined
          ? `${formatNumber(existingFloorArea)} sf`
          : 'N/A',
    },
    {
      label: 'Legal Lot Area',
      value:
        legalLotArea !== null && legalLotArea !== undefined
          ? `${formatNumber(legalLotArea)} sf`
          : 'N/A',
    },
    { label: 'Existing FAR', value: formatNumber(existingFar, 2) },
    {
      label: 'Frontages',
      value: frontages.length ? frontages.join('\n') : 'N/A',
    },
  ];
  const zoningContextRows: ExportRow[] = [
    {
      label: 'Primary Districts',
      value: primaryDistricts.join(', ') || 'N/A',
    },
    {
      label: 'Commercial Overlays',
      value: commercialOverlays.join(', ') || 'None',
    },
    {
      label: 'Special Districts',
      value: specialDistricts.join(', ') || 'None',
    },
    {
      label: 'Historic Districts',
      value: historicDistricts.join(', ') || 'None',
    },
  ];
  const bulkEnvelopeRows: ExportRow[] = [
    { label: 'Residential FAR', value: formatNumber(byUse?.residential?.max_far, 1) },
    { label: 'Commercial FAR', value: formatNumber(byUse?.commercial?.max_far, 1) },
    {
      label: 'Community Facility FAR',
      value: formatNumber(byUse?.community_facility?.max_far, 1),
    },
    {
      label: 'Max Floor Area',
      value:
        maxFloorArea?.all_uses !== null && maxFloorArea?.all_uses !== undefined
          ? `${formatNumber(maxFloorArea.all_uses)} sf`
          : 'N/A',
    },
    {
      label: 'Narrow St. Min Base Height',
      value:
        narrowStreet?.min_base_height !== null &&
        narrowStreet?.min_base_height !== undefined
          ? `${formatNumber(narrowStreet.min_base_height, 1)} ft`
          : 'N/A',
    },
    {
      label: 'Narrow St. Max Base Height',
      value:
        narrowStreet?.max_base_height !== null &&
        narrowStreet?.max_base_height !== undefined
          ? `${formatNumber(narrowStreet.max_base_height, 1)} ft`
          : 'N/A',
    },
    {
      label: 'Narrow St. Max Building Height',
      value:
        narrowStreet?.max_building_height !== null &&
        narrowStreet?.max_building_height !== undefined
          ? `${formatNumber(narrowStreet.max_building_height, 1)} ft`
          : 'N/A',
    },
    {
      label: 'Narrow St. Setback',
      value:
        narrowStreet?.setback !== null && narrowStreet?.setback !== undefined
          ? `${formatNumber(narrowStreet.setback, 1)} ft`
          : 'N/A',
    },
    {
      label: 'Wide St. Min Base Height',
      value:
        wideStreet?.min_base_height !== null &&
        wideStreet?.min_base_height !== undefined
          ? `${formatNumber(wideStreet.min_base_height, 1)} ft`
          : 'N/A',
    },
    {
      label: 'Wide St. Max Base Height',
      value:
        wideStreet?.max_base_height !== null &&
        wideStreet?.max_base_height !== undefined
          ? `${formatNumber(wideStreet.max_base_height, 1)} ft`
          : 'N/A',
    },
    {
      label: 'Wide St. Max Building Height',
      value:
        wideStreet?.max_building_height !== null &&
        wideStreet?.max_building_height !== undefined
          ? `${formatNumber(wideStreet.max_building_height, 1)} ft`
          : 'N/A',
    },
    {
      label: 'Wide St. Setback',
      value:
        wideStreet?.setback !== null && wideStreet?.setback !== undefined
          ? `${formatNumber(wideStreet.setback, 1)} ft`
          : 'N/A',
    },
  ];
  const parkingDensityRows: ExportRow[] = [
    {
      label: 'Residential Parking',
      value: formatNumber(parking?.residential_parking?.required, 4),
    },
    {
      label: 'Commercial Parking',
      value: formatNumber(parking?.commercial_parking?.required, 4),
    },
    {
      label: 'Community Facility Parking',
      value: formatNumber(parking?.community_facility_parking?.required, 4),
    },
    {
      label: 'Density Factor',
      value: formatNumber(density?.residential_density_factor, 2),
    },
    {
      label: 'Max Dwelling Units',
      value: formatNumber(density?.max_dwelling_units),
    },
  ];

  const handleExportPdf = () => {
    if (!lotRequirements || !metadata) {
      return;
    }

    const sectionsHtml = [
      buildExportSection('Selected Lot', selectedLotRows),
      buildExportSection('Zoning Context', zoningContextRows),
      buildExportSection('Bulk + Envelope', bulkEnvelopeRows),
      buildExportSection('Parking + Density', parkingDensityRows),
    ].join('');

    openPrintableReport(
      metadata.lot_address,
      sectionsHtml,
      JSON.stringify(lotRequirements, null, 2)
    );
  };

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
            <path d="M7 4L11 9L7 14" />
          </svg>
        </button>
      ) : null}
      <div className="sidebar-inner">
        <div className="sidebar-toolbar">
          <button
            className={activeTab === 'preview' ? 'active' : ''}
            type="button"
            onClick={() => setActiveTab('preview')}
          >
            Preview
          </button>
          <button
            className={activeTab === 'export' ? 'active' : ''}
            type="button"
            onClick={() => setActiveTab('export')}
          >
            Export
          </button>
        </div>

        <div className="sidebar-content">
          {activeTab === 'preview' ? (
            <>
              <section className="sidebar-section">
                <h3>Selected Lot</h3>
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
                    label="Borough"
                    value={formatBoroughLabel(metadata?.borough)}
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
                    label="Current Use"
                    value={formatLandUseLabel(metadata?.current_use)}
                  />
                  <InfoRow
                    label="Lot Type"
                    value={formatLotTypeLabel(metadata?.lot_type)}
                  />
                  <InfoRow
                    label="Landmark Status"
                    value={metadata?.nyc_designated_landmark ?? 'None'}
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
                    label="Narrow St. Min Base Height"
                    value={
                      narrowStreet?.min_base_height !== null &&
                      narrowStreet?.min_base_height !== undefined
                        ? `${formatNumber(narrowStreet.min_base_height, 1)} ft`
                        : 'N/A'
                    }
                  />
                  <InfoRow
                    label="Narrow St. Max Base Height"
                    value={
                      narrowStreet?.max_base_height !== null &&
                      narrowStreet?.max_base_height !== undefined
                        ? `${formatNumber(narrowStreet.max_base_height, 1)} ft`
                        : 'N/A'
                    }
                  />
                  <InfoRow
                    label="Narrow St. Max Building Height"
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
                    label="Wide St. Min Base Height"
                    value={
                      wideStreet?.min_base_height !== null &&
                      wideStreet?.min_base_height !== undefined
                        ? `${formatNumber(wideStreet.min_base_height, 1)} ft`
                        : 'N/A'
                    }
                  />
                  <InfoRow
                    label="Wide St. Max Base Height"
                    value={
                      wideStreet?.max_base_height !== null &&
                      wideStreet?.max_base_height !== undefined
                        ? `${formatNumber(wideStreet.max_base_height, 1)} ft`
                        : 'N/A'
                    }
                  />
                  <InfoRow
                    label="Wide St. Max Building Height"
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
            </>
          ) : null}

          {activeTab === 'export' ? (
            <section className="sidebar-section">
              <h3>Export PDF</h3>
              <p className="muted">
                Generate a printable full report for the selected lot. In the print
                dialog, choose &quot;Save as PDF&quot; to export it.
              </p>
              {selectedLotMessage ? <p className="muted">{selectedLotMessage}</p> : null}
              <div className="sidebar-export-actions">
                <button
                  className="sidebar-export-button"
                  type="button"
                  onClick={handleExportPdf}
                  disabled={!lotRequirements || !metadata || lotRequirementsLoading}
                >
                  Export Full PDF Report
                </button>
              </div>
            </section>
          ) : null}
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
