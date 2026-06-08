import JSZip from 'jszip';
import * as XLSX from 'xlsx';

/**
 * Parsed proportions extracted from a Sage HUD APR (CSV bundle or workbook).
 * All values are fractions (0–1) of the relevant subtotal, so they're safe to
 * apply to a different N (Waypoint's PIT count) as extrapolation weights.
 *
 * The APR file itself is never persisted — only these proportions live in
 * memory and `sessionStorage` while a tab is open.
 */
export interface AprProportions {
  sourceFileName: string;
  /** Total persons reflected in the APR (Q5a row 1). */
  totalPersons: number | null;
  /** Which Q-files the parser successfully extracted from. Diagnostic. */
  sectionsFound: string[];

  /** Age proportions — fractions summing to ~1. */
  age: Record<AgeBucket, number>;
  /** Race × Ethnicity — HUD's 14-bucket schema, fractions of total persons. */
  raceEthnicity: Record<RaceEthnicityBucket, number>;

  /** Subpopulation incidence (each is a fraction of total). */
  subpopulations: {
    veteran: number;
    chronicallyHomeless: number;
    severelyMentallyIll: number;
    substanceUseDisorder: number;
    hivAids: number;
    domesticViolence: number;
  };

  /** Household type proportions (Q8a / Q5a). */
  householdTypes: {
    adultOnly: number;
    withChildren: number;
    childOnly: number;
  };

  /** Youth (under 25) subset. */
  youth: {
    parentingYouth: number;
    unaccompaniedYouth: number;
  };
}

export type AgeBucket =
  | 'under_18'
  | '18_24'
  | '25_34'
  | '35_44'
  | '45_54'
  | '55_64'
  | '65_plus';
export type RaceEthnicityBucket =
  | 'american_indian_nh'
  | 'american_indian_h'
  | 'asian_nh'
  | 'asian_h'
  | 'black_nh'
  | 'black_h'
  | 'hispanic_only'
  | 'mena_nh'
  | 'mena_h'
  | 'nhpi_nh'
  | 'nhpi_h'
  | 'white_nh'
  | 'white_h'
  | 'multi_h'
  | 'multi_nh';

// -----------------------------------------------------------------------------
// In-memory persistence — proportions only (never the source file).
//
// We use localStorage instead of sessionStorage so the Executive Report opens
// in a separate tab can still find the proportions the user uploaded on the
// Export Hub. Only the derived proportions are stored, never the file itself.
// -----------------------------------------------------------------------------

const APR_STORAGE_KEY = 'waypoint-pit-apr-proportions';

export function loadStoredApr(): AprProportions | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(APR_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AprProportions;
  } catch {
    return null;
  }
}

export function saveStoredApr(apr: AprProportions): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(APR_STORAGE_KEY, JSON.stringify(apr));
  } catch {
    // ignore quota errors
  }
}

export function clearStoredApr(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(APR_STORAGE_KEY);
}

// -----------------------------------------------------------------------------
// Public entry point
// -----------------------------------------------------------------------------

export async function parseAprUpload(file: File): Promise<AprProportions> {
  const name = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();
  if (name.endsWith('.zip')) return parseSageZip(buffer, file.name);
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseSageWorkbook(buffer, file.name);
  }
  if (name.endsWith('.csv')) {
    const text = new TextDecoder().decode(buffer);
    return assembleProportions(file.name, [{ name: file.name, rows: csvToRows(text) }]);
  }
  throw new Error(
    'Unsupported APR format. Provide the Sage CSV .zip bundle or the Sage .xlsx workbook.',
  );
}

// -----------------------------------------------------------------------------
// Bundle / workbook readers
// -----------------------------------------------------------------------------

async function parseSageZip(buffer: ArrayBuffer, fileName: string): Promise<AprProportions> {
  const zip = await JSZip.loadAsync(buffer);
  const csvs: CsvFile[] = [];
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    if (!entry.name.toLowerCase().endsWith('.csv')) continue;
    const text = await entry.async('string');
    csvs.push({ name: entry.name, rows: csvToRows(text) });
  }
  return assembleProportions(fileName, csvs);
}

function parseSageWorkbook(buffer: ArrayBuffer, fileName: string): AprProportions {
  const wb = XLSX.read(buffer, { type: 'array' });
  const csvs: CsvFile[] = wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,
      defval: '',
      raw: false,
    }) as string[][],
  }));
  return assembleProportions(fileName, csvs);
}

// -----------------------------------------------------------------------------
// Assembly — extracts proportions from the actual Sage CoC APR CSV bundle
// -----------------------------------------------------------------------------

interface CsvFile {
  name: string;
  rows: string[][];
}

function assembleProportions(fileName: string, files: CsvFile[]): AprProportions {
  const sectionsFound: string[] = [];
  const find = (rx: RegExp): CsvFile | null => {
    // strip any leading path (zip entries can be 'apr/Q5a.csv' on some platforms)
    const hit = files.find((f) => rx.test(stripPath(f.name)));
    return hit ?? null;
  };

  const result = defaultProportions(fileName);

  // ---------------- Q5a — canonical totals ----------------
  // FY2026 CoC APR uses Q5a; Sage Street-Outreach APRs use Q5 (no a).
  const q5 = find(/^Q5a?\.csv$/i);
  if (q5) {
    sectionsFound.push(q5.name);
    const total = findRowValue(q5.rows, /total\s+number\s+of\s+persons|persons\s+served/i);
    if (total != null && total > 0) result.totalPersons = total;
    if ((result.totalPersons ?? 0) > 0) {
      const t = result.totalPersons!;
      const veterans = findRowValue(q5.rows, /number\s+of\s+veterans/i) ?? 0;
      const chronic = findRowValue(q5.rows, /chronically\s+homeless\s+persons/i) ?? 0;
      const youth = findRowValue(q5.rows, /number\s+of\s+youth\s+under\s+age\s+25/i) ?? 0;
      const parentingYouth =
        findRowValue(q5.rows, /parenting\s+youth\s+under\s+age\s+25/i) ?? 0;
      result.subpopulations.veteran = clamp01(veterans / t);
      result.subpopulations.chronicallyHomeless = clamp01(chronic / t);
      result.youth.parentingYouth = clamp01(parentingYouth / t);
      // Unaccompanied youth = total youth - parenting youth (with children)
      result.youth.unaccompaniedYouth = clamp01((youth - parentingYouth) / t);
    }
  }

  // ---------------- Q8a — household composition ----------------
  // First row = "Total Households" with columns: Total, Without Children, With C&A, With Only Children
  const q8 = find(/^Q8a?\.csv$/i);
  if (q8) {
    sectionsFound.push(q8.name);
    const totalRow = q8.rows.find((r) => /total households/i.test(cleanLabel(r?.[0])));
    if (totalRow) {
      const total = toNumber(totalRow[1]) ?? 0;
      const without = toNumber(totalRow[2]) ?? 0;
      const withChildren = toNumber(totalRow[3]) ?? 0;
      const childOnly = toNumber(totalRow[4]) ?? 0;
      if (total > 0) {
        result.householdTypes = {
          adultOnly: clamp01(without / total),
          withChildren: clamp01(withChildren / total),
          childOnly: clamp01(childOnly / total),
        };
      }
    }
  }

  // ---------------- Q11 — Age (FY2026 buckets: Under 5 / 5-12 / 13-17 / ...) ----------------
  const q11 = find(/^Q11\.csv$/i);
  if (q11) {
    sectionsFound.push(q11.name);
    const buckets = {
      under_18: 0,
      '18_24': 0,
      '25_34': 0,
      '35_44': 0,
      '45_54': 0,
      '55_64': 0,
      '65_plus': 0,
    } as Record<AgeBucket, number>;
    for (const row of q11.rows) {
      const label = cleanLabel(row?.[0]);
      const value = toNumber(row?.[1]) ?? 0;
      if (!value) continue;
      if (/^under 5|^0\s*[-–]\s*4/i.test(label)) buckets.under_18 += value;
      else if (/^5\s*[-–]\s*12/i.test(label)) buckets.under_18 += value;
      else if (/^13\s*[-–]\s*17/i.test(label)) buckets.under_18 += value;
      else if (/^under\s*18/i.test(label)) buckets.under_18 += value;
      else if (/^18\s*[-–]\s*24/i.test(label)) buckets['18_24'] += value;
      else if (/^25\s*[-–]\s*34/i.test(label)) buckets['25_34'] += value;
      else if (/^35\s*[-–]\s*44/i.test(label)) buckets['35_44'] += value;
      else if (/^45\s*[-–]\s*54/i.test(label)) buckets['45_54'] += value;
      else if (/^55\s*[-–]\s*64/i.test(label)) buckets['55_64'] += value;
      else if (/^65|^65\s*\+|over\s*age\s*64|over\s*64/i.test(label)) buckets['65_plus'] += value;
    }
    result.age = normalize(buckets);
  }

  // ---------------- Q12 — Race × Ethnicity (HUD 2024 schema) ----------------
  const q12 = find(/^Q12\.csv$/i);
  if (q12) {
    sectionsFound.push(q12.name);
    const buckets: Record<RaceEthnicityBucket, number> = {
      american_indian_nh: 0,
      american_indian_h: 0,
      asian_nh: 0,
      asian_h: 0,
      black_nh: 0,
      black_h: 0,
      hispanic_only: 0,
      mena_nh: 0,
      mena_h: 0,
      nhpi_nh: 0,
      nhpi_h: 0,
      white_nh: 0,
      white_h: 0,
      multi_h: 0,
      multi_nh: 0,
    };
    for (const row of q12.rows) {
      const label = cleanLabel(row?.[0]);
      const value = toNumber(row?.[1]) ?? 0;
      if (!value) continue;
      if (/^total/i.test(label) || /doesn'?t know|prefer|data not collected/i.test(label))
        continue;
      const bucket = mapRaceEthLabel(label);
      if (bucket) buckets[bucket] += value;
    }
    result.raceEthnicity = normalize(buckets);
  }

  // ---------------- Q13a1 — Disabilities at start (SMI / SUD / HIV) ----------------
  // FY2026 CoC APR splits these as separate rows; counts are persons with that condition.
  const q13a1 = find(/^Q13a1\.csv$/i);
  if (q13a1 && (result.totalPersons ?? 0) > 0) {
    sectionsFound.push(q13a1.name);
    const t = result.totalPersons!;
    const smi = sumMatching(q13a1.rows, /mental\s+health\s+disorder/i);
    const alc = sumMatching(q13a1.rows, /alcohol\s+use\s+disorder(?!\s*$)/i);
    const drug = sumMatching(q13a1.rows, /drug\s+use\s+disorder/i);
    const both = sumMatching(q13a1.rows, /both\s+alcohol\s+and\s+drug/i);
    const hiv = sumMatching(q13a1.rows, /hiv|aids/i);
    result.subpopulations.severelyMentallyIll = clamp01(smi / t);
    result.subpopulations.substanceUseDisorder = clamp01((alc + drug + both) / t);
    result.subpopulations.hivAids = clamp01(hiv / t);
  }

  // ---------------- Q14a — Domestic Violence ----------------
  // "Yes" row, first numeric column = count with DV history. Total is at the bottom.
  const q14a = find(/^Q14a\.csv$/i);
  if (q14a && (result.totalPersons ?? 0) > 0) {
    sectionsFound.push(q14a.name);
    const t = result.totalPersons!;
    const yes = sumMatching(q14a.rows, /^yes$/i);
    result.subpopulations.domesticViolence = clamp01(yes / t);
  }

  // ---------------- Q22 fallback (Street Outreach APR variant) ----------------
  if (sectionsFound.length === 0 || result.subpopulations.severelyMentallyIll === 0) {
    const q22 = find(/^Q22/i);
    if (q22 && (result.totalPersons ?? 0) > 0) {
      sectionsFound.push(q22.name);
      const t = result.totalPersons!;
      const smi = sumMatching(
        q22.rows,
        /mental\s*(?:health|illness)|mentally ill|serious mental/i,
      );
      const sud = sumMatching(
        q22.rows,
        /substance\s*(?:use|abuse|disorder)|alcohol|drug/i,
      );
      const hiv = sumMatching(q22.rows, /hiv|aids/i);
      const dv = sumMatching(q22.rows, /domestic violence|survivor.*dv/i);
      if (smi > 0) result.subpopulations.severelyMentallyIll = clamp01(smi / t);
      if (sud > 0) result.subpopulations.substanceUseDisorder = clamp01(sud / t);
      if (hiv > 0) result.subpopulations.hivAids = clamp01(hiv / t);
      if (dv > 0) result.subpopulations.domesticViolence = clamp01(dv / t);
    }
  }

  result.sectionsFound = sectionsFound;
  return result;
}

// -----------------------------------------------------------------------------
// Q12 race/ethnicity classifier — handles the FY2024+ multi-race matrix
// -----------------------------------------------------------------------------

function mapRaceEthLabel(label: string): RaceEthnicityBucket | null {
  const l = label.toLowerCase();
  // Explicit multiracial rows.
  if (/multiracial.*more than 2 races.*one being hispanic|with one being hispanic/i.test(l)) {
    return 'multi_h';
  }
  if (/multiracial.*more than 2 races.*no option is hispanic|where no option is hispanic/i.test(l)) {
    return 'multi_nh';
  }

  const hasH = /\bhispanic|latina|latino/i.test(l);
  const hasAmInd = /american indian|alaska native|indigenous/.test(l);
  const hasAsian = /\basian\b|asian american/.test(l);
  const hasBlack = /\bblack|african american|\bafrican\b/.test(l);
  const hasMena = /middle eastern|north african|\bmena\b/.test(l);
  const hasNhpi = /native hawaiian|pacific islander/.test(l);
  const hasWhite = /\bwhite\b/.test(l);

  const races = [hasAmInd, hasAsian, hasBlack, hasMena, hasNhpi, hasWhite].filter(Boolean).length;

  // Hispanic alone (no other race).
  if (races === 0 && hasH) return 'hispanic_only';
  // Two non-Hispanic races → multi_nh
  if (races >= 2 && !hasH) return 'multi_nh';
  // Two races + hispanic — shouldn't really happen (HUD splits multi_h) but be defensive
  if (races >= 2 && hasH) return 'multi_h';
  // Single-race rows
  if (races === 1) {
    if (hasAmInd) return hasH ? 'american_indian_h' : 'american_indian_nh';
    if (hasAsian) return hasH ? 'asian_h' : 'asian_nh';
    if (hasBlack) return hasH ? 'black_h' : 'black_nh';
    if (hasMena) return hasH ? 'mena_h' : 'mena_nh';
    if (hasNhpi) return hasH ? 'nhpi_h' : 'nhpi_nh';
    if (hasWhite) return hasH ? 'white_h' : 'white_nh';
  }
  return null;
}

// -----------------------------------------------------------------------------
// Defaults (used when a Q-file is missing so the engine doesn't NaN)
// -----------------------------------------------------------------------------

function defaultProportions(fileName: string): AprProportions {
  return {
    sourceFileName: fileName,
    totalPersons: null,
    sectionsFound: [],
    age: {
      under_18: 0.02,
      '18_24': 0.08,
      '25_34': 0.16,
      '35_44': 0.20,
      '45_54': 0.22,
      '55_64': 0.22,
      '65_plus': 0.10,
    },
    raceEthnicity: {
      american_indian_nh: 0.005,
      american_indian_h: 0.005,
      asian_nh: 0.01,
      asian_h: 0.005,
      black_nh: 0.35,
      black_h: 0.10,
      hispanic_only: 0.08,
      mena_nh: 0.005,
      mena_h: 0.005,
      nhpi_nh: 0.005,
      nhpi_h: 0.005,
      white_nh: 0.18,
      white_h: 0.20,
      multi_h: 0.02,
      multi_nh: 0.02,
    },
    subpopulations: {
      veteran: 0.07,
      chronicallyHomeless: 0.28,
      severelyMentallyIll: 0.32,
      substanceUseDisorder: 0.38,
      hivAids: 0.04,
      domesticViolence: 0.12,
    },
    householdTypes: {
      adultOnly: 0.92,
      withChildren: 0.07,
      childOnly: 0.01,
    },
    youth: {
      parentingYouth: 0.01,
      unaccompaniedYouth: 0.04,
    },
  };
}

// -----------------------------------------------------------------------------
// CSV / helpers
// -----------------------------------------------------------------------------

function stripPath(p: string): string {
  const idx = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
  return idx >= 0 ? p.slice(idx + 1) : p;
}

function csvToRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuote = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuote = true;
    } else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\r') {
      // ignore
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * Strip the literal surrounding quotes Sage puts on label cells (CSVs use
 * triple-double-quote escaping, so even after parsing a label often arrives
 * as `"Label"` with quote characters at both ends).
 */
function cleanLabel(s: string | undefined): string {
  if (!s) return '';
  return String(s).replace(/^["'\s]+|["'\s]+$/g, '');
}

/** Find first row whose first column matches `labelRx`, return the first numeric cell after col 0. */
function findRowValue(rows: string[][], labelRx: RegExp): number | null {
  for (const r of rows) {
    if (!r) continue;
    const label = cleanLabel(r[0]);
    if (labelRx.test(label)) {
      for (let c = 1; c < r.length; c++) {
        const n = toNumber(r[c]);
        if (n != null) return n;
      }
    }
  }
  return null;
}

/** Sum the first-numeric-column across every row whose label matches `labelRx`. */
function sumMatching(rows: string[][], labelRx: RegExp): number {
  let sum = 0;
  for (const r of rows) {
    if (!r) continue;
    const label = cleanLabel(r[0]);
    if (labelRx.test(label)) {
      for (let c = 1; c < r.length; c++) {
        const n = toNumber(r[c]);
        if (n != null) {
          sum += n;
          break;
        }
      }
    }
  }
  return sum;
}

function normalize<K extends string>(values: Record<K, number>): Record<K, number> {
  const nums = Object.values(values) as number[];
  const sum = nums.reduce((a, b) => a + b, 0);
  if (sum <= 0) return values;
  const out = { ...values };
  for (const k of Object.keys(out) as K[]) {
    out[k] = out[k] / sum;
  }
  return out;
}

function toNumber(v: string | undefined): number | null {
  if (v == null) return null;
  const s = String(v).replace(/,/g, '').replace(/^"+|"+$/g, '').trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
