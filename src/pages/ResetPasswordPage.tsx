import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { signOut, updatePassword } from '@/lib/auth';

type Phase = 'checking' | 'ready' | 'invalid' | 'done';

/**
 * Landing page for the password-reset email link. Supabase establishes a
 * recovery session from the URL (detectSessionInUrl), then the user sets a new
 * password here. On success they're signed out and sent to /login to sign in
 * with the new password.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Confirm there's a recovery session to act on. Supabase needs a beat to
  // parse the token out of the URL on first load.
  useEffect(() => {
    if (!supabaseConfigured) {
      setPhase('invalid');
      return;
    }
    let cancelled = false;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setPhase(data.session ? 'ready' : 'invalid');
    };
    // small delay so detectSessionInUrl has run
    const t = setTimeout(check, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      setPhase('done');
      await signOut();
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg px-4">
      <div className="w-full max-w-md">
        <div className="bg-card-bg rounded-2xl shadow-md p-8 border border-wp-border">
          <div className="flex flex-col items-center text-center">
            <Logo variant="circle" size={20} />
            <h1 className="mt-5 text-2xl font-bold text-text-primary">Set a new password</h1>
          </div>

          {phase === 'checking' && (
            <div className="mt-8 flex items-center justify-center gap-2 text-sm text-text-muted">
              <Loader2 size={16} className="animate-spin" />
              Verifying your reset link…
            </div>
          )}

          {phase === 'invalid' && (
            <div className="mt-6 space-y-4 text-center">
              <p className="text-sm text-text-body">
                This reset link is invalid or has expired. Request a new one from the sign-in page.
              </p>
              <Button fullWidth onClick={() => navigate('/login', { replace: true })}>
                Back to sign in
              </Button>
            </div>
          )}

          {phase === 'done' && (
            <p className="mt-6 text-center text-sm text-text-body">
              Password updated. Redirecting you to sign in…
            </p>
          )}

          {phase === 'ready' && (
            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <div>
                <label htmlFor="new_password" className="block text-sm font-medium text-text-body mb-1.5">
                  New password
                </label>
                <Input
                  id="new_password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
              </div>
              <div>
                <label htmlFor="confirm_password" className="block text-sm font-medium text-text-body mb-1.5">
                  Confirm password
                </label>
                <Input
                  id="confirm_password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter the password"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-status-alert" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" fullWidth size="lg" disabled={busy}>
                {busy ? 'Saving…' : 'Update password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
