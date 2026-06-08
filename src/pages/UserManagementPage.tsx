import { useState, type FormEvent } from 'react';
import { UserPlus, Mail, KeyRound, Trash2, Loader2, X, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { useAuthStore, type Role } from '@/stores/authStore';
import {
  useUsers,
  useCreateUser,
  useInviteUser,
  useUpdateUserRole,
  useDeleteUser,
} from '@/hooks/useUsers';
import { toast } from '@/stores/toastStore';

const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super Admin',
  coc_admin: 'CoC Admin',
  team_lead: 'Team Lead',
  volunteer: 'Volunteer',
};
const ROLE_TONE: Record<Role, BadgeTone> = {
  super_admin: 'alert',
  coc_admin: 'pending',
  team_lead: 'active',
  volunteer: 'neutral',
};

type Mode = 'create' | 'invite';

function randomPassword(): string {
  // 12 chars from a URL-safe-ish set, browser crypto.
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 12) + 'A1';
}

export function UserManagementPage() {
  const me = useAuthStore((s) => s.user);
  const isSuper = me?.role === 'super_admin';

  const { data: users = [], isLoading, isError, error, refetch, isFetching } = useUsers();
  const createMutation = useCreateUser();
  const inviteMutation = useInviteUser();
  const roleMutation = useUpdateUserRole();
  const deleteMutation = useDeleteUser();

  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<Mode>('create');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('volunteer');
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const assignableRoles: Role[] = isSuper
    ? ['super_admin', 'coc_admin', 'team_lead', 'volunteer']
    : ['coc_admin', 'team_lead', 'volunteer'];

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setRole('volunteer');
    setLanguage('en');
    setPassword('');
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);
    if (!fullName.trim() || !email.trim()) {
      setFormError('Name and email are required.');
      return;
    }
    if (mode === 'create' && password.length < 8) {
      setFormError('Set a temporary password (at least 8 characters).');
      return;
    }
    const input = { email, fullName, role, preferredLanguage: language, password };
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(input);
        toast({ tone: 'success', message: `${email} created. Share the temporary password with them.` });
      } else {
        await inviteMutation.mutateAsync(input);
        toast({ tone: 'success', message: `Invitation sent to ${email}.` });
      }
      resetForm();
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the user.');
    }
  };

  const handleRoleChange = async (id: string, next: Role) => {
    try {
      await roleMutation.mutateAsync({ id, role: next });
      toast({ tone: 'success', message: 'Role updated.' });
    } catch (err) {
      toast({ tone: 'error', message: err instanceof Error ? err.message : 'Could not update role.' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Remove ${name}? This deletes their login and cannot be undone.`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast({ tone: 'success', message: `${name} removed.` });
    } catch (err) {
      toast({ tone: 'error', message: err instanceof Error ? err.message : 'Could not remove user.' });
    }
  };

  const saving = createMutation.isPending || inviteMutation.isPending;

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="User Management"
        description="Add coordinators, team leads, and volunteers, and manage their access."
        actions={
          <Button onClick={() => setShowForm((s) => !s)}>
            <UserPlus size={14} />
            Add user
          </Button>
        }
      />

      {showForm && (
        <Card className="mb-5">
          <CardBody>
            <div className="mb-4 flex items-center justify-between">
              <div className="inline-flex rounded-lg border border-wp-border p-0.5">
                <button
                  type="button"
                  onClick={() => setMode('create')}
                  className={tabCls(mode === 'create')}
                >
                  <KeyRound size={13} /> Create with password
                </button>
                <button
                  type="button"
                  onClick={() => setMode('invite')}
                  className={tabCls(mode === 'invite')}
                >
                  <Mail size={13} /> Send invite
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded p-1 text-text-muted hover:bg-gray-100"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-body mb-1.5">Full name</label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-body mb-1.5">Email</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@miamidade.gov" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-body mb-1.5">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {assignableRoles.map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-body mb-1.5">Preferred language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as 'en' | 'es')}
                    className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 h-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
              </div>

              {mode === 'create' ? (
                <div>
                  <label className="block text-sm font-medium text-text-body mb-1.5">Temporary password</label>
                  <div className="flex gap-2">
                    <Input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                    />
                    <Button type="button" variant="secondary" onClick={() => setPassword(randomPassword())}>
                      <RefreshCw size={14} /> Generate
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-text-muted">
                    Share this with the user securely. They can change it after signing in.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-text-muted">
                  An email invite is sent; the user sets their own password via the link.
                  Requires SMTP configured in Supabase Auth settings.
                </p>
              )}

              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-status-alert" role="alert">
                  {formError}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : mode === 'create' ? <KeyRound size={14} /> : <Mail size={14} />}
                  {mode === 'create' ? 'Create user' : 'Send invite'}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-text-muted">Loading users…</p>
          ) : isError ? (
            <div className="p-6">
              <p className="text-sm text-status-alert">
                Could not load users: {error instanceof Error ? error.message : 'unknown error'}
              </p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : users.length === 0 ? (
            <p className="p-6 text-sm text-text-muted">No users yet. Add your first one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wp-border text-left text-xs uppercase tracking-wider text-text-muted">
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = u.id === me?.id;
                    const r = u.role as Role;
                    return (
                      <tr key={u.id} className="border-b border-wp-border last:border-0">
                        <td className="px-4 py-3 font-medium text-text-primary">
                          {u.full_name}
                          {isSelf && <span className="ml-2 text-xs text-text-muted">(you)</span>}
                        </td>
                        <td className="px-4 py-3 text-text-body">{u.email}</td>
                        <td className="px-4 py-3">
                          {isSelf ? (
                            <Badge tone={ROLE_TONE[r]}>{ROLE_LABEL[r]}</Badge>
                          ) : (
                            <select
                              value={r}
                              onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                              className="rounded-md border border-gray-200 bg-white px-2 h-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              {assignableRoles.map((opt) => (
                                <option key={opt} value={opt}>{ROLE_LABEL[opt]}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            disabled={isSelf || deleteMutation.isPending}
                            onClick={() => handleDelete(u.id, u.full_name)}
                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-status-alert hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent"
                            title={isSelf ? 'You cannot remove yourself' : 'Remove user'}
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {isFetching && !isLoading && (
        <p className="mt-2 text-xs text-text-muted">Refreshing…</p>
      )}
    </div>
  );
}

function tabCls(active: boolean): string {
  return [
    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
    active ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary',
  ].join(' ');
}
