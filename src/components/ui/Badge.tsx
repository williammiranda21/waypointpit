import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'active' | 'pending' | 'draft' | 'alert' | 'closed' | 'neutral';

const toneClasses: Record<BadgeTone, string> = {
  active: 'bg-green-100 text-green-800',
  pending: 'bg-blue-100 text-blue-800',
  draft: 'bg-gray-100 text-gray-600',
  alert: 'bg-red-100 text-red-700',
  closed: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-700',
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
