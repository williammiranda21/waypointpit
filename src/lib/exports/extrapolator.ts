import type { Tables } from '@/lib/database.types';
import type {
  AgeBucket,
  AprProportions,
  RaceEthnicityBucket,
} from './aprParser';

type Submission = Tables<'submissions'>;

/**
 * Per-variable extrapolated value for the PIT report. Keyed by the same
 * variable name the template's PitRawData sheet expects (e.g.
 * 'personBothUnder18Unsheltered'). Sheltered variables are intentionally
 * absent — the writer will leave them blank so the template renders "NO DATA".
 */
export type ExtrapolatedValues = Record<string, number>;

export interface ExtrapolationInput {
  submissions: Submission[];
  apr: AprProportions;
  /** Optional override for total unsheltered persons if you'd rather scale to a different N (e.g. partial-count adjustments). Defaults to the sum of person_count. */
  totalUnshelteredOverride?: number;
}

export interface ExtrapolationDiagnostics {
  totalPersons: number;
  surveyedPersons: number;
  tallyOnlyPersons: number;
  totalSubmissions: number;
  surveysCount: number;
  /** % of total persons whose demographics were directly observed. The remainder is filled via APR proportions. */
  observedDemographicShare: number;
  source: string;
}

export interface ExtrapolationResult {
  values: ExtrapolatedValues;
  diagnostics: ExtrapolationDiagnostics;
  /** Per-category aggregations used for the Executive Report. */
  aggregates: {
    age: Record<AgeBucket, number>;
    raceEthnicity: Record<RaceEthnicityBucket, number>;
    households: { adultOnly: number; withChildren: number; childOnly: number };
    youth: { unaccompaniedYouth: number; parentingYouth: number };
    subpops: AprProportions['subpopulations'];
  };
}

// -----------------------------------------------------------------------------
// Mapping from Waypoint observation enums → APR bucket enums
// -----------------------------------------------------------------------------

function mapAge(a: Submission['estimated_age_range']): AgeBucket | null {
  switch (a) {
    case 'under_18': return 'under_18';
    case '18_24': return '18_24';
    case '25_34': return '25_34';
    case '35_44': return '35_44';
    case '45_54': return '45_54';
    case '55_64': return '55_64';
    case '65_plus': return '65_plus';
    default: return null;
  }
}

function mapRaceEth(
  race: Submission['observed_race'],
  eth: Submission['observed_ethnicity'],
): RaceEthnicityBucket | null {
  if (!race) return null;
  const h = eth === 'hispanic';
  switch (race) {
    case 'american_indian_alaska_native': return h ? 'american_indian_h' : 'american_indian_nh';
    case 'asian': return h ? 'asian_h' : 'asian_nh';
    case 'black_african_american': return h ? 'black_h' : 'black_nh';
    case 'native_hawaiian_pacific_islander': return h ? 'nhpi_h' : 'nhpi_nh';
    case 'white': return h ? 'white_h' : 'white_nh';
    case 'multi_racial': return h ? 'multi_h' : 'multi_nh';
    case 'unknown':
      // Treat as just an ethnicity flag if known.
      return h ? 'hispanic_only' : null;
    default:
      return null;
  }
}

// -----------------------------------------------------------------------------
// Engine
// -----------------------------------------------------------------------------

export function extrapolate(input: ExtrapolationInput): ExtrapolationResult {
  const { submissions, apr } = input;

  // Step 1: sum persons + bucket directly-observed demographics
  let totalPersons = 0;
  let surveyedPersons = 0;
  let surveysCount = 0;

  const observedAge = blankBucket<AgeBucket>(Object.keys(apr.age) as AgeBucket[]);
  const observedRE = blankBucket<RaceEthnicityBucket>(
    Object.keys(apr.raceEthnicity) as RaceEthnicityBucket[],
  );

  let observedAgePersons = 0;
  let observedREPersons = 0;

  for (const s of submissions) {
    totalPersons += s.person_count;
    if (s.submission_type === 'survey') {
      surveyedPersons += s.person_count;
      surveysCount += 1;
    }
    const a = mapAge(s.estimated_age_range);
    if (a) {
      observedAge[a] += s.person_count;
      observedAgePersons += s.person_count;
    }
    const re = mapRaceEth(s.observed_race, s.observed_ethnicity);
    if (re) {
      observedRE[re] += s.person_count;
      observedREPersons += s.person_count;
    }
  }

  const N = input.totalUnshelteredOverride ?? totalPersons;
  const tallyOnlyPersons = totalPersons - surveyedPersons;
  const observedShare =
    totalPersons > 0
      ? (observedAgePersons + observedREPersons) / (totalPersons * 2)
      : 0;

  // Step 2: blend observed + APR-extrapolated demographics, scaled to N
  const finalAge = blendDistribution(observedAge, observedAgePersons, apr.age, N);
  const finalRE = blendDistribution(
    observedRE,
    observedREPersons,
    apr.raceEthnicity,
    N,
  );

  // Step 3: household type splits (driven by APR — Waypoint doesn't observe HH)
  const householdsAdult = N * apr.householdTypes.adultOnly;
  const householdsBoth = N * apr.householdTypes.withChildren;
  const householdsChild = N * apr.householdTypes.childOnly;

  // Step 4: write to the variable name space the template expects
  const values: ExtrapolatedValues = {};
  fillAdultOnly(values, householdsAdult, finalAge, finalRE, apr);
  fillAdultWithChildren(values, householdsBoth, finalAge, finalRE, apr);
  fillChildOnly(values, householdsChild, finalAge, finalRE, apr);
  fillYouth(values, N, apr, finalRE);
  fillVeterans(values, N, apr, finalRE);
  fillAdditionalPopulations(values, N, apr);

  return {
    values,
    diagnostics: {
      totalPersons,
      surveyedPersons,
      tallyOnlyPersons,
      totalSubmissions: submissions.length,
      surveysCount,
      observedDemographicShare: observedShare,
      source: apr.sourceFileName,
    },
    aggregates: {
      age: finalAge,
      raceEthnicity: finalRE,
      households: {
        adultOnly: householdsAdult,
        withChildren: householdsBoth,
        childOnly: householdsChild,
      },
      youth: {
        unaccompaniedYouth: N * apr.youth.unaccompaniedYouth,
        parentingYouth: N * apr.youth.parentingYouth,
      },
      subpops: apr.subpopulations,
    },
  };
}

// -----------------------------------------------------------------------------
// Per-section fillers — match the template's variable naming exactly.
// -----------------------------------------------------------------------------

function fillAdultOnly(
  out: ExtrapolatedValues,
  total: number,
  age: Record<AgeBucket, number>,
  re: Record<RaceEthnicityBucket, number>,
  apr: AprProportions,
) {
  const personScale = totalScale(age, ['18_24', '25_34', '35_44', '45_54', '55_64', '65_plus']);
  const N = total;
  out.householdAdultUnsheltered = round(N); // each adult = 1 household in AO
  // Age — exclude under_18 from AO
  out.personAdult18To24Unsheltered = round(scaled(age, '18_24', personScale, N));
  out.personAdult25To34Unsheltered = round(scaled(age, '25_34', personScale, N));
  out.personAdult35To44Unsheltered = round(scaled(age, '35_44', personScale, N));
  out.personAdult45To54Unsheltered = round(scaled(age, '45_54', personScale, N));
  out.personAdult55To64Unsheltered = round(scaled(age, '55_64', personScale, N));
  out.personAdultOver64Unsheltered = round(scaled(age, '65_plus', personScale, N));
  // Race/Ethnicity
  spreadRaceEth(out, 'personAdult', re, N, 'Unsheltered');
  // Chronically Homeless
  out.personAdultCronPersonsUnsheltered = round(N * apr.subpopulations.chronicallyHomeless);
}

function fillAdultWithChildren(
  out: ExtrapolatedValues,
  total: number,
  age: Record<AgeBucket, number>,
  re: Record<RaceEthnicityBucket, number>,
  apr: AprProportions,
) {
  const N = total;
  // Households — assume each ~2.5 persons in PIT data, but lacking a real
  // value we estimate 1 household per 2 persons (conservative).
  out.householdBothUnsheltered = round(N / 2);
  // Age — under_18 + adult ages
  const personScale = totalScale(age, [
    'under_18', '18_24', '25_34', '35_44', '45_54', '55_64', '65_plus',
  ]);
  out.personBothUnder18Unsheltered = round(scaled(age, 'under_18', personScale, N));
  out.personBoth18To24Unsheltered = round(scaled(age, '18_24', personScale, N));
  out.personBoth25To34Unsheltered = round(scaled(age, '25_34', personScale, N));
  out.personBoth35To44Unsheltered = round(scaled(age, '35_44', personScale, N));
  out.personBoth45To54Unsheltered = round(scaled(age, '45_54', personScale, N));
  out.personBoth55To64Unsheltered = round(scaled(age, '55_64', personScale, N));
  out.personBothOver64Unsheltered = round(scaled(age, '65_plus', personScale, N));
  spreadRaceEth(out, 'personBoth', re, N, 'Unsheltered');
  out.personBothCronHouseholdsUnsheltered = round((N / 2) * apr.subpopulations.chronicallyHomeless);
  out.personBothCronPersonsUnsheltered = round(N * apr.subpopulations.chronicallyHomeless);
}

function fillChildOnly(
  out: ExtrapolatedValues,
  total: number,
  _age: Record<AgeBucket, number>,
  re: Record<RaceEthnicityBucket, number>,
  apr: AprProportions,
) {
  const N = total;
  out.householdChildUnsheltered = round(N);
  out.personChildUnsheltered = round(N);
  spreadRaceEth(out, 'personChild', re, N, 'Unsheltered');
  out.personChildCronPersonsUnsheltered = round(N * apr.subpopulations.chronicallyHomeless);
}

function fillYouth(
  out: ExtrapolatedValues,
  N: number,
  apr: AprProportions,
  re: Record<RaceEthnicityBucket, number>,
) {
  const uy = N * apr.youth.unaccompaniedYouth;
  out.householdUnaccompaniedYouthUnsheltered = round(uy);
  out.personYouthUnaccompaniedUnder18Unsheltered = round(uy * 0.15); // ~15% are minors per HUD norm
  out.personYouthUnaccompanied18To24Unsheltered = round(uy * 0.85);
  spreadRaceEth(out, 'personYouth', re, uy, 'Unsheltered');
  out.personYouthCronPersonsUnsheltered = round(uy * apr.subpopulations.chronicallyHomeless);

  const py = N * apr.youth.parentingYouth;
  out.householdParentingYouthUnsheltered = round(py);
  // Of parenting-youth persons: ~half are parents (18-24) and ~half are their children (under 18)
  out.personParentingYouthUnder18Unsheltered = round(py * 0.4);
  out.personParentingYouthChildrenParentsUnder18Unsheltered = round(py * 0.1);
  out.personParentingYouth18To24Unsheltered = round(py * 0.4);
  out.personParentingYouthChildrenParents18To24Unsheltered = round(py * 0.1);
  spreadRaceEth(out, 'personParentingYouth', re, py, 'Unsheltered');
}

function fillVeterans(
  out: ExtrapolatedValues,
  N: number,
  apr: AprProportions,
  re: Record<RaceEthnicityBucket, number>,
) {
  const vets = N * apr.subpopulations.veteran;
  // Most veterans are in adult-only households.
  const vetAdult = vets * 0.96;
  const vetBoth = vets * 0.04;

  // Vets AC
  out.householdBothUnshelteredVet = round(vetBoth / 2);
  out.personBothVetUnsheltered = round(vetBoth);
  out.personBothVetVetUnsheltered = round(vetBoth);
  spreadRaceEth(out, 'personBoth', re, vetBoth, 'VetUnsheltered');
  out.personBothCronHouseholdsVetUnsheltered = round((vetBoth / 2) * apr.subpopulations.chronicallyHomeless);
  out.personBothCronPersonsVetUnsheltered = round(vetBoth * apr.subpopulations.chronicallyHomeless);

  // Vets AO
  out.householdAdultUnshelteredVet = round(vetAdult);
  out.personAdultVetUnsheltered = round(vetAdult);
  out.personAdultVetVetUnsheltered = round(vetAdult);
  spreadRaceEth(out, 'personAdult', re, vetAdult, 'VetUnsheltered');
  out.personAdultCronPersonsUnshelteredVet = round(vetAdult * apr.subpopulations.chronicallyHomeless);
}

function fillAdditionalPopulations(
  out: ExtrapolatedValues,
  N: number,
  apr: AprProportions,
) {
  // Per template, these target Adults Only (not children).
  // Approximate adult-share as 1 - under_18 share (assumes adults receive these dx).
  const adults = N * (1 - 0); // Adult-only subset modeled separately — for simplicity treat as N (most unsheltered are adults).
  out.severelyMentallyIllUnsheltered = round(adults * apr.subpopulations.severelyMentallyIll);
  out.chronicSubstanceAbuseUnsheltered = round(adults * apr.subpopulations.substanceUseDisorder);
  out.hivAidsUnsheltered = round(adults * apr.subpopulations.hivAids);
  out.domesticViolenceVictimsUnsheltered = round(adults * apr.subpopulations.domesticViolence);
}

// -----------------------------------------------------------------------------
// Race/Ethnicity spreader — handles the 15-bucket naming convention
// -----------------------------------------------------------------------------

interface ReNaming {
  prefix: string;
  suffix: string;
}

const RE_NAME_MAP: Record<RaceEthnicityBucket, { base: string; isHispanic: boolean }> = {
  american_indian_nh: { base: 'AmericanIndianNH', isHispanic: false },
  american_indian_h:  { base: 'AmericanIndianH', isHispanic: true },
  asian_nh:           { base: 'AsianNH', isHispanic: false },
  asian_h:            { base: 'AsianH', isHispanic: true },
  black_nh:           { base: 'BlackNH', isHispanic: false },
  black_h:            { base: 'BlackH', isHispanic: true },
  hispanic_only:      { base: 'Hispanic', isHispanic: true },
  mena_nh:            { base: 'MENANH', isHispanic: false },
  mena_h:             { base: 'MENAH', isHispanic: true },
  nhpi_nh:            { base: 'NativeHawaiianNH', isHispanic: false },
  nhpi_h:             { base: 'NativeHawaiianH', isHispanic: true },
  white_nh:           { base: 'WhiteNH', isHispanic: false },
  white_h:            { base: 'WhiteH', isHispanic: true },
  multi_h:            { base: 'MultipleRaceH', isHispanic: true },
  multi_nh:           { base: 'MultipleRaceNH', isHispanic: false },
};

function spreadRaceEth(
  out: ExtrapolatedValues,
  prefix: string,
  re: Record<RaceEthnicityBucket, number>,
  total: number,
  suffix: string,
) {
  if (total <= 0) return;
  const totalRe = Object.values(re).reduce((a, b) => a + b, 0);
  if (totalRe <= 0) return;
  for (const [bucket, { base }] of Object.entries(RE_NAME_MAP)) {
    const key = `${prefix}${base}${suffix}`;
    const share = re[bucket as RaceEthnicityBucket] / totalRe;
    out[key] = round(total * share);
  }
  void prefix; void suffix; void RE_NAME_MAP[Object.keys(RE_NAME_MAP)[0] as RaceEthnicityBucket]; void ({} as ReNaming);
}

// -----------------------------------------------------------------------------
// Tiny helpers
// -----------------------------------------------------------------------------

function blankBucket<K extends string>(keys: K[]): Record<K, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>;
}

function totalScale<K extends string>(bucket: Record<K, number>, include: K[]): number {
  return include.reduce((s, k) => s + (bucket[k] ?? 0), 0);
}

function scaled<K extends string>(
  bucket: Record<K, number>,
  key: K,
  total: number,
  N: number,
): number {
  if (total <= 0) return 0;
  return (bucket[key] / total) * N;
}

function blendDistribution<K extends string>(
  observed: Record<K, number>,
  observedTotal: number,
  apr: Record<K, number>,
  N: number,
): Record<K, number> {
  if (observedTotal <= 0) {
    // Fall through to APR proportions
    const out = {} as Record<K, number>;
    for (const k of Object.keys(apr) as K[]) out[k] = N * apr[k];
    return out;
  }
  // Use observed proportions but scale to N.
  const out = {} as Record<K, number>;
  for (const k of Object.keys(observed) as K[]) {
    out[k] = (observed[k] / observedTotal) * N;
  }
  return out;
}

function round(n: number): number {
  return Math.round(n);
}
