import { useState } from 'react';
import { Sparkles, Loader2, Settings2, X } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  getStoredApiKey,
  isAiConfigured,
  isAiProxyMode,
  setStoredApiKey,
  type InsightResult,
  type InsightSource,
} from '@/lib/ai/insights';

function sourceLabel(source: InsightSource): string {
  switch (source) {
    case 'claude-sonnet-4-6':
      return 'Claude Sonnet 4.6';
    case 'claude-haiku-4-5':
      return 'Claude Haiku 4.5';
    case 'demo-canned':
    default:
      return 'Demo mode';
  }
}

interface AiPanelProps {
  /** What the panel will analyze when the user clicks the button. */
  title: string;
  description: string;
  /** Called when user clicks Generate. Returns a freshly-computed insight. */
  onGenerate: () => Promise<InsightResult>;
  /** Optional latest result kept by the parent (so the parent can persist). */
  result?: InsightResult | null;
}

export function AiPanel({ title, description, onGenerate, result }: AiPanelProps) {
  const [local, setLocal] = useState<InsightResult | null>(result ?? null);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(getStoredApiKey() ?? '');
  const [aiOn, setAiOn] = useState(isAiConfigured());
  // In proxy mode the key lives server-side — no client-side key UI needed.
  const proxyMode = isAiProxyMode();

  const value = result ?? local;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const r = await onGenerate();
      setLocal(r);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = () => {
    setStoredApiKey(apiKey || null);
    setAiOn(!!apiKey);
    setShowSettings(false);
  };

  return (
    <Card className="flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-wp-border">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              AI Insights
            </p>
            <h3 className="mt-1 text-sm font-semibold text-text-primary">{title}</h3>
            <p className="mt-0.5 text-xs text-text-muted">{description}</p>
          </div>
          {!proxyMode && (
            <button
              type="button"
              onClick={() => setShowSettings((s) => !s)}
              className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-gray-100"
              aria-label="AI settings"
              title="AI settings"
            >
              <Settings2 size={14} />
            </button>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button
            onClick={handleGenerate}
            disabled={loading}
            size="sm"
            className="shrink-0 whitespace-nowrap"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {loading ? 'Generating…' : 'Generate insights'}
          </Button>
          <span className="text-[11px] text-text-muted min-w-0">
            {aiOn ? (
              <span className="text-primary font-medium">
                {proxyMode ? 'Claude connected (server)' : 'Claude API connected'}
              </span>
            ) : (
              'Demo mode — computed locally'
            )}
          </span>
        </div>
      </div>

      {showSettings && (
        <CardBody className="border-b border-wp-border bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-text-primary">Anthropic API key</p>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="rounded p-1 text-text-muted hover:bg-white"
              aria-label="Close settings"
            >
              <X size={14} />
            </button>
          </div>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-ant-..."
            aria-label="Anthropic API key"
          />
          <p className="mt-2 text-[11px] text-text-muted">
            Local/dev only. The deployed app proxies calls through a serverless function
            (set <code>VITE_AI_PROXY</code>) so the key never reaches the browser.
          </p>
          <div className="mt-3 flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setApiKey('')}>
              Clear
            </Button>
            <Button size="sm" onClick={handleSaveKey}>
              Save
            </Button>
          </div>
        </CardBody>
      )}

      <CardBody className="text-sm text-text-body flex-1 min-h-[120px]">
        {!value && !loading && (
          <p className="text-text-muted">
            Click <span className="font-semibold text-text-primary">Generate insights</span> to
            analyze the current view.
          </p>
        )}
        {value && (
          <div className="space-y-2 whitespace-pre-wrap leading-relaxed">
            {renderMarkdown(value.text)}
            <p className="pt-2 mt-2 border-t border-wp-border text-[11px] text-text-muted">
              Source: {sourceLabel(value.source)}
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Tiny markdown subset — bold (**...**) + line breaks + bullet (- ).
 * Avoids a full markdown lib to keep the bundle tight.
 */
function renderMarkdown(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (line.trim() === '') return <br key={i} />;
    const bulletMatch = line.match(/^\s*-\s+(.*)$/);
    if (bulletMatch) {
      return (
        <div key={i} className="flex gap-2">
          <span className="text-text-muted">•</span>
          <span>{renderInline(bulletMatch[1])}</span>
        </div>
      );
    }
    return <div key={i}>{renderInline(line)}</div>;
  });
}

function renderInline(line: string) {
  const parts: Array<string | JSX.Element> = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(line))) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    parts.push(
      <strong key={`b-${key++}`} className="font-semibold text-text-primary">
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return parts;
}
