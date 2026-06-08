import { loadMdcCommission } from './mdcCommission';
import { loadComCommission } from './comCommission';
import { loadMunicipalities } from './municipalities';
import { loadZipCodes } from './zipCodes';
import { loadCensusTracts } from './censusTracts';
import { loadComPoliceNeighborhoods } from './comPoliceNeighborhoods';
import type { BoundaryFeature, BoundaryLayer, BoundaryLayerId } from './types';

export const BOUNDARY_LAYERS: BoundaryLayer[] = [
  {
    id: 'mdc_commission',
    label: 'Miami-Dade Commission Districts',
    description: 'Aggregates submissions inside each county district (13 total).',
    load: loadMdcCommission,
  },
  {
    id: 'com_commission',
    label: 'City of Miami Commission Districts',
    description: 'City of Miami’s 5 council districts.',
    load: loadComCommission,
  },
  {
    id: 'municipalities',
    label: 'Municipalities',
    description: 'Incorporated cities within Miami-Dade County.',
    load: loadMunicipalities,
  },
  {
    id: 'zip',
    label: 'ZIP Codes',
    description: 'USPS ZIP code service areas — useful for cross-referencing housing data.',
    load: loadZipCodes,
  },
  {
    id: 'census_tract',
    label: 'Census Tracts',
    description: 'Census Bureau tracts — preferred geography for HUD / HMIS reporting.',
    load: loadCensusTracts,
  },
  {
    id: 'com_police',
    label: 'City of Miami Police Neighborhoods',
    description: 'Miami PD NET / NRO neighborhood assignments.',
    load: loadComPoliceNeighborhoods,
  },
];

export function getBoundaryLayer(id: BoundaryLayerId): BoundaryLayer {
  const layer = BOUNDARY_LAYERS.find((l) => l.id === id);
  if (!layer) throw new Error(`Unknown boundary layer: ${id}`);
  return layer;
}

export type { BoundaryFeature, BoundaryLayer, BoundaryLayerId };
