// Vercel serverless function — privileged user administration.
//
// Creating / inviting / deleting auth users requires the Supabase SERVICE ROLE
// key, which bypasses RLS and must NEVER reach the browser. This function holds
// it server-side and gates every action behind a strict check that the caller
// is an authenticated coc_admin / super_admin.
//
// Env (set in Vercel → Settings → Environment Variables):
//   SUPABASE_SERVICE_ROLE_KEY  (required, server-only — Settings → API → service_role)
//   VITE_SUPABASE_URL          (already set; also readable here at runtime)
//
// Listing users and changing a role are done client-side under RLS; only the
// privileged operations (create/invite/delete auth users) come through here.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ASSIGNABLE_ROLES = ['coc_admin', 'team_lead', 'volunteer', 'super_admin'];

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(501).json({ error: 'User admin not configured (missing SUPABASE_SERVICE_ROLE_KEY).' });
    return;
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ error: 'Missing authentication.' });
    return;
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // --- Authorize the caller -------------------------------------------------
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    res.status(401).json({ error: 'Invalid or expired session.' });
    return;
  }
  const callerId = userData.user.id;
  const { data: caller } = await admin
    .from('profiles')
    .select('role, org_id')
    .eq('id', callerId)
    .maybeSingle();

  if (!caller || (caller.role !== 'coc_admin' && caller.role !== 'super_admin')) {
    res.status(403).json({ error: 'Administrator access required.' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
  const action = body.action;

  try {
    if (action === 'create') {
      await handleCreate(admin, body, caller);
      res.status(200).json({ ok: true });
      return;
    }
    if (action === 'invite') {
      await handleInvite(admin, body, caller);
      res.status(200).json({ ok: true });
      return;
    }
    if (action === 'delete') {
      await handleDelete(admin, body, caller, callerId);
      res.status(200).json({ ok: true });
      return;
    }
    res.status(400).json({ error: `Unknown action: ${String(action)}` });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? 'Request failed.' });
  }
}

interface Caller {
  role: string;
  org_id: string;
}

function assertAssignable(role: string, caller: Caller) {
  if (!ASSIGNABLE_ROLES.includes(role)) throw new Error(`Invalid role: ${role}`);
  // Only a super_admin may mint another super_admin.
  if (role === 'super_admin' && caller.role !== 'super_admin') {
    throw new Error('Only a super admin can create another super admin.');
  }
}

async function insertProfile(
  admin: SupabaseClient,
  userId: string,
  body: any,
  caller: Caller,
) {
  const { error } = await admin.from('profiles').insert({
    id: userId,
    org_id: caller.org_id,
    full_name: String(body.fullName || '').trim() || body.email,
    email: body.email,
    role: body.role,
    preferred_language: body.preferredLanguage === 'es' ? 'es' : 'en',
  });
  if (error) {
    // Roll back the auth user so we don't orphan an account without a profile.
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    throw error;
  }
}

async function handleCreate(admin: SupabaseClient, body: any, caller: Caller) {
  if (!body.email || !body.password) throw new Error('Email and a temporary password are required.');
  if (String(body.password).length < 8) throw new Error('Temporary password must be at least 8 characters.');
  assertAssignable(body.role, caller);

  const { data, error } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true, // usable immediately; no email needed
    user_metadata: { full_name: body.fullName },
  });
  if (error) throw error;
  await insertProfile(admin, data.user.id, body, caller);
}

async function handleInvite(admin: SupabaseClient, body: any, caller: Caller) {
  if (!body.email) throw new Error('Email is required.');
  assertAssignable(body.role, caller);

  const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email, {
    data: { full_name: body.fullName },
    redirectTo: body.redirectTo || undefined,
  });
  if (error) throw error;
  await insertProfile(admin, data.user.id, body, caller);
}

async function handleDelete(admin: SupabaseClient, body: any, caller: Caller, callerId: string) {
  const id = body.id;
  if (!id) throw new Error('User id is required.');
  if (id === callerId) throw new Error('You cannot delete your own account.');

  const { data: target } = await admin
    .from('profiles')
    .select('org_id')
    .eq('id', id)
    .maybeSingle();
  if (!target) throw new Error('User not found.');
  if (caller.role !== 'super_admin' && target.org_id !== caller.org_id) {
    throw new Error('You can only remove users in your own organization.');
  }

  // profiles.id and team_members FK onto auth.users / profiles with ON DELETE
  // CASCADE, so removing the auth user cleans up the rest.
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) throw error;
}
