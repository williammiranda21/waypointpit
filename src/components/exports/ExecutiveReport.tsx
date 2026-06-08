import { useEffect } from 'react';
import type { Tables } from '@/lib/database.types';
import type { ExtrapolationResult } from '@/lib/exports/extrapolator';

interface ExecutiveReportProps {
  event: Tables<'count_events'>;
  extrapolation: ExtrapolationResult;
  zones: Tables<'zones'>[];
  submissions: Tables<'submissions'>[];
  /** Auto-trigger window.print() once the component mounts. */
  autoPrint?: boolean;
}

/**
 * Print-friendly executive report. Renders an A4-shaped layout that prints
 * via the browser's "Save as PDF" flow — no extra PDF library needed.
 */
export function ExecutiveReport({
  event,
  extrapolation,
  zones,
  submissions,
  autoPrint,
}: ExecutiveReportProps) {
  useEffect(() => {
    if (autoPrint) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [autoPrint]);

  const { diagnostics, aggregates } = extrapolation;
  const N = diagnostics.totalPersons;

  // Per-zone person counts
  const zoneTotals = new Map<string, number>();
  for (const s of submissions) {
    zoneTotals.set(s.zone_id, (zoneTotals.get(s.zone_id) ?? 0) + s.person_count);
  }
  const zoneRows = zones
    .map((z) => ({
      name: z.name,
      count: zoneTotals.get(z.id) ?? 0,
      status: z.status,
    }))
    .sort((a, b) => b.count - a.count);

  const ageRows = AGE_ORDER.map((k) => ({ label: AGE_LABEL[k], value: aggregates.age[k] }));
  const reRows = RE_ORDER.map((k) => ({ label: RE_LABEL[k], value: aggregates.raceEthnicity[k] }));
  const subpops: Array<{ label: string; value: number }> = [
    { label: 'Veterans', value: Math.round(N * aggregates.subpops.veteran) },
    { label: 'Chronically Homeless', value: Math.round(N * aggregates.subpops.chronicallyHomeless) },
    { label: 'Severely Mentally Ill', value: Math.round(N * aggregates.subpops.severelyMentallyIll) },
    { label: 'Substance Use Disorder', value: Math.round(N * aggregates.subpops.substanceUseDisorder) },
    { label: 'HIV / AIDS', value: Math.round(N * aggregates.subpops.hivAids) },
    { label: 'Survivors of Domestic Violence', value: Math.round(N * aggregates.subpops.domesticViolence) },
  ];

  return (
    <div className="bg-white text-gray-900">
      <style>{PRINT_CSS}</style>
      <div className="print-page mx-auto max-w-[8.5in] px-10 py-8 text-[12px] leading-relaxed">
        {/* Cover */}
        <div className="border-b border-gray-300 pb-4 mb-6">
          <p className="text-[10px] uppercase tracking-widest text-gray-500">
            FL-600 · Miami-Dade County Homeless Trust
          </p>
          <h1 className="text-3xl font-bold tracking-tight mt-1">
            Executive Report — Unsheltered PIT Count
          </h1>
          <p className="mt-2 text-sm text-gray-700">
            <strong>{event.name}</strong> · Count Date{' '}
            {formatLongDate(event.count_date)} · Generated{' '}
            {new Date().toLocaleString()}
          </p>
        </div>

        {/* Headline stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <Stat label="Total Persons" value={N.toLocaleString()} tone="emerald" />
          <Stat label="Submissions" value={diagnostics.totalSubmissions.toLocaleString()} tone="blue" />
          <Stat label="Surveys" value={diagnostics.surveysCount.toLocaleString()} tone="amber" />
          <Stat label="Zones" value={zones.length.toString()} tone="purple" />
        </div>

        {/* Method note */}
        <Section title="Methodology">
          <p>
            Counts reflect the Waypoint PIT Unsheltered Count for{' '}
            <strong>{event.name}</strong>. {diagnostics.surveyedPersons} of {N} persons
            ({pct(diagnostics.surveyedPersons, N)}) were fully surveyed; the remaining{' '}
            {diagnostics.tallyOnlyPersons} were tally-only.
          </p>
          <p>
            Demographic estimates for tally-only and partial submissions are
            extrapolated from the Continuum's Street Outreach APR
            (<code className="font-mono">{diagnostics.source}</code>), which provides
            HUD-compliant proportions for age, gender, race/ethnicity, household type,
            and subpopulation incidence. The APR file is not retained by Waypoint.
          </p>
        </Section>

        {/* Zones */}
        <Section title="Coverage by Zone">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-300">
                <Th>Zone</Th>
                <Th align="right">Persons</Th>
                <Th align="right">% of Total</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {zoneRows.map((z) => (
                <tr key={z.name} className="border-b border-gray-100">
                  <Td>{z.name}</Td>
                  <Td align="right">{z.count}</Td>
                  <Td align="right">{pct(z.count, N)}</Td>
                  <Td className="capitalize text-gray-600">{z.status.replace('_', ' ')}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Page break */}
        <div className="page-break" />

        {/* Demographics */}
        <Section title="Demographic Estimates">
          <DemoTable title="Age" rows={ageRows} total={N} />
          <div className="mt-4">
            <DemoTable title="Race & Ethnicity" rows={reRows} total={N} dense />
          </div>
        </Section>

        {/* Households */}
        <Section title="Household Composition">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-300">
                <Th>Household Type</Th>
                <Th align="right">Estimate</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <Td>Adults Only</Td>
                <Td align="right">{Math.round(aggregates.households.adultOnly)}</Td>
              </tr>
              <tr className="border-b border-gray-100">
                <Td>At Least One Adult and One Child</Td>
                <Td align="right">{Math.round(aggregates.households.withChildren)}</Td>
              </tr>
              <tr className="border-b border-gray-100">
                <Td>Children Only</Td>
                <Td align="right">{Math.round(aggregates.households.childOnly)}</Td>
              </tr>
              <tr className="border-b border-gray-100">
                <Td>Unaccompanied Youth</Td>
                <Td align="right">{Math.round(aggregates.youth.unaccompaniedYouth)}</Td>
              </tr>
              <tr className="border-b border-gray-100">
                <Td>Parenting Youth</Td>
                <Td align="right">{Math.round(aggregates.youth.parentingYouth)}</Td>
              </tr>
            </tbody>
          </table>
        </Section>

        {/* Subpopulations */}
        <Section title="Subpopulations">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-gray-300">
                <Th>Subpopulation</Th>
                <Th align="right">Estimate</Th>
                <Th align="right">% of Adults</Th>
              </tr>
            </thead>
            <tbody>
              {subpops.map((s) => (
                <tr key={s.label} className="border-b border-gray-100">
                  <Td>{s.label}</Td>
                  <Td align="right">{s.value}</Td>
                  <Td align="right">{pct(s.value, N)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        {/* Footer */}
        <div className="mt-8 pt-3 border-t border-gray-300 text-[10px] text-gray-500">
          <p>
            Generated by Waypoint PIT · Miami-Dade County Homeless Trust ·{' '}
            FL-600 Continuum of Care · {new Date().toISOString().slice(0, 10)}
          </p>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Bits
// -----------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-[15px] font-semibold mb-2 border-b border-gray-200 pb-1">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'emerald' | 'blue' | 'amber' | 'purple';
}) {
  const toneClasses: Record<typeof tone, string> = {
    emerald: 'border-emerald-300 bg-emerald-50',
    blue: 'border-blue-300 bg-blue-50',
    amber: 'border-amber-300 bg-amber-50',
    purple: 'border-purple-300 bg-purple-50',
  };
  return (
    <div className={`border rounded-md px-3 py-2 ${toneClasses[tone]}`}>
      <p className="text-[9px] uppercase tracking-widest text-gray-600">{label}</p>
      <p className="text-2xl font-bold leading-tight mt-1">{value}</p>
    </div>
  );
}

function Th({
  children,
  align,
  className = '',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <th
      className={`py-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-600 ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className = '',
}: {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  return (
    <td className={`py-1.5 px-2 ${align === 'right' ? 'text-right' : ''} ${className}`}>
      {children}
    </td>
  );
}

function DemoTable({
  title,
  rows,
  total,
  dense,
}: {
  title: string;
  rows: Array<{ label: string; value: number }>;
  total: number;
  dense?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold mb-1">{title}</p>
      <table className="w-full text-[11px]">
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-gray-100">
              <Td className={dense ? 'py-1' : ''}>{r.label}</Td>
              <Td align="right" className={dense ? 'py-1' : ''}>{Math.round(r.value)}</Td>
              <Td align="right" className={`text-gray-500 ${dense ? 'py-1' : ''}`}>
                {pct(Math.round(r.value), total)}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Labels & helpers
// -----------------------------------------------------------------------------

const AGE_ORDER = ['under_18', '18_24', '25_34', '35_44', '45_54', '55_64', '65_plus'] as const;
const AGE_LABEL: Record<(typeof AGE_ORDER)[number], string> = {
  under_18: 'Under 18',
  '18_24': '18–24',
  '25_34': '25–34',
  '35_44': '35–44',
  '45_54': '45–54',
  '55_64': '55–64',
  '65_plus': '65+',
};

const RE_ORDER = [
  'american_indian_nh', 'american_indian_h',
  'asian_nh', 'asian_h',
  'black_nh', 'black_h',
  'hispanic_only',
  'mena_nh', 'mena_h',
  'nhpi_nh', 'nhpi_h',
  'white_nh', 'white_h',
  'multi_h', 'multi_nh',
] as const;
const RE_LABEL: Record<(typeof RE_ORDER)[number], string> = {
  american_indian_nh: 'American Indian / Indigenous (only)',
  american_indian_h: 'American Indian / Indigenous & Hispanic',
  asian_nh: 'Asian (only)',
  asian_h: 'Asian & Hispanic',
  black_nh: 'Black / African American (only)',
  black_h: 'Black / African American & Hispanic',
  hispanic_only: 'Hispanic / Latino (only)',
  mena_nh: 'MENA (only)',
  mena_h: 'MENA & Hispanic',
  nhpi_nh: 'Native Hawaiian / Pacific Islander (only)',
  nhpi_h: 'NHPI & Hispanic',
  white_nh: 'White (only)',
  white_h: 'White & Hispanic',
  multi_h: 'Multi-Racial & Hispanic',
  multi_nh: 'Multi-Racial (all other)',
};

function pct(part: number, whole: number): string {
  if (!whole) return '—';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const PRINT_CSS = `
  @media print {
    @page { size: letter; margin: 0.5in; }
    .no-print { display: none !important; }
    .page-break { break-before: page; }
    body { background: white !important; }
  }
  @media screen {
    .print-page { box-shadow: 0 0 0 1px rgba(0,0,0,0.08), 0 4px 20px rgba(0,0,0,0.06); margin-top: 1rem; margin-bottom: 1rem; }
    .page-break { display: none; }
  }
`;
