import type { ApiScope, ServiceAccountDto } from '@cymis/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { keys } from '@/api/queries';
import { feedback } from '@/feedback';
import { AdminOnly } from '@/features/dash/AdminOnly';
import { DataTable, MonoCell, TextCell, type Column } from '@/features/dash/DataTable';
import { day } from '@/features/dash/format';
import { Page, PageHeader } from '@/features/dash/Page';
import { SecretSheet } from '@/features/dash/SecretSheet';
import { CheckRow } from '@/features/dash/Select';
import { Button, Pill, Sheet, TextField, Txt, useConfirm, useToast } from '@/ui';

const scopes: { id: ApiScope; label: string; detail: string }[] = [
  { id: 'audits:read', label: 'Read audits', detail: 'See audits, their status and counts' },
  { id: 'results:read', label: 'Read results', detail: 'Found, missing, unexpected and review lists' },
  { id: 'expected:write', label: 'Send expected lists', detail: 'Push the container list into an audit' },
];

export default function Integrations() {
  return (
    <AdminOnly>
      <IntegrationsPage />
    </AdminOnly>
  );
}

function IntegrationsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const list = useQuery({ queryKey: keys.serviceAccounts(), queryFn: endpoints.serviceAccounts });
  const [adding, setAdding] = useState(false);
  const [key, setKey] = useState<{ name: string; key: string } | null>(null);

  const revoke = useMutation({
    mutationFn: (id: string) => endpoints.revokeServiceAccount(id),
    onSuccess: () => {
      feedback.success();
      void qc.invalidateQueries({ queryKey: keys.serviceAccounts() });
      toast({ text: 'Key revoked. It stops working straight away.', tone: 'success' });
    },
    onError: (e) => toast({ text: (e as Error).message, tone: 'error' }),
  });

  const columns: Column<ServiceAccountDto>[] = [
    {
      key: 'name',
      label: 'System',
      flex: 1.4,
      render: (a) => (
        <View style={{ gap: 2 }}>
          <TextCell strong>{a.name}</TextCell>
          <MonoCell muted>{`${a.keyPrefix}...`}</MonoCell>
        </View>
      ),
    },
    { key: 'scopes', label: 'Can', flex: 1.6, render: (a) => <TextCell muted>{a.scopes.map((s) => scopes.find((x) => x.id === s)?.label ?? s).join(', ')}</TextCell> },
    { key: 'used', label: 'Last used', width: 120, render: (a) => <MonoCell muted>{a.lastUsedAt ? day(a.lastUsedAt) : 'Never'}</MonoCell> },
    {
      key: 'action',
      label: '',
      width: 130,
      align: 'right',
      render: (a) =>
        a.revokedAt ? (
          <Pill label="Revoked" filled />
        ) : (
          <Button
            label="Revoke"
            variant="danger-quiet"
            onPress={async () => {
              const ok = await confirm({
                title: `Revoke the key for ${a.name}?`,
                body: 'That system loses access at once. This cannot be undone; you would make a new key instead.',
                confirmLabel: 'Revoke key',
                danger: true,
              });
              if (ok) revoke.mutate(a.id);
            }}
          />
        ),
    },
  ];

  return (
    <Page gap={22} maxWidth={1040}>
      <PageHeader
        title="Integrations"
        subtitle="Keys for other systems, like a terminal operating system, to read results or send expected lists. Nothing here can write into those systems."
        actions={<Button label="New key" icon="key" onPress={() => setAdding(true)} />}
      />
      <DataTable
        label="Service accounts"
        columns={columns}
        rows={list.data ?? []}
        rowKey={(a) => a.id}
        loading={list.isPending}
        error={list.error as Error | null}
        empty={{ icon: 'key', title: 'No keys yet', body: 'Make one when another system needs to talk to Cymis. See the integration guide in Help.' }}
      />
      <NewKey
        open={adding}
        onClose={() => setAdding(false)}
        onMade={(name, apiKey) => {
          setAdding(false);
          void qc.invalidateQueries({ queryKey: keys.serviceAccounts() });
          setKey({ name, key: apiKey });
        }}
      />
      <SecretSheet
        open={!!key}
        onClose={() => setKey(null)}
        title="Your new key"
        body={key ? `Paste this into ${key.name}. Keep it somewhere safe, like a password manager.` : ''}
        secret={key?.key ?? ''}
      />
    </Page>
  );
}

function NewKey({ open, onClose, onMade }: { open: boolean; onClose: () => void; onMade: (name: string, key: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<ApiScope[]>(['audits:read', 'results:read']);
  const make = useMutation({
    mutationFn: () => endpoints.createServiceAccount({ name: name.trim(), scopes: picked }),
    onSuccess: (r) => {
      feedback.success();
      onMade(r.account.name, r.apiKey);
      setName('');
    },
    onError: (e) => toast({ text: (e as Error).message, tone: 'error' }),
  });
  return (
    <Sheet open={open} onClose={onClose} label="New key" width={500}>
      <Txt variant="heading">New key</Txt>
      <TextField label="Which system is it for?" value={name} onChangeText={setName} placeholder="Terminal system reporting" maxLength={80} />
      <View style={{ gap: 2 }}>
        <Txt variant="bodySmStrong">What it can do</Txt>
        {scopes.map((s) => (
          <CheckRow key={s.id} label={s.label} detail={s.detail} checked={picked.includes(s.id)} onChange={(v) => setPicked((p) => (v ? [...p, s.id] : p.filter((x) => x !== s.id)))} />
        ))}
      </View>
      <Button label="Make key" size="lg" block disabled={name.trim().length < 2 || !picked.length} loading={make.isPending} onPress={() => make.mutate()} />
    </Sheet>
  );
}
