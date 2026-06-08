import { CheckCircle2, Info, AlertTriangle, XCircle, X } from 'lucide-react';
import { useToastStore, type ToastTone } from '@/stores/toastStore';
import { cn } from '@/lib/cn';

const toneStyles: Record<
  ToastTone,
  { container: string; icon: typeof Info }
> = {
  info: { container: 'border-blue-200 bg-blue-50 text-blue-900', icon: Info },
  success: { container: 'border-green-200 bg-green-50 text-green-900', icon: CheckCircle2 },
  warning: { container: 'border-amber-200 bg-amber-50 text-amber-900', icon: AlertTriangle },
  error: { container: 'border-red-200 bg-red-50 text-red-900', icon: XCircle },
};

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-md px-4">
      {toasts.map((t) => {
        const { container, icon: Icon } = toneStyles[t.tone];
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              'flex items-start gap-2 rounded-xl border bg-white/95 shadow-lg px-3 py-2 text-sm',
              container,
            )}
          >
            <Icon size={16} className="mt-0.5 shrink-0" />
            <span className="flex-1 min-w-0">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="p-1 -m-1 rounded hover:bg-black/5"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
