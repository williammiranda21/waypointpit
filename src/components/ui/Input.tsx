import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'block w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted',
        'focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-60',
        invalid ? 'border-status-alert focus:ring-status-alert' : 'border-gray-300',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
