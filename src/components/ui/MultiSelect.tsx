import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface MultiSelectOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  /** Ids that shouldn't appear (e.g. the team lead already picked elsewhere). */
  excludeIds?: string[];
  placeholder?: string;
  maxHeight?: number;
}

export function MultiSelect({
  options,
  selectedIds,
  onChange,
  excludeIds,
  placeholder = 'Search…',
  maxHeight = 240,
}: MultiSelectProps) {
  const [query, setQuery] = useState('');

  const excludeSet = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((o) => !excludeSet.has(o.id))
      .filter((o) =>
        q
          ? o.label.toLowerCase().includes(q) || (o.sublabel ?? '').toLowerCase().includes(q)
          : true,
      );
  }, [options, excludeSet, query]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(selectedIds.filter((s) => s !== id));
    else onChange([...selectedIds, id]);
  };

  const clearSelection = () => onChange([]);

  return (
    <div className="rounded-lg border border-wp-border bg-white">
      <div className="px-2 py-2 border-b border-wp-border bg-gray-50 rounded-t-lg flex items-center gap-2">
        <Search size={14} className="text-text-muted shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm placeholder:text-text-muted focus:outline-none"
        />
        <span className="text-xs text-text-muted">
          {selectedIds.length} selected
        </span>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={clearSelection}
            className="p-1 rounded text-text-muted hover:text-status-alert"
            aria-label="Clear selection"
            title="Clear selection"
          >
            <X size={12} />
          </button>
        )}
      </div>
      <ul
        className="overflow-y-auto divide-y divide-wp-border"
        style={{ maxHeight }}
      >
        {visible.length === 0 && (
          <li className="px-3 py-4 text-xs text-text-muted text-center">No matches.</li>
        )}
        {visible.map((opt) => {
          const checked = selectedSet.has(opt.id);
          return (
            <li key={opt.id}>
              <label
                className={cn(
                  'flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50',
                  checked && 'bg-primary-light/40',
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(opt.id)}
                  className="h-4 w-4 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-text-primary truncate">{opt.label}</span>
                  {opt.sublabel && (
                    <span className="block text-xs text-text-muted truncate">{opt.sublabel}</span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
