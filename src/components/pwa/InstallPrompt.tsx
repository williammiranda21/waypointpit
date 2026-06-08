import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'waypoint-pit-install-dismissed';

export function InstallPrompt() {
  const { t } = useTranslation();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setOpen(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!open || !deferred) return null;

  const install = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setOpen(false);
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDeferred(null);
    setOpen(false);
  };

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 sm:left-auto sm:right-4 sm:max-w-sm">
      <div className="rounded-2xl bg-white border border-wp-border shadow-lg p-4 flex gap-3">
        <Logo variant="circle" size={16} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-text-primary">{t('pwa.installTitle')}</p>
          <p className="text-xs text-text-muted mt-0.5">{t('pwa.installBody')}</p>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={install}>
              {t('pwa.install')}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {t('pwa.notNow')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
