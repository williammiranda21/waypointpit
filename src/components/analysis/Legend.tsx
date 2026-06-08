interface LegendProps {
  /** Sorted ascending; renders left → right. */
  stops: Array<{ color: string; label: string }>;
  title?: string;
}

export function Legend({ stops, title }: LegendProps) {
  if (stops.length === 0) return null;
  return (
    <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-white/95 border border-wp-border px-3 py-2 shadow-sm text-xs">
      {title && (
        <p className="font-semibold uppercase tracking-wider text-[10px] text-text-muted mb-1">
          {title}
        </p>
      )}
      <div className="flex items-center gap-1">
        {stops.map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span
              className="block h-3 w-8 rounded-sm"
              style={{ backgroundColor: s.color }}
              aria-hidden
            />
            <span className="text-[10px] text-text-muted">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
