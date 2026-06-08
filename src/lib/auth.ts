import i18n, { type SupportedLanguage } from '@/i18n';
import { supabase, supabaseConfigured } from './supabase';
import { useAuthStore, type AuthUser, type Role } from '@/stores/authStore';
import type { Tables } from './database.types';

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

interface SignInArgs {
  email: string;
  password: string;
}

/**
 * Sign in with email + password. When VITE_SUPABASE_URL is the placeholder
 * value, falls back to a deterministic demo identity so the UI is usable
 * during local development without a real Supabase project.
 */
export async function signInWithEmail({ email, password }: SignInArgs): Promise<AuthUser> {
  if (!email || !password) {
    throw new AuthError('Email and password are required.');
  }

  if (!supabaseConfigured) {
    return demoSignIn(email);
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new AuthError(error?.message ?? 'Sign in failed.');
  }

  const profile = await fetchProfile(data.user.id);
  if (!profile) {
    // Auth succeeded but no profile row exists — CoC admin hasn't provisioned this user yet.
    await supabase.auth.signOut();
    throw new AuthError(
      'Your account exists but has not been activated by your CoC Admin. Contact them to finish setup.',
    );
  }

  const user = profileToAuthUser(profile);
  applyAuthUser(user);
  return user;
}

/**
 * Sign out and clear local auth state.
 *
 * Clears the local store FIRST so the UI logs out instantly even if the network
 * revoke stalls (Supabase's auth lock has been seen to hang). The server-side
 * token revoke is then best-effort — a failure there doesn't keep the user
 * stuck signed in locally.
 */
export async function signOut(): Promise<void> {
  useAuthStore.getState().clear();
  if (!supabaseConfigured) return;
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('[waypoint-pit] server sign-out failed (local session already cleared):', e);
  }
}

/**
 * Called once at app boot. Restores the session if Supabase has one cached,
 * fetches the profile, and hydrates the store. Always finishes with
 * status = 'ready' so guards can stop waiting.
 */
export async function restoreSession(): Promise<void> {
  const store = useAuthStore.getState();
  store.setStatus('loading');

  try {
    if (!supabaseConfigured) {
      // Demo mode: trust whatever the persist middleware already restored.
      const persisted = store.user;
      if (persisted) {
        await applyLanguage(persisted.preferredLanguage);
      }
      return;
    }

    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      store.clear();
      return;
    }

    const profile = await fetchProfile(data.session.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      store.clear();
      return;
    }

    applyAuthUser(profileToAuthUser(profile));
  } finally {
    useAuthStore.getState().setStatus('ready');
  }
}

/**
 * Subscribe to Supabase auth state changes so token refreshes and external
 * sign-outs (e.g. another tab) keep this store in sync. Returns the unsubscribe
 * function.
 */
export function subscribeToAuthChanges(): () => void {
  if (!supabaseConfigured) {
    return () => undefined;
  }

  const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT' || !session?.user) {
      useAuthStore.getState().clear();
      return;
    }
    if (event === 'TOKEN_REFRESHED') {
      // Same user, no need to refetch profile.
      return;
    }
    // SIGNED_IN, USER_UPDATED — refresh the profile snapshot.
    const profile = await fetchProfile(session.user.id);
    if (profile) applyAuthUser(profileToAuthUser(profile));
  });

  return () => data.subscription.unsubscribe();
}

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

async function fetchProfile(userId: string): Promise<Tables<'profiles'> | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[waypoint-pit] profile fetch failed', error);
    return null;
  }
  return data;
}

function profileToAuthUser(profile: Tables<'profiles'>): AuthUser {
  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role as Role,
    orgId: profile.org_id,
    preferredLanguage: profile.preferred_language,
  };
}

function applyAuthUser(user: AuthUser) {
  useAuthStore.getState().setUser(user);
  void applyLanguage(user.preferredLanguage);
}

async function applyLanguage(lang: SupportedLanguage) {
  if (i18n.language === lang) return;
  await i18n.changeLanguage(lang);
}

// -----------------------------------------------------------------------------
// Demo mode (only runs when Supabase is not configured)
// -----------------------------------------------------------------------------

function demoSignIn(email: string): AuthUser {
  const role: Role = email.includes('admin')
    ? 'coc_admin'
    : email.includes('lead')
      ? 'team_lead'
      : 'volunteer';

  const user: AuthUser = {
    id: `demo-${email}`,
    email,
    fullName: email.split('@')[0]?.replace(/[._-]+/g, ' ') || 'Demo User',
    role,
    orgId: 'demo-org',
    preferredLanguage: (i18n.language as SupportedLanguage) === 'es' ? 'es' : 'en',
  };
  applyAuthUser(user);
  return user;
}
