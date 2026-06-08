import { supabase, supabaseConfigured } from '@/lib/supabase';
import { useAuthStore, type Role } from '@/stores/authStore';
import type { Tables } from '@/lib/database.types';

export type UserRow = Tables<'profiles'>;

export interface NewUserInput {
  email: string;
  fullName: string;
  role: Role;
  preferredLanguage: 'en' | 'es';
  /** Required for "create" (temp password); ignored for "invite". */
  password?: string;
}

// -----------------------------------------------------------------------------
// Reads + role updates — client-side under RLS (admin policies allow these).
// -----------------------------------------------------------------------------

export async function listUsers(): Promise<UserRow[]> {
  if (!supabaseConfigured) return demoList();

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('full_name', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateUserRole(id: string, role: Role): Promise<void> {
  if (!supabaseConfigured) {
    demoWrite(demoList().map((u) => (u.id === id ? { ...u, role } : u)));
    return;
  }
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// Privileged ops — routed through the service-role serverless function.
// -----------------------------------------------------------------------------

async function callAdmin(action: string, payload: Record<string, unknown>): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Your session expired — sign in again.');

  const res = await fetch('/api/admin-users', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
}

export async function createUser(input: NewUserInput): Promise<void> {
  if (!supabaseConfigured) return demoCreate(input);
  await callAdmin('create', {
    email: input.email.trim(),
    password: input.password,
    fullName: input.fullName.trim(),
    role: input.role,
    preferredLanguage: input.preferredLanguage,
  });
}

export async function inviteUser(input: NewUserInput): Promise<void> {
  if (!supabaseConfigured) return demoCreate(input);
  await callAdmin('invite', {
    email: input.email.trim(),
    fullName: input.fullName.trim(),
    role: input.role,
    preferredLanguage: input.preferredLanguage,
    redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
  });
}

export async function deleteUser(id: string): Promise<void> {
  if (!supabaseConfigured) {
    demoWrite(demoList().filter((u) => u.id !== id));
    return;
  }
  await callAdmin('delete', { id });
}

// -----------------------------------------------------------------------------
// Demo mode — localStorage so the page is fully usable without a backend.
// -----------------------------------------------------------------------------

const DEMO_KEY = 'waypoint-pit-demo-users';

function demoList(): UserRow[] {
  if (typeof window === 'undefined') return [];
  const existing = window.localStorage.getItem(DEMO_KEY);
  if (existing) {
    try {
      return JSON.parse(existing) as UserRow[];
    } catch {
      /* fall through to seed */
    }
  }
  // Seed with the signed-in admin + a couple of sample teammates.
  const me = useAuthStore.getState().user;
  const now = new Date().toISOString();
  const seed: UserRow[] = [
    ...(me
      ? [{
          id: me.id, org_id: me.orgId, full_name: me.fullName, email: me.email,
          role: me.role, preferred_language: me.preferredLanguage, created_at: now,
        } as UserRow]
      : []),
    { id: 'demo-lead-1', org_id: 'demo-org', full_name: 'Maria Lead', email: 'maria.lead@miamidade.gov', role: 'team_lead', preferred_language: 'en', created_at: now },
    { id: 'demo-vol-1', org_id: 'demo-org', full_name: 'Alex Volunteer', email: 'alex@miamidade.gov', role: 'volunteer', preferred_language: 'es', created_at: now },
  ];
  demoWrite(seed);
  return seed;
}

function demoWrite(rows: UserRow[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEMO_KEY, JSON.stringify(rows));
}

function demoCreate(input: NewUserInput): void {
  const me = useAuthStore.getState().user;
  const row: UserRow = {
    id: `demo-${Date.now()}`,
    org_id: me?.orgId ?? 'demo-org',
    full_name: input.fullName,
    email: input.email,
    role: input.role,
    preferred_language: input.preferredLanguage,
    created_at: new Date().toISOString(),
  };
  demoWrite([...demoList(), row]);
}
