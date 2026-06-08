import * as XLSX from 'xlsx';
import { ALL_PIT_VARIABLES, METADATA_VARIABLES } from './pitVariables.generated';
import type { ExtrapolatedValues } from './extrapolator';
import type { Tables } from '@/lib/database.types';

export interface PitExcelInput {
  /** Calculated values keyed by template variable name. */
  values: ExtrapolatedValues;
  event: Tables<'count_events'>;
  /** CoC code, defaults to FL-600 (Miami-Dade) */
  cocCode?: string;
  /** HUD assignment / submitter id if known. */
  hudNum?: string;
}

const TEMPLATE_URL = '/PIT_Summary_Report_Template.xlsx';

/**
 * Fetches the HUD PIT Summary Report Template, fills the `PitRawData` sheet
 * with our variables, and returns the modified workbook as a Blob for download.
 *
 * The template's other sheets contain INDEX/MATCH formulas that lookup variable
 * names in PitRawData row 1 → values in row 3. We populate both rows.
 */
export async function buildPitExcel(input: PitExcelInput): Promise<Blob> {
  const resp = await fetch(TEMPLATE_URL);
  if (!resp.ok) throw new Error(`Could not load HUD template (HTTP ${resp.status}).`);
  const buffer = await resp.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellStyles: true, cellFormula: true });

  const raw = wb.Sheets['PitRawData'];
  if (!raw) throw new Error('Template missing the PitRawData sheet.');

  // Build the full variable map: metadata + every Unsheltered variable we have.
  const metadata: Record<string, string | number> = {
    State: 'FL',
    CoC: input.cocCode ?? 'FL-600',
    HudNum: input.hudNum ?? '',
    Status: 'Submitted',
    year: input.event.count_date.slice(0, 4),
    submittedOn: new Date().toISOString().slice(0, 10),
    'Date of Count': input.event.count_date,
    Populations: 'Unsheltered',
    updatedOn: new Date().toISOString().slice(0, 10),
  };

  // Write variable headers + values across PitRawData row 1 and row 3.
  let col = 0;
  const writeCell = (row: number, c: number, value: string | number) => {
    const ref = XLSX.utils.encode_cell({ r: row, c });
    raw[ref] = { t: typeof value === 'number' ? 'n' : 's', v: value };
  };

  // Order: metadata first, then all template variables. We write every
  // template variable so the template sees the unique-count match (it has a
  // self-check at DO_NOT_EDIT R12-R15). Sheltered vars get value 0.
  const ordered = [...METADATA_VARIABLES, ...ALL_PIT_VARIABLES.filter((v) => !METADATA_VARIABLES.includes(v))];
  for (const name of ordered) {
    writeCell(0, col, name); // row 1 = name header
    const meta = metadata[name];
    if (meta !== undefined) {
      writeCell(2, col, meta);
    } else if (input.values[name] !== undefined) {
      writeCell(2, col, input.values[name]);
    } else if (/Unsheltered/i.test(name)) {
      // Unsheltered variable we didn't compute — leave blank so it shows "NO DATA".
      // (Skip — don't write anything.)
    } else {
      // Sheltered variable — set to 0 (we're an unsheltered-only count).
      writeCell(2, col, 0);
    }
    col += 1;
  }

  // Update the sheet range to reflect our new content.
  raw['!ref'] = XLSX.utils.encode_range({
    s: { c: 0, r: 0 },
    e: { c: col - 1, r: 2 },
  });

  // Force formulas to recalc when Excel opens the file.
  // (Type cast — SheetJS' WBProps type omits CalcPr but Excel honors it.)
  if (!wb.Workbook) wb.Workbook = {};
  (wb.Workbook as unknown as { CalcPr: { fullCalcOnLoad: boolean } }).CalcPr = {
    fullCalcOnLoad: true,
  };

  const out = XLSX.write(wb, {
    type: 'array',
    bookType: 'xlsx',
    cellStyles: true,
  });
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
