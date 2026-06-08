// Import from the bare /client entry to skip the SDK's Node-only tool-runner
// helpers (fs-util.mjs pulls in node:crypto/randomUUID which Vite can't bundle).
// We only need the Anthropic client + Messages resource.
import { Anthropic } from '@anthropic-ai/sdk/client';
import type { BoundaryAggregate } from '@/lib/analytics';
import type { EventTotals, NotesTheme, Submission } from '@/lib/analytics';

export type InsightSource = 'demo-canned' | 'claude-haiku-4-5' | 'claude-sonnet-4-6';

export interface InsightResult {
  source: InsightSource;
  /** Markdown-ish bullets / paragraphs. Newline-delimited. */
  text: string;
}

// -----------------------------------------------------------------------------
// AI transport — proxy (production) or browser-direct (local dev)
//
// PRODUCTION: set VITE_AI_PROXY=/api/insight at build time. Calls route through
// the Vercel serverless function (api/insight.ts), which holds ANTHROPIC_API_KEY
// server-side — the key never reaches the browser.
//
// LOCAL DEV (no proxy): falls back to a key stored in localStorage and calls
// Anthropic directly via `dangerouslyAllowBrowser`. That key is visible to
// anything in the page — acceptable only for a single developer testing locally.
// -----------------------------------------------------------------------------

const AI_KEY_STORAGE = 'waypoint-pit-anthropic-key';

/** Proxy endpoint when configured at build time, else null (browser-direct). */
function aiProxyUrl(): string | null {
  const u = import.meta.env.VITE_AI_PROXY;
  return typeof u === 'string' && u.length > 0 ? u : null;
}

/** True when calls route through the server-side proxy (key never in browser). */
export function isAiProxyMode(): boolean {
  return !!aiProxyUrl();
}

export function getStoredApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AI_KEY_STORAGE);
}

export function setStoredApiKey(key: string | null): void {
  if (typeof window === 'undefined') return;
  if (!key) window.localStorage.removeItem(AI_KEY_STORAGE);
  else window.localStorage.setItem(AI_KEY_STORAGE, key);
}

export function isAiConfigured(): boolean {
  return isAiProxyMode() || !!getStoredApiKey();
}

// -----------------------------------------------------------------------------
// Claude client + prompts
// -----------------------------------------------------------------------------

const MODEL_NARRATIVE = 'claude-sonnet-4-6';
const MODEL_NOTES = 'claude-haiku-4-5';

function getClient(): Anthropic | null {
  const key = getStoredApiKey();
  if (!key) return null;
  // Browser-direct fallback for local dev only — see transport note above.
  return new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
}

/** Params shape shared by the proxy and browser-direct paths. */
interface MessageParams {
  model: string;
  max_tokens: number;
  system:
    | string
    | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }>;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/** Minimal response shape — both transports return Anthropic's message JSON. */
interface MinimalMessage {
  content: Array<{ type: string; text?: string }>;
}

/**
 * Send a Messages request via the proxy (production) or the browser-direct
 * client (local dev). Throws if neither transport is available.
 */
async function runMessage(params: MessageParams): Promise<MinimalMessage> {
  const proxy = aiProxyUrl();
  if (proxy) {
    const res = await fetch(proxy, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`AI proxy error ${res.status}: ${detail.slice(0, 200)}`);
    }
    return (await res.json()) as MinimalMessage;
  }

  const client = getClient();
  if (!client) throw new Error('AI not configured');
  return (await client.messages.create(
    params as Parameters<typeof client.messages.create>[0],
  )) as unknown as MinimalMessage;
}

function extractText(msg: MinimalMessage): string {
  return msg.content
    .filter((b): b is { type: string; text: string } => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('\n');
}

const ANALYST_ROLE = `You are a senior data analyst for the Miami-Dade County Homeless Trust, FL-600 Continuum of Care. You analyze Point-in-Time (PIT) unsheltered count data to brief the Trust's coordinator and HUD submitters.

Style guide:
- Lead with the headline number. Be concrete and specific.
- Use **bold** for the most important figures, place names, and shifts.
- Bulleted lists when listing 3+ items.
- 80-180 words per insight. Don't pad. Don't say "this analysis shows" — just show it.
- Never invent numbers. If the data is sparse (e.g. only 2 submissions), say so plainly.
- Never speculate about causes you can't see in the data. Stick to what the numbers say.

The dataset context block below contains every event the user has selected, with per-event totals and per-zone aggregates. Use only the numbers in that block.`;

/**
 * Shared dataset context — placed in the system prompt with cache_control so
 * follow-up Generate clicks within the same session reuse the cached prefix.
 */
function buildDatasetContext(input: SharedInsightContext): string {
  const lines: string[] = [];
  lines.push('# Selected events');
  for (const e of input.events) {
    lines.push(
      `- **${e.eventName}** (${e.countDate}): ${e.totalPersons} persons across ${e.submissionCount} submission${e.submissionCount === 1 ? '' : 's'} (${e.surveyCount} survey${e.surveyCount === 1 ? '' : 's'}).`,
    );
    const locEntries = Object.entries(e.perLocationType).filter(([, v]) => v > 0);
    if (locEntries.length > 0) {
      lines.push(
        `  - By location type: ${locEntries.map(([k, v]) => `${k}=${v}`).join(', ')}`,
      );
    }
    const zoneEntries = Object.entries(e.perZone).filter(([, v]) => v > 0);
    if (zoneEntries.length > 0) {
      lines.push(`  - By zone: ${zoneEntries.map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }
  }
  return lines.join('\n');
}

export interface SharedInsightContext {
  events: EventTotals[];
}

async function callClaudeNarrative(input: {
  sharedContext: SharedInsightContext;
  taskTitle: string;
  taskInstruction: string;
}): Promise<InsightResult> {
  const response = await runMessage({
    model: MODEL_NARRATIVE,
    max_tokens: 600,
    system: [
      { type: 'text', text: ANALYST_ROLE },
      {
        type: 'text',
        text: buildDatasetContext(input.sharedContext),
        // Cache the dataset block so flipping between Heatmap / By-Layer /
        // Over-Time within ~5 minutes reads the same cached prefix.
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `# Task: ${input.taskTitle}\n\n${input.taskInstruction}`,
      },
    ],
  });

  return { source: MODEL_NARRATIVE, text: extractText(response) };
}

/**
 * Notes synthesis via Haiku — cheap pass over the raw volunteer notes to
 * surface recurring themes. Called by the trend explanation; the result is
 * woven into the Sonnet prompt.
 */
async function synthesizeNotesWithHaiku(submissions: Submission[]): Promise<string | null> {
  if (!isAiConfigured()) return null;
  const notes = submissions
    .map((s) => s.notes?.trim())
    .filter((n): n is string => !!n);
  if (notes.length === 0) return null;

  const response = await runMessage({
    model: MODEL_NOTES,
    max_tokens: 200,
    system:
      'You synthesize free-form volunteer observation notes from a homeless PIT count into 2-4 short themes. Output one theme per line, prefixed with "- ". No preamble, no closing remarks.',
    messages: [
      {
        role: 'user',
        content: `Observations:\n\n${notes.map((n, i) => `${i + 1}. ${n}`).join('\n')}`,
      },
    ],
  });

  return extractText(response).trim();
}

// -----------------------------------------------------------------------------
// Public generators — each tries Claude first, falls back to demo-canned text
// if no API key is configured or the call fails.
// -----------------------------------------------------------------------------

export interface HeatmapInsightInput {
  events: EventTotals[];
  topZones: Array<{ name: string; count: number }>;
}

export async function generateHeatmapNarrative(
  input: HeatmapInsightInput,
): Promise<InsightResult> {
  if (isAiConfigured()) {
    try {
      const top = input.topZones
        .slice(0, 8)
        .map((z) => `${z.name} (${z.count})`)
        .join(', ');
      return await callClaudeNarrative({
        sharedContext: { events: input.events },
        taskTitle: 'Heatmap narrative',
        taskInstruction: `Where is the unsheltered count concentrated in the selected events? Use the dataset above. The top zones by person count are: ${top || '(none)'}.\n\nLead with the total persons and how many events. Highlight 2-3 concentrations with specific percentages. Close with a one-line trend observation if more than one event is selected.`,
      });
    } catch (e) {
      console.warn('[ai] Claude call failed, falling back to demo-canned:', e);
    }
  }
  return demoHeatmapNarrative(input);
}

export interface ChoroplethInsightInput {
  layerLabel: string;
  aggregates: BoundaryAggregate[];
  /** Selected events for dataset context — keeps the cache prefix stable across modes. */
  events: EventTotals[];
}

export async function generateChoroplethAnomalies(
  input: ChoroplethInsightInput,
): Promise<InsightResult> {
  if (isAiConfigured()) {
    try {
      const nonEmpty = input.aggregates.filter((a) => a.personCount > 0);
      const summary = nonEmpty
        .sort((a, b) => b.personCount - a.personCount)
        .slice(0, 12)
        .map(
          (a) =>
            `${a.feature.name}: ${a.personCount} persons (${a.submissionCount} submissions)`,
        )
        .join('\n');
      return await callClaudeNarrative({
        sharedContext: { events: input.events },
        taskTitle: 'Choropleth anomalies',
        taskInstruction: `Layer: **${input.layerLabel}**. ${nonEmpty.length} of ${input.aggregates.length} polygons have submissions. Per-polygon counts (top 12):\n\n${summary || '(no polygons with data)'}\n\nIdentify outliers (polygons significantly above the mean), note where coverage is sparse, and call out the single most-covered polygon. Compute the mean from the numbers given.`,
      });
    } catch (e) {
      console.warn('[ai] Claude call failed, falling back to demo-canned:', e);
    }
  }
  return demoChoroplethAnomalies(input);
}

export interface TrendInsightInput {
  events: EventTotals[];
  topThemes: NotesTheme[];
  submissions: Submission[];
}

export async function generateTrendExplanation(
  input: TrendInsightInput,
): Promise<InsightResult> {
  if (isAiConfigured()) {
    try {
      // Cheap notes-synthesis pass with Haiku — woven into the Sonnet prompt.
      const aiThemes = await synthesizeNotesWithHaiku(input.submissions);
      const themesBlock =
        aiThemes ??
        input.topThemes
          .slice(0, 8)
          .map((t) => `- ${t.term} (${t.count})`)
          .join('\n');

      const sorted = [...input.events].sort((a, b) =>
        a.countDate.localeCompare(b.countDate),
      );
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const deltaLine =
        first && last && first.eventId !== last.eventId
          ? `From **${first.eventName}** (${first.totalPersons} persons) to **${last.eventName}** (${last.totalPersons} persons): change of ${last.totalPersons - first.totalPersons}.`
          : 'Only one event selected.';

      return await callClaudeNarrative({
        sharedContext: { events: input.events },
        taskTitle: 'Trend explanation',
        taskInstruction: `${deltaLine}\n\nVolunteer-notes themes (synthesized):\n${themesBlock || '(no notes)'}\n\nProvide: (1) the trend direction and magnitude with percentages when there's a prior baseline, (2) the 2-3 biggest shifts by location type, (3) any recurring themes from the notes that align with the trend. If only one event is selected, focus on the composition of that event instead.`,
      });
    } catch (e) {
      console.warn('[ai] Claude call failed, falling back to demo-canned:', e);
    }
  }
  return demoTrendExplanation(input);
}

// -----------------------------------------------------------------------------
// Demo-canned fallbacks — also used when no API key is configured.
// These compute text from the same inputs the Claude path receives, so the
// panel is useful even without an API key.
// -----------------------------------------------------------------------------

function demoHeatmapNarrative(input: HeatmapInsightInput): InsightResult {
  const { events, topZones } = input;
  const totalPersons = events.reduce((sum, e) => sum + e.totalPersons, 0);
  const totalSubs = events.reduce((sum, e) => sum + e.submissionCount, 0);
  const eventList = events.map((e) => e.eventName).join(', ');
  const top = topZones.slice(0, 3);

  const lines: string[] = [];
  lines.push(
    `**${totalPersons} persons** counted across ${totalSubs} submission${totalSubs === 1 ? '' : 's'} in ${events.length} event${events.length === 1 ? '' : 's'} (${eventList}).`,
  );
  if (top.length > 0) {
    lines.push('');
    lines.push('Density is concentrated in:');
    for (const z of top) {
      const pct = totalPersons > 0 ? Math.round((z.count / totalPersons) * 100) : 0;
      lines.push(`- **${z.name}** — ${z.count} persons (${pct}%)`);
    }
  }
  if (events.length >= 2) {
    const sorted = [...events].sort((a, b) => a.countDate.localeCompare(b.countDate));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const delta = last.totalPersons - first.totalPersons;
    const dir = delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'stayed flat';
    lines.push('');
    lines.push(
      `Trend: from **${first.eventName}** to **${last.eventName}**, total counts ${dir} by ${Math.abs(delta)}.`,
    );
  }
  return { source: 'demo-canned', text: lines.join('\n') };
}

function demoChoroplethAnomalies(input: ChoroplethInsightInput): InsightResult {
  const { layerLabel, aggregates } = input;
  const nonEmpty = aggregates.filter((a) => a.personCount > 0);
  if (nonEmpty.length === 0) {
    return {
      source: 'demo-canned',
      text:
        `No submissions fell inside any **${layerLabel}** polygon for the selected events. ` +
        `If the layer is expected to cover the field area, double-check the boundary set.`,
    };
  }
  const sorted = [...nonEmpty].sort((a, b) => b.personCount - a.personCount);
  const totals = nonEmpty.reduce((s, a) => s + a.personCount, 0);
  const top = sorted[0];
  const med = sorted[Math.floor(sorted.length / 2)];
  const mean = totals / nonEmpty.length;
  const stddev = Math.sqrt(
    nonEmpty.reduce((s, a) => s + Math.pow(a.personCount - mean, 2), 0) / nonEmpty.length,
  );
  const anomalies = sorted.filter((a) => a.personCount > mean + stddev * 1.5);

  const lines: string[] = [];
  lines.push(
    `**${layerLabel}**: ${nonEmpty.length} of ${aggregates.length} polygons have submissions. Median ${med.personCount} persons; mean ${mean.toFixed(1)}.`,
  );
  if (anomalies.length > 0) {
    lines.push('');
    lines.push(`**Outliers** (more than 1.5σ above mean):`);
    for (const a of anomalies.slice(0, 4)) {
      const pct = Math.round((a.personCount / totals) * 100);
      lines.push(
        `- **${a.feature.name}** — ${a.personCount} persons (${pct}% of layer total, ${a.submissionCount} submissions)`,
      );
    }
  } else {
    lines.push('');
    lines.push('No strong outliers — counts are roughly evenly distributed across populated polygons.');
  }
  lines.push('');
  lines.push(`Most-covered polygon: **${top.feature.name}** (${top.personCount} persons).`);
  return { source: 'demo-canned', text: lines.join('\n') };
}

function demoTrendExplanation(input: TrendInsightInput): InsightResult {
  const { events, topThemes } = input;
  if (events.length < 2) {
    return {
      source: 'demo-canned',
      text: 'Select two or more events to see a trend explanation.',
    };
  }
  const sorted = [...events].sort((a, b) => a.countDate.localeCompare(b.countDate));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const delta = last.totalPersons - first.totalPersons;
  const hasBase = first.totalPersons > 0;
  const pct = hasBase ? (delta / first.totalPersons) * 100 : null;
  const dir = delta > 0 ? 'rose' : delta < 0 ? 'fell' : 'held steady';

  // Compare location-type composition
  const locDeltas: Array<{ type: string; delta: number }> = [];
  const allTypes = new Set([
    ...Object.keys(first.perLocationType),
    ...Object.keys(last.perLocationType),
  ]);
  for (const t of allTypes) {
    locDeltas.push({
      type: t,
      delta: (last.perLocationType[t] ?? 0) - (first.perLocationType[t] ?? 0),
    });
  }
  locDeltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const lines: string[] = [];
  const pctSuffix =
    pct === null ? ' (no prior baseline)' : ` (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%)`;
  lines.push(
    `Counts ${dir} ${Math.abs(delta)} persons${pctSuffix} from **${first.eventName}** to **${last.eventName}**.`,
  );
  if (locDeltas[0] && locDeltas[0].delta !== 0) {
    lines.push('');
    lines.push('Largest shifts by location type:');
    for (const d of locDeltas.slice(0, 3)) {
      if (d.delta === 0) continue;
      lines.push(`- **${d.type}**: ${d.delta >= 0 ? '+' : ''}${d.delta}`);
    }
  }
  if (topThemes.length > 0) {
    lines.push('');
    lines.push('Recurring terms in volunteer notes across this window:');
    lines.push(topThemes.slice(0, 6).map((t) => `**${t.term}** (${t.count})`).join(', ') + '.');
  }
  return { source: 'demo-canned', text: lines.join('\n') };
}
