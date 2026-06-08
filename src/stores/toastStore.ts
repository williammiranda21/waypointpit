import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  tone: ToastTone;
  message: string;
  /** Auto-dismiss after this many ms. 0 = sticky. Default 4000. */
  ttlMs?: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = crypto.randomUUID();
    const item: Toast = { id, ttlMs: 4000, ...toast };
    set({ toasts: [...get().toasts, item] });
    if (item.ttlMs && item.ttlMs > 0) {
      setTimeout(() => get().dismiss(id), item.ttlMs);
    }
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Convenience helper for non-React callers (syncer, etc). */
export function toast(toast: Omit<Toast, 'id'>): string {
  return useToastStore.getState().push(toast);
}
