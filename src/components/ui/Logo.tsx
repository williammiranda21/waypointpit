import { Compass } from 'lucide-react';
import { cn } from '@/lib/cn';

interface LogoProps {
  size?: number;
  className?: string;
  /** Compass on a filled green circle (used on Login). */
  variant?: 'plain' | 'circle';
}

export function Logo({ size = 28, className, variant = 'plain' }: LogoProps) {
  if (variant === 'circle') {
    return (
      <div
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-primary text-white shadow-sm',
          className,
        )}
        style={{ width: size * 2, height: size * 2 }}
      >
        <Compass size={size} strokeWidth={2.25} />
      </div>
    );
  }
  return <Compass size={size} className={cn('text-primary', className)} strokeWidth={2.25} />;
}
