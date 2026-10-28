import type { Role, UserDto } from '@cymis/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { useUsers } from '@/api/queries';
import { useSession } from '@/auth/session';
import { feedback } from '@/feedback';
import { DataTable, MonoCell, TextCell, type Column } from '@/features/dash/DataTable';
import { day, makePassword, roleWords } from '@/features/dash/format';
import { Page, PageHeader } from '@/features/dash/Page';
import { SecretSheet } from '@/features/dash/SecretSheet';
import { Select } from '@/features/dash/Select';
import { Avatar, Button, FilterPills, Pill, Sheet, TextField, Txt, useConfirm, useToast } from '@/ui';

type RoleFilter = Role | 'ALL';

const roleOptions = (['AUDITOR', 'SUPERVISOR', 'ADMIN'] as Role[]).map((r) => ({
  value: r,
  label: roleWords[r],
  detail: r === 'AUDITOR' ? 'Scans containers on a phone' : r === 'SUPERVISOR' ? 'Sets up audits and reviews scans' : 'Everything, plus people and settings',
}));

export default function People() {
  const me = useSession((s) => s.user);
  const isAdmin = me?.role === 'ADMIN';
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<RoleFilter>('ALL');
  const [showInactive, setShowInactive] = useState(false);
  const users = useUsers({ ...(q.trim() ? { q: q.trim() } : {}), ...(role !== 'ALL' ? { role } : {}), ...(showInactive ? {} : { active: true }) });
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [secret, setSecret] = useState<{ name: string; password: string } | null>(null);

  const refresh = () => void qc.invalidateQueries({ queryKey: ['users'] });
  const fail = (e: unknown) => toast({ text: (e as Error).message, tone: 'error' });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { role?: Role; isActive?: boolean; fullName?: string } }) => endpoints.updateUser(id, body),
    onSuccess: () => {
      refresh();
      feedback.success();
    },
    onError: fail,
  });
  const signOutAll = useMutation({
    mutationFn: (u: UserDto) => endpoints.signOutEverywhere(u.id),
    onSuccess: (r, u) => {
      feedback.success();
      const first = u.fullName.split(' ')[0];
      toast({ text: r.ended === 0 ? `${first} was not signed in anywhere.` : `${first} is signed out on ${r.ended === 1 ? 'one device' : `${r.ended} devices`}.`, tone: 'success' });
    },
    onError: fail,
  });
  const reset = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => endpoints.resetPassword(id, password),
    onError: fail,
  });
  const unlock = useMutation({
    mutationFn: (id: string) => endpoints.unlockUser(id),
    onSuccess: () => {
      refresh();
      toast({ text: 'Unlocked. They can sign in again.', tone: 'success' });
    },
    onError: fail,
  });

  const locked = (u: UserDto) => !!u.lockedUntil && new Date(u.lockedUntil) > new Date();

  const columns: Column<UserDto>[] = [
    {
      key: 'name',
      label: 'Person',
      flex: 1.6,
      render: (u) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={u.fullName} size={30} />
          <View style={{ minWidth: 0, flexShrink: 1 }}>
            <TextCell strong>{u.fullName}</TextCell>
            <MonoCell muted>{u.staffId}</MonoCell>
          </View>
        </View>
      ),
    },
    { key: 'role', label: 'Role', width: 130, render: (u) => <TextCell>{roleWords[u.role]}</TextCell> },
    {
      key: 'state',
      label: 'State',
      width: 170,
      render: (u) =>
        !u.isActive ? <Pill label="Turned off" filled /> : locked(u) ? <Pill label="Locked out" /> : u.mustChangePassword ? <Pill label="New password due" /> : <TextCell muted>Active</TextCell>,
    },
    { key: 'last', label: 'Last sign in', width: 130, render: (u) => <MonoCell muted>{u.lastLoginAt ? day(u.lastLoginAt) : 'Never'}</MonoCell> },
  ];

  return (
    <Page gap={22}>
      <PageHeader
        title="People"
        subtitle="Who can sign in and what they can do."
        actions={isAdmin ? <Button label="Add person" icon="user-plus" onPress={() => setAdding(true)} /> : undefined}
      />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
        <View style={{ flexBasis: 280, flexGrow: 0, flexShrink: 1 }}>
          <TextField label="Search" value={q} onChangeText={setQ} placeholder="Name or staff ID" />
        </View>
        <FilterPills<RoleFilter>
          label="Role"
          value={role}
          onChange={setRole}
          options={[
            { id: 'ALL', label: 'Everyone' },
            { id: 'AUDITOR', label: 'Yard crew' },
            { id: 'SUPERVISOR', label: 'Supervisors' },
            { id: 'ADMIN', label: 'Admins' },
          ]}
        />
        <Button label={showInactive ? 'Hide turned off' : 'Show turned off'} variant="quiet" onPress={() => setShowInactive((v) => !v)} style={{ alignSelf: 'flex-end' }} />
      </View>
      <DataTable
        label="People"
        columns={columns}
        rows={users.data?.items ?? []}
        rowKey={(u) => u.id}
        onRowPress={isAdmin ? (u) => setEditing(u) : undefined}
        loading={users.isPending}
        error={users.error as Error | null}
        empty={{ icon: 'users', title: 'Nobody found', body: q ? 'Try a different name or staff ID.' : 'Add the first person to get started.' }}
      />
      {!isAdmin ? (
        <Txt variant="caption" tone="muted">
          Only an admin can add people or change their access.
        </Txt>
      ) : null}

      <AddPerson
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={(name, password) => {
          setAdding(false);
          refresh();
          setSecret({ name, password });
        }}
      />

      <Sheet open={!!editing} onClose={() => setEditing(null)} label="Change access" width={480}>
        {editing ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={editing.fullName} size={44} />
              <View style={{ flex: 1 }}>
                <Txt variant="heading">{editing.fullName}</Txt>
                <Txt variant="monoSm" tone="muted">
                  {editing.staffId}
                </Txt>
              </View>
            </View>
            <Select
              label="Role"
              value={editing.role}
              options={roleOptions}
              onChange={(v) => {
                if (!v || v === editing.role) return;
                update.mutate({ id: editing.id, body: { role: v as Role } }, { onSuccess: (u) => setEditing(u) });
              }}
            />
            <View style={{ gap: 8 }}>
              {locked(editing) ? <Button label="Unlock sign in" icon="lock-simple-open" variant="secondary" size="lg" block loading={unlock.isPending} onPress={() => unlock.mutate(editing.id, { onSuccess: (u) => setEditing(u) })} /> : null}
              <Button
                label="Reset password"
                icon="key"
                variant="secondary"
                size="lg"
                block
                loading={reset.isPending}
                onPress={async () => {
                  const ok = await confirm({
                    title: `Reset ${editing.fullName.split(' ')[0]}'s password?`,
                    body: 'Their current password stops working. You get a temporary one to give them, and they pick a new one when they sign in.',
                    confirmLabel: 'Reset password',
                  });
                  if (!ok) return;
                  const password = makePassword();
                  reset.mutate(
                    { id: editing.id, password },
                    {
                      onSuccess: () => {
                        const name = editing.fullName;
                        setEditing(null);
                        refresh();
                        setSecret({ name, password });
                      },
                    },
                  );
                }}
              />
              {isAdmin && editing.id !== me?.id ? (
                <Button
                  label="Sign out on every device"
                  icon="device-mobile"
                  variant="secondary"
                  size="lg"
                  block
                  loading={signOutAll.isPending}
                  onPress={async () => {
                    const ok = await confirm({
                      title: `Sign ${editing.fullName.split(' ')[0]} out everywhere?`,
                      body: 'Use this for a lost or shared phone. Every device they are signed in on stops working now. Scans already sent are kept, and they can sign in again with their password.',
                      confirmLabel: 'Sign out everywhere',
                      danger: true,
                    });
                    if (ok) signOutAll.mutate(editing);
                  }}
                />
              ) : null}
              {editing.id !== me?.id ? (
                <Button
                  label={editing.isActive ? 'Turn off access' : 'Turn access back on'}
                  variant={editing.isActive ? 'danger-quiet' : 'secondary'}
                  size="lg"
                  block
                  loading={update.isPending}
                  onPress={async () => {
                    if (editing.isActive) {
                      const ok = await confirm({
                        title: `Turn off ${editing.fullName.split(' ')[0]}'s access?`,
                        body: 'They are signed out on every device and cannot sign in. Their past scans stay. You can turn it back on later.',
                        confirmLabel: 'Turn off access',
                        danger: true,
                      });
                      if (!ok) return;
                    }
                    update.mutate({ id: editing.id, body: { isActive: !editing.isActive } }, { onSuccess: (u) => setEditing(u) });
                  }}
                />
              ) : null}
            </View>
          </>
        ) : null}
      </Sheet>

      <SecretSheet
        open={!!secret}
        onClose={() => setSecret(null)}
        title="Temporary password"
        body={secret ? `Give this to ${secret.name} in person. They choose their own when they first sign in.` : ''}
        secret={secret?.password ?? ''}
      />
    </Page>
  );
}

function AddPerson({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (name: string, password: string) => void }) {
  const toast = useToast();
  const [staffId, setStaffId] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<Role>('AUDITOR');
  const [password, setPassword] = useState(() => makePassword());
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => endpoints.createUser({ staffId: staffId.trim().toUpperCase(), fullName: fullName.trim(), role, temporaryPassword: password }),
    onSuccess: (u) => {
      feedback.success();
      onAdded(u.fullName, password);
      setStaffId('');
      setFullName('');
      setRole('AUDITOR');
      setPassword(makePassword());
      setError(null);
    },
    onError: (e) => {
      setError((e as Error).message);
      toast({ text: (e as Error).message, tone: 'error' });
    },
  });

  const ok = staffId.trim().length >= 2 && fullName.trim().length >= 2 && password.length >= 10;

  return (
    <Sheet open={open} onClose={onClose} label="Add person" width={520}>
      <Txt variant="heading">Add a person</Txt>
      <TextField label="Staff ID" mono value={staffId} onChangeText={(t) => setStaffId(t.toUpperCase())} placeholder="AMW204" maxLength={32} error={error && /staff/i.test(error) ? error : null} />
      <TextField label="Full name" value={fullName} onChangeText={setFullName} placeholder="Amina Wanjiru" maxLength={120} autoCapitalize="words" />
      <Select label="Role" value={role} options={roleOptions} onChange={(v) => v && setRole(v as Role)} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <TextField label="Temporary password" value={password} onChangeText={setPassword} hint="At least 10 characters. They change it when they first sign in." />
        </View>
        <View style={{ paddingBottom: 26 }}>
          <Button label="Make one" variant="secondary" icon="arrows-clockwise" onPress={() => setPassword(makePassword())} />
        </View>
      </View>
      <Button label="Add person" size="lg" block disabled={!ok} loading={create.isPending} onPress={() => create.mutate()} />
    </Sheet>
  );
}
