import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, rows = 3, ...props }, ref) => (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'block w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-60 resize-y',
        invalid ? 'border-status-alert focus:ring-status-alert' : 'border-gray-300',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
