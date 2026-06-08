import { useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthError, signInWithEmail } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/supabase';
import type { SupportedLanguage } from '@/i18n';

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const user = await signInWithEmail({ email: email.trim(), password });
      const from = (location.state as LocationState | null)?.from?.pathname;
      const home =
        user.role === 'volunteer' || user.role === 'team_lead' ? '/count' : '/dashboard';
      navigate(from ?? home, { replace: true });
    } catch (err) {
      const message =
        err instanceof AuthError
          ? err.message
          : 'Unable to sign in right now. Please try again.';
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const toggleLang = () => {
    const next: SupportedLanguage = i18n.language?.startsWith('es') ? 'en' : 'es';
    void i18n.changeLanguage(next);
  };

  const showForgotHelp = () => {
    // Per Phase 2: accounts are provisioned by the CoC Admin. We don't
    // offer self-service reset.
    setError(
      'Password resets are handled by your CoC Admin. Contact them to receive a new temporary password.',
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={toggleLang}
            className="text-xs font-medium text-text-muted hover:text-text-primary px-2 py-1 rounded-md"
          >
            {i18n.language?.startsWith('es') ? 'EN' : 'ES'}
          </button>
        </div>

        <div className="bg-card-bg rounded-2xl shadow-md p-8 border border-wp-border">
          <div className="flex flex-col items-center text-center">
            <Logo variant="circle" size={20} />
            <h1 className="mt-5 text-2xl font-bold text-text-primary">{t('login.welcome')}</h1>
            <p className="mt-1 text-sm text-text-muted">{t('login.subtitle')}</p>
          </div>

          {!supabaseConfigured && (
            <div
              className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
              role="status"
            >
              Demo mode — Supabase is not configured. Any email/password is accepted; addresses
              containing <code className="font-mono">admin</code> get coordinator access,{' '}
              <code className="font-mono">lead</code> gets team-lead access, anything else gets
              volunteer access.
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text-body mb-1.5">
                {t('login.email')}
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('login.emailPlaceholder')}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text-body mb-1.5">
                {t('login.password')}
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('login.passwordPlaceholder')}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-status-alert" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" fullWidth size="lg" disabled={busy}>
              {busy ? t('login.signingIn') : t('login.signIn')}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={showForgotHelp}
                className="text-sm font-medium text-primary hover:text-primary-hover"
              >
                {t('login.forgotPassword')}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">{t('login.footer')}</p>
      </div>
    </div>
  );
}
