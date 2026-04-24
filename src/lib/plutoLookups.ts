const BOROUGH_LABELS: Record<string, string> = {
  '1': 'Manhattan',
  '2': 'Bronx',
  '3': 'Brooklyn',
  '4': 'Queens',
  '5': 'Staten Island',
};

const LOT_TYPE_LABELS: Record<string, string> = {
  '0': 'Unknown',
  '1': 'Block assemblage',
  '2': 'Waterfront',
  '3': 'Corner',
  '4': 'Through',
  '5': 'Interior',
  '6': 'Interior (no street frontage)',
  '7': 'Island lot',
  '8': 'Alley lot',
  '9': 'Submerged land lot',
};

const LAND_USE_LABELS: Record<string, string> = {
  '01': 'One & Two Family Buildings',
  '02': 'Multi-Family Walk-Up Buildings',
  '03': 'Multi-Family Elevator Buildings',
  '04': 'Mixed Residential & Commercial Buildings',
  '05': 'Commercial & Office Buildings',
  '06': 'Industrial & Manufacturing',
  '07': 'Transportation & Utility',
  '08': 'Public Facilities & Institutions',
  '09': 'Open Space & Outdoor Recreation',
  '10': 'Parking Facilities',
  '11': 'Vacant Land',
};

function formatLookupValue(
  value: string | number | null | undefined,
  labels: Record<string, string>
) {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  const normalizedValue = String(value).trim();
  if (!normalizedValue) {
    return 'N/A';
  }

  return labels[normalizedValue] ?? normalizedValue;
}

export function formatBoroughLabel(value: string | number | null | undefined) {
  return formatLookupValue(value, BOROUGH_LABELS);
}

export function formatLotTypeLabel(value: string | number | null | undefined) {
  return formatLookupValue(value, LOT_TYPE_LABELS);
}

export function formatLandUseLabel(value: string | number | null | undefined) {
  return formatLookupValue(value, LAND_USE_LABELS);
}
