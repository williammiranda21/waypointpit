import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

/**
 * HMIS-style segmented tabs: pills inside a rounded gray-50 container.
 * Active pill is white with a subtle shadow.
 */
export function Tabs({ items, activeId, onChange, className }: TabsProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-wp-border bg-gray-50 p-1',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 h-8 text-sm font-medium transition-colors',
              active
                ? 'bg-white text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary',
            )}
          >
            {item.icon}
            <span>{item.label}</span>
            {typeof item.count === 'number' && (
              <span
                className={cn(
                  'inline-flex items-center justify-center rounded-full text-[10px] font-semibold px-1.5 min-w-[18px] h-[18px]',
                  active ? 'bg-primary-light text-green-800' : 'bg-gray-200 text-text-muted',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
