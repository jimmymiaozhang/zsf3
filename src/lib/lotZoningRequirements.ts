export type LotRequirementsIndex = Record<string, string>;

export type DatasetIndex = {
  blocks: string[];
  lotZoningRequirements: LotRequirementsIndex;
};

type ZoningContextItem = {
  code: string | null;
  applies: boolean | null;
};

type UseFar = {
  max_far: number | null;
};

export type LotZoningRequirements = {
  metadata: {
    lot_address: string;
    borough: number;
    block: number;
    lot: number;
    bbl: number | string;
    zoning_map: string | null;
    community_district: string | number | null;
    existing_floor_area: number | null;
    current_use: string | null;
    nyc_designated_landmark: string | null;
  };
  spatial_data?: {
    lot_area?: {
      legal?: {
        area: number | null;
      };
      calculated?: {
        area: number | null;
      };
    };
    lot_lines?: Array<{
      lot_line_type: string | null;
      street_type: string | null;
      calculated_length: number | null;
    }>;
  };
  zoning_context?: {
    primary_zoning_districts?: ZoningContextItem[];
    commercial_overlays?: ZoningContextItem[];
    special_district_overlays?: ZoningContextItem[];
    historic_district_overlays?: ZoningContextItem[];
  };
  zoning_scenarios?: Array<{
    bulk_far?: {
      by_use?: {
        residential?: UseFar;
        commercial?: UseFar;
        community_facility?: UseFar;
      };
      max_permitted_floor_area?: {
        residential?: number | null;
        commercial?: number | null;
        community_facility?: number | null;
        all_uses?: number | null;
      };
    };
    height_and_setback?: {
      narrow_street?: {
        max_building_height?: number | null;
        setback?: number | null;
      };
      wide_street?: {
        max_building_height?: number | null;
        setback?: number | null;
      };
    };
    parking_and_loading?: {
      residential_parking?: {
        required?: number | null;
      };
      commercial_parking?: {
        required?: number | null;
      };
      community_facility_parking?: {
        required?: number | null;
      };
    };
    residential_density?: {
      residential_density_factor?: number | null;
      max_dwelling_units?: number | null;
    };
  }>;
};

export type LotSelectionState = {
  activeBbl: string | null;
  lotRequirements: LotZoningRequirements | null;
  lotRequirementsLoading: boolean;
  lotRequirementsError: string | null;
};

function formatCode(item: ZoningContextItem) {
  if (!item.applies || !item.code || item.code.toLowerCase() === 'nan') {
    return null;
  }

  return item.code;
}

export function getApplicableCodes(items?: ZoningContextItem[]) {
  return (items ?? []).map(formatCode).filter((code): code is string => Boolean(code));
}

export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/A';
  }

  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}
