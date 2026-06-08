import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ToggleProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode;
  description?: ReactNode;
}

/** Accessible switch styled to match Waypoint green primary. */
export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ label, description, className, id, disabled, checked, ...props }, ref) => {
    const inputId = id ?? `toggle-${Math.random().toString(36).slice(2, 9)}`;
    return (
      <label
        htmlFor={inputId}
        className={cn(
          'flex items-start gap-3 cursor-pointer select-none',
          disabled && 'cursor-not-allowed opacity-60',
          className,
        )}
      >
        <span className="relative inline-flex h-5 w-9 shrink-0 mt-0.5">
          <input
            ref={ref}
            id={inputId}
            type="checkbox"
            role="switch"
            className="peer sr-only"
            disabled={disabled}
            checked={checked}
            {...props}
          />
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-gray-300 transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-primary"
          />
          <span
            aria-hidden
            className="absolute top-0.5 left-0.5 inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4"
          />
        </span>
        {(label || description) && (
          <span className="min-w-0">
            {label && (
              <span className="block text-sm font-medium text-text-primary">{label}</span>
            )}
            {description && (
              <span className="block text-xs text-text-muted mt-0.5">{description}</span>
            )}
          </span>
        )}
      </label>
    );
  },
);
Toggle.displayName = 'Toggle';
