import type { HotspotType, Severity } from './database.types';

export interface ParsedHotspotRow {
  /** Original line from the paste. */
  raw: string;
  /** The full text used for geocoding (address + parenthetical landmark removed). */
  address: string;
  /** Human-friendly name — uses the parenthetical landmark when present, otherwise the address. */
  name: string;
  description: string | null;
  hotspot_type: HotspotType;
  severity: Severity;
  source: string | null;
  /** Police forms ship a "# of persons observed" column — captured here when present. */
  expected_count: number | null;
}

/**
 * Best-effort parser for blocks of text pasted from police / outreach intel.
 *
 * Handles common shapes:
 *   - Plain addresses: "1234 NW 8th St, Miami FL"
 *   - Address with landmark in parens: "19507 Biscayne Blvd (Nordstrom Garage)"
 *   - Tab-separated (table copy from Excel/Word):
 *       "19507 Biscayne Blvd (Nordstrom Garage)\t20"
 *   - Pipe-separated: "1234 NW 8th St | encampment | high | MDPD"
 *   - Em-dash / hyphen note: "1234 NW 8th St — often 3-5 persons observed"
 *   - Trailing slash sub-location: "Aventura Blvd (Library) / & Bus stop on East side"
 *
 * Blank lines and lines starting with `#` are ignored. Lines that don't contain
 * any digit (likely paragraph noise) are also ignored to make full-document
 * pastes more forgiving.
 */
export function parsePastedHotspots(input: string): ParsedHotspotRow[] {
  return input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && /\d/.test(l))
    .map(parseLine);
}

function parseLine(raw: string): ParsedHotspotRow {
  // Choose a delimiter for splitting the line into pieces. Prefer the strongest
  // signal: a tab character (table copy) → pipes → em/en-dash → ` - `.
  let parts: string[] = [];
  if (raw.includes('\t')) parts = raw.split('\t').map((p) => p.trim());
  else if (raw.includes('|')) parts = raw.split('|').map((p) => p.trim());
  else if (/[—–]/.test(raw)) parts = raw.split(/[—–]/).map((p) => p.trim());
  else if (/\s-\s/.test(raw)) parts = raw.split(/\s-\s/).map((p) => p.trim());
  else parts = [raw.trim()];

  let addressLine = parts.shift() ?? '';

  // Extract "/ trailing note" off the address line.
  let slashTrailing: string | null = null;
  const slashSplit = addressLine.split(/\s*\/\s*/);
  if (slashSplit.length > 1) {
    addressLine = slashSplit[0].trim();
    slashTrailing = slashSplit.slice(1).join(' / ').trim() || null;
  }

  // Extract parenthetical landmark for a cleaner display name. Keep the full
  // address (without parens) for geocoding.
  let landmark: string | null = null;
  const parenMatch = addressLine.match(/^(.*?)\s*\(([^)]+)\)\s*(.*)$/);
  let addressForGeocode = addressLine;
  if (parenMatch) {
    const [, before, inner, after] = parenMatch;
    landmark = inner.trim();
    addressForGeocode = `${before.trim()} ${after.trim()}`.replace(/\s+/g, ' ').trim();
    if (!addressForGeocode) addressForGeocode = addressLine;
  }

  let type: HotspotType = 'sighting';
  let severity: Severity = 'medium';
  let severityExplicit = false;
  let source: string | null = null;
  let expectedCount: number | null = null;
  const noteFragments: string[] = [];

  for (const piece of parts) {
    if (!piece) continue;

    // Trailing standalone integer = "# of persons observed".
    const intMatch = piece.match(/^\s*(\d+)\s*$/);
    if (intMatch) {
      expectedCount = parseInt(intMatch[1], 10);
      continue;
    }

    const detectedType = matchType(piece);
    const detectedSeverity = matchSeverity(piece);
    const detectedSource = matchSource(piece);

    const wholePieceIsSeverity = detectedSeverity && piece.trim().length <= 8;
    const wholePieceIsType = detectedType && piece.trim().length <= 12;
    const wholePieceIsSource = detectedSource && piece.trim().length <= 12;

    if (wholePieceIsSeverity) {
      severity = detectedSeverity;
      severityExplicit = true;
      continue;
    }
    if (wholePieceIsType) {
      type = detectedType;
      continue;
    }
    if (wholePieceIsSource) {
      source = detectedSource;
      continue;
    }

    // Longer pieces: still infer type/source from any keyword present, but
    // keep the piece as description text.
    if (detectedType) type = detectedType;
    if (detectedSource && !source) source = detectedSource;
    noteFragments.push(piece);
  }

  if (slashTrailing) noteFragments.unshift(slashTrailing);

  // Auto-derive severity from expected_count when caller didn't pick one.
  if (!severityExplicit && expectedCount != null) {
    severity = severityFromCount(expectedCount);
  }

  return {
    raw,
    address: addressForGeocode,
    name: landmark ?? addressForGeocode,
    description: noteFragments.length ? noteFragments.join(' · ') : null,
    hotspot_type: type,
    severity,
    source,
    expected_count: expectedCount,
  };
}

function severityFromCount(n: number): Severity {
  if (n <= 2) return 'low';
  if (n <= 9) return 'medium';
  return 'high';
}

function matchType(s: string): HotspotType | null {
  const lower = s.toLowerCase();
  if (/\b(encampment|camp|tent)\b/.test(lower)) return 'encampment';
  if (/\b(hazard|danger|caution|aggressive|unsafe)\b/.test(lower)) return 'hazard';
  if (/\b(resource|shelter|services|food|outreach point)\b/.test(lower)) return 'resource';
  if (/\b(sighting|observed|seen|frequent)\b/.test(lower)) return 'sighting';
  return null;
}

function matchSeverity(s: string): Severity | null {
  const lower = s.toLowerCase().trim();
  if (lower === 'low' || lower === 'lo') return 'low';
  if (lower === 'medium' || lower === 'med' || lower === 'm') return 'medium';
  if (lower === 'high' || lower === 'hi' || lower === 'h') return 'high';
  return null;
}

function matchSource(s: string): string | null {
  const lower = s.toLowerCase();
  if (/\b(mdpd|police|pd|miami pd|city police)\b/.test(lower)) return 'MDPD';
  if (/\b(outreach|provider|caseworker)\b/.test(lower)) return 'Outreach';
  if (/\b(volunteer|crew)\b/.test(lower)) return 'Volunteer';
  return null;
}
