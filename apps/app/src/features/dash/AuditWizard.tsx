import { IMPORT_FIELDS, type ColumnMap, type ImportDto, type ImportField, type ImportMode } from '@cymis/schemas';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { ApiError } from '@/api/http';
import { keys, useAudit, useFacilities, useUsers } from '@/api/queries';
import { feedback } from '@/feedback';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Banner, Button, EmptyState, FilterPills, Icon, Skeleton, StatusChip, TextField, Txt, fmt, useConfirm, useToast } from '@/ui';
import { sectionKindWords } from './format';
import { Page, PageHeader } from './Page';
import { CheckRow, Select } from './Select';

const fieldWords: Record<ImportField, { label: string; hint: string }> = {
  containerNumber: { label: 'Container number', hint: 'The 11 character number, like CSQU3054383' },
  sizeType: { label: 'Size and type', hint: 'For example 22G1 or 45R1' },
  location: { label: 'Yard location', hint: 'Block, row, bay or slot' },
  vessel: { label: 'Vessel', hint: 'Ship name' },
  voyage: { label: 'Voyage', hint: 'Voyage number' },
  fullEmpty: { label: 'Full or empty', hint: 'F or E' },
  lineOperator: { label: 'Line operator', hint: 'Shipping line' },
  category: { label: 'Category', hint: 'Import, export, transit' },
};

type StepId = 'where' | 'upload' | 'map' | 'check' | 'crew' | 'start';
const order: StepId[] = ['where', 'upload', 'map', 'check', 'crew', 'start'];

function busyImport(imp: ImportDto | undefined) {
  if (!imp) return false;
  return imp.status === 'UPLOADED' || imp.status === 'PARSING' || (imp.status === 'READY' && !!imp.mapping && !imp.validated);
}

/**
 * Setting up an audit, start to finish, on one page. Each finished step folds
 * down to a line so the page stays short. Works for a new audit and for a
 * draft someone comes back to.
 */
export function AuditWizard({ auditId }: { auditId?: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const audit = useAudit(auditId);
  const imports = useQuery({
    queryKey: keys.imports(auditId ?? ''),
    queryFn: () => endpoints.auditImports(auditId!),
    enabled: !!auditId,
    refetchInterval: (q) => (busyImport(latest(q.state.data)) ? 1500 : false),
  });
  const imp = latest(imports.data);

  const [crewDone, setCrewDone] = useState(false);
  const committed = imp?.status === 'COMMITTED' || (audit.data?.counts.expected ?? 0) > 0;

  const [editMap, setEditMap] = useState(false);
  let step: StepId;
  if (!auditId) step = 'where';
  else if (!imp || imp.status === 'FAILED') step = committed ? (crewDone ? 'start' : 'crew') : 'upload';
  else if (imp.status === 'UPLOADED' || (imp.status === 'PARSING' && !imp.mapping)) step = 'upload';
  else if (imp.status === 'READY' && (!imp.mapping || editMap)) step = 'map';
  else if (imp.status === 'READY' || imp.status === 'PARSING') step = 'check';
  else step = crewDone ? 'start' : 'crew';

  // A draft that already has crew can skip straight past that step when reopened.
  useEffect(() => {
    if (audit.data && audit.data.assignees.length > 0 && committed && !crewDone) setCrewDone(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audit.data?.id]);

  // Once it has started there is nothing left to set up. Go to the live page.
  const status = audit.data?.status;
  useEffect(() => {
    if (auditId && status && status !== 'DRAFT') router.replace(`/dashboard/audits/${auditId}` as never);
  }, [auditId, status]);

  const at = order.indexOf(step);
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: keys.imports(auditId ?? '') });
    void qc.invalidateQueries({ queryKey: keys.audit(auditId ?? '') });
  };

  return (
    <Page gap={20} maxWidth={860}>
      <PageHeader
        title={audit.data?.name ?? 'New audit'}
        crumbs={[{ label: 'Audits', href: '/dashboard/audits' }, { label: auditId ? 'Set up' : 'New' }]}
        subtitle="Pick the section, bring in the terminal list, give it to the crew, then start."
        actions={
          auditId ? (
            <Button
              label="Finish later"
              variant="quiet"
              onPress={() => {
                toast({ text: 'Saved as a draft. Open it from Audits to carry on.' });
                router.replace('/dashboard/audits' as never);
              }}
            />
          ) : undefined
        }
      />

      <Step n={1} title="Section and name" state={at > 0 ? 'done' : 'now'} summary={audit.data ? `${audit.data.section.name}, ${audit.data.name}` : undefined}>
        <WhereStep />
      </Step>

      <Step n={2} title="Terminal list" state={at > 1 ? 'done' : at === 1 ? 'now' : 'later'} summary={imp ? imp.fileName : undefined}>
        {auditId ? <UploadStep auditId={auditId} imp={imp} onDone={refresh} /> : null}
      </Step>

      <Step n={3} title="Match the columns" state={at > 2 ? 'done' : at === 2 ? 'now' : 'later'} summary={imp?.mapping ? `Numbers from "${imp.mapping.containerNumber}"` : undefined}>
        {imp && step === 'map' ? <MapStep imp={imp} onDone={() => { setEditMap(false); refresh(); }} /> : null}
      </Step>

      <Step
        n={4}
        title="Check the rows"
        state={at > 3 ? 'done' : at === 3 ? 'now' : 'later'}
        summary={audit.data?.counts.expected ? `${fmt(audit.data.counts.expected)} containers on the list` : undefined}
      >
        {imp && step === 'check' ? <CheckStep imp={imp} onDone={refresh} onRemap={() => setEditMap(true)} /> : null}
      </Step>

      <Step n={5} title="Crew" state={at > 4 ? 'done' : at === 4 ? 'now' : 'later'} summary={audit.data ? crewSummary(audit.data.assignees.map((a) => a.fullName)) : undefined}>
        {auditId && step === 'crew' ? <CrewStep auditId={auditId} current={audit.data?.assignees.map((a) => a.id) ?? []} onDone={() => setCrewDone(true)} /> : null}
      </Step>

      <Step n={6} title="Start" state={at === 5 ? 'now' : 'later'}>
        {auditId && step === 'start' && audit.data ? <StartStep auditId={auditId} expected={audit.data.counts.expected} crew={audit.data.assignees.length} onBack={() => setCrewDone(false)} /> : null}
      </Step>
    </Page>
  );
}

function latest(list: ImportDto[] | undefined): ImportDto | undefined {
  if (!list?.length) return undefined;
  return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

function crewSummary(names: string[]) {
  if (!names.length) return 'Nobody yet';
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

function Step({ n, title, state, summary, children }: { n: number; title: string; state: 'done' | 'now' | 'later'; summary?: string; children?: ReactNode }) {
  const { c } = useTheme();
  const now = state === 'now';
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: now ? c.ink : c.rule,
        borderRadius: radius.md,
        backgroundColor: c.raised,
        padding: now ? 24 : 16,
        paddingHorizontal: 20,
        gap: now ? 18 : 0,
        opacity: state === 'later' ? 0.55 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: state === 'done' ? c.found : now ? c.ink : 'transparent',
            borderWidth: state === 'later' ? 1.5 : 0,
            borderColor: c.ruleStrong,
          }}
        >
          {state === 'done' ? (
            <Icon name="check" size={16} weight="bold" color="#ffffff" />
          ) : (
            <Txt style={{ fontFamily: fonts.monoMedium, fontSize: 13, lineHeight: 16 }} color={now ? c.onInk : c.muted}>
              {n}
            </Txt>
          )}
        </View>
        <Txt variant={now ? 'heading' : 'bodyStrong'} accessibilityRole="header">
          {title}
        </Txt>
        {state === 'done' && summary ? (
          <Txt variant="bodySm" tone="muted" numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>
            {summary}
          </Txt>
        ) : null}
      </View>
      {now ? children : null}
    </View>
  );
}

/* Step 1 */

function WhereStep() {
  const { c } = useTheme();
  const facilities = useFacilities();
  const toast = useToast();
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const sections = useMemo(
    () => (facilities.data ?? []).filter((f) => f.isActive).flatMap((f) => f.sections.filter((s) => s.isActive).map((s) => ({ ...s, facility: f }))),
    [facilities.data],
  );
  const picked = sections.find((s) => s.id === sectionId);

  useEffect(() => {
    if (picked && !name) {
      const d = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      setName(`${picked.name} count, ${d}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked?.id]);

  const create = useMutation({
    mutationFn: () => endpoints.createAudit({ sectionId: sectionId!, name: name.trim(), ...(notes.trim() ? { notes: notes.trim() } : {}) }),
    onSuccess: (a) => {
      feedback.success();
      router.replace(`/dashboard/audits/${a.id}/setup` as never);
    },
    onError: (e) => toast({ text: (e as Error).message, tone: 'error' }),
  });

  if (facilities.isPending) return <Skeleton height={120} />;
  if (facilities.isError) return <EmptyState icon="warning-circle" title="Could not load sections" body={(facilities.error as Error).message} />;
  if (!sections.length)
    return (
      <EmptyState
        icon="buildings"
        title="No sections yet"
        body="An admin needs to add the yard sections first, under Admin, Sections."
        action={<Button label="Go to sections" variant="secondary" onPress={() => router.push('/dashboard/admin/sections' as never)} />}
      />
    );

  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 8 }}>
        <Txt variant="bodySmStrong">Which section?</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {sections.map((s) => {
            const on = s.id === sectionId;
            return (
              <Pressable
                key={s.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                onPress={() => {
                  feedback.select();
                  setSectionId(s.id);
                }}
                style={(st) => ({
                  minWidth: 180,
                  maxWidth: 360,
                  flexGrow: 1,
                  flexBasis: 200,
                  gap: 2,
                  padding: 12,
                  borderRadius: radius.sm,
                  borderWidth: on ? 2 : 1,
                  borderColor: on ? c.ink : c.rule,
                  backgroundColor: (st as { hovered?: boolean }).hovered ? c.hover : c.raised,
                })}
              >
                <Txt variant="bodyStrong" style={{ fontSize: 15 }}>
                  {s.name}
                </Txt>
                <Txt variant="caption" tone="muted">{`${sectionKindWords[s.kind]}, ${s.facility.name}`}</Txt>
              </Pressable>
            );
          })}
        </View>
      </View>
      <TextField label="Audit name" value={name} onChangeText={setName} placeholder="Block A morning count" maxLength={120} />
      <TextField label="Notes for the crew" hint="Optional. Shown on their phones." value={notes} onChangeText={setNotes} maxLength={2000} />
      <Button label="Continue" iconRight="arrow-right" size="lg" disabled={!sectionId || name.trim().length < 2} loading={create.isPending} onPress={() => create.mutate()} />
    </View>
  );
}

/* Step 2 */

function UploadStep({ auditId, imp, onDone }: { auditId: string; imp: ImportDto | undefined; onDone: () => void }) {
  const { c } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: async () => {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'text/comma-separated-values',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets[0]) return null;
      const asset = res.assets[0];
      if (asset.size && asset.size > 20 * 1024 * 1024) throw new Error('That file is over 20 MB. Export a smaller range from the terminal system.');
      const form = new FormData();
      if (Platform.OS === 'web' && asset.file) form.append('file', asset.file, asset.name);
      else form.append('file', { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' } as unknown as Blob);
      return endpoints.uploadImport(auditId, form);
    },
    onSuccess: (r) => {
      if (!r) return;
      setError(null);
      onDone();
    },
    onError: (e) => {
      setError((e as Error).message);
      feedback.error();
    },
  });

  const reading = imp && (imp.status === 'UPLOADED' || imp.status === 'PARSING');

  return (
    <View style={{ gap: 14 }}>
      <Txt variant="body" tone="ink2">
        Export the containers for this section from the terminal system as Excel or CSV, then add the file here. The original file is kept with the audit.
      </Txt>
      {imp?.status === 'FAILED' ? <Banner tone="warning">{imp.failureReason ?? 'That file could not be read. Try exporting it again.'}</Banner> : null}
      {error ? <Banner tone="warning">{error}</Banner> : null}
      {reading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.sm, backgroundColor: c.paper2 }}>
          <Icon name="file-xls" size={24} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong">{imp.fileName}</Txt>
            <Txt variant="caption" tone="muted">
              Reading the file...
            </Txt>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose the export file"
          onPress={() => upload.mutate()}
          disabled={upload.isPending}
          style={(s) => ({
            alignItems: 'center',
            gap: 10,
            paddingVertical: 32,
            paddingHorizontal: 16,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: (s as { hovered?: boolean }).hovered ? c.ink : c.ruleStrong,
            backgroundColor: c.paper2,
          })}
        >
          <Icon name="file-arrow-up" size={32} />
          <Txt variant="bodyStrong">{upload.isPending ? 'Uploading...' : 'Choose the export file'}</Txt>
          <Txt variant="caption" tone="muted">
            Excel (.xlsx, .xls) or CSV, up to 20 MB
          </Txt>
        </Pressable>
      )}
    </View>
  );
}

/* Step 3 */

function MapStep({ imp, onDone }: { imp: ImportDto; onDone: () => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const initial = (imp.mapping ?? imp.suggestedMapping ?? {}) as Partial<ColumnMap>;
  const [map, setMap] = useState<Partial<ColumnMap>>(initial);
  const [mode, setMode] = useState<ImportMode>(imp.mode ?? 'append');
  const [saveAs, setSaveAs] = useState('');
  const headers = imp.headers.map((h) => ({ value: h, label: h, detail: imp.sampleRows[0]?.[h] ? `e.g. ${imp.sampleRows[0][h]}` : undefined }));

  const save = useMutation({
    mutationFn: () =>
      endpoints.setMapping(imp.id, {
        mapping: map as ColumnMap,
        mode,
        ...(saveAs.trim().length >= 2 ? { saveAs: saveAs.trim() } : {}),
      }),
    onSuccess: () => onDone(),
    onError: (e) => toast({ text: (e as Error).message, tone: 'error' }),
  });

  const shown = IMPORT_FIELDS.filter((f) => f !== 'containerNumber');

  return (
    <View style={{ gap: 18 }}>
      <Txt variant="body" tone="ink2">
        {`Found ${fmt(imp.rowCount)} rows in ${imp.sheetName ? `the sheet "${imp.sheetName}"` : 'the file'}. Tell us which column holds what. Only the container number is needed; everything else in the row is kept anyway.`}
      </Txt>
      {imp.suggestedMapping ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="check-circle" size={18} color={c.found} weight="fill" />
          <Txt variant="bodySm" tone="ink2">
            We matched the columns we recognised. Check them below.
          </Txt>
        </View>
      ) : null}

      <Select label={fieldWords.containerNumber.label} required value={map.containerNumber} options={headers} onChange={(v) => setMap((m) => ({ ...m, containerNumber: v ?? undefined }))} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
        {shown.map((f) => (
          <View key={f} style={{ flexGrow: 1, flexBasis: 220, minWidth: 0 }}>
            <Select
              label={fieldWords[f].label}
              value={map[f] ?? null}
              options={headers}
              allowNone
              onChange={(v) => setMap((m) => ({ ...m, [f]: v ?? undefined }))}
            />
          </View>
        ))}
      </View>

      <SamplePreview imp={imp} map={map} />

      <View style={{ gap: 8 }}>
        <Txt variant="bodySmStrong">If this audit already has a list</Txt>
        <FilterPills<ImportMode>
          label="Add or replace"
          value={mode}
          onChange={setMode}
          options={[
            { id: 'append', label: 'Add to it' },
            { id: 'replace', label: 'Replace it' },
          ]}
        />
      </View>

      <TextField
        label="Save these choices as"
        hint="Optional. Next time a file with the same columns comes in, they are picked for you."
        placeholder="Terminal yard export"
        value={saveAs}
        onChangeText={setSaveAs}
        maxLength={80}
      />

      <Button label="Check the rows" size="lg" disabled={!map.containerNumber} loading={save.isPending} onPress={() => save.mutate()} />
    </View>
  );
}

function SamplePreview({ imp, map }: { imp: ImportDto; map: Partial<ColumnMap> }) {
  const { c } = useTheme();
  const cols = IMPORT_FIELDS.filter((f) => map[f]);
  if (!imp.sampleRows.length || !cols.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <Txt variant="label" tone="muted" caps>
        How the first rows read
      </Txt>
      <ScrollView horizontal style={{ borderWidth: 1, borderColor: c.rule, borderRadius: radius.sm }}>
        <View>
          <View style={{ flexDirection: 'row', backgroundColor: c.paper2 }}>
            {cols.map((f) => (
              <Txt key={f} variant="label" tone="muted" caps style={{ width: 150, padding: 10 }} numberOfLines={1}>
                {fieldWords[f].label}
              </Txt>
            ))}
          </View>
          {imp.sampleRows.slice(0, 5).map((row, i) => (
            <View key={i} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: c.rule }}>
              {cols.map((f) => (
                <Txt key={f} style={{ width: 150, padding: 10, fontFamily: f === 'containerNumber' ? fonts.monoMedium : fonts.regular, fontSize: 13, lineHeight: 18 }} numberOfLines={1}>
                  {row[map[f]!] ?? ''}
                </Txt>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

/* Step 4 */

function CheckStep({ imp, onDone, onRemap }: { imp: ImportDto; onDone: () => void; onRemap: () => void }) {
  const { c } = useTheme();
  const toast = useToast();
  const commit = useMutation({
    mutationFn: () => endpoints.commitImport(imp.id),
    onSuccess: () => {
      feedback.success();
      toast({ text: `${fmt(imp.validCount)} containers added to the list.`, tone: 'success' });
      onDone();
    },
    onError: (e) => toast({ text: (e as Error).message, tone: 'error' }),
  });
  if (imp.status === 'READY' && !imp.validated) {
    return (
      <View style={{ gap: 10 }}>
        <Txt variant="body" tone="ink2">
          Checking every row...
        </Txt>
        <Skeleton height={10} />
      </View>
    );
  }

  if (imp.status === 'PARSING') {
    return (
      <View style={{ gap: 10 }}>
        <Txt variant="body" tone="ink2">
          Adding the containers to the list...
        </Txt>
        <Skeleton height={10} />
      </View>
    );
  }

  const stats: { n: number; label: string; tone?: 'bad' }[] = [
    { n: imp.validCount, label: 'Good rows' },
    { n: imp.invalidCount, label: 'Bad numbers', tone: 'bad' },
    { n: imp.duplicateCount, label: 'Listed twice' },
    { n: imp.outOfSectionCount, label: 'Outside this section' },
  ];

  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {stats.map((s) => (
          <View key={s.label} style={{ flexGrow: 1, flexBasis: 140, padding: 14, gap: 4, borderRadius: radius.sm, backgroundColor: c.paper2 }}>
            <Txt variant="label" tone="muted" caps>
              {s.label}
            </Txt>
            <Txt style={{ fontFamily: fonts.monoMedium, fontSize: 28, lineHeight: 34 }} color={s.tone === 'bad' && s.n > 0 ? c.missing : c.ink}>
              {fmt(s.n)}
            </Txt>
          </View>
        ))}
      </View>
      {imp.outOfSectionCount > 0 ? (
        <Txt variant="bodySm" tone="muted">
          Rows outside this section have a location that does not start with one of the section codes. They are left off the list.
        </Txt>
      ) : null}
      {imp.errors.length ? (
        <View style={{ gap: 8 }}>
          <Txt variant="label" tone="muted" caps>{`Rows with problems${imp.errors.length > 50 ? ', first 50' : ''}`}</Txt>
          <View style={{ borderWidth: 1, borderColor: c.rule, borderRadius: radius.sm, maxHeight: 260 }}>
            <ScrollView>
              {imp.errors.slice(0, 50).map((e, i) => (
                <View key={`${e.row}-${i}`} style={{ flexDirection: 'row', gap: 12, padding: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.rule }}>
                  <Txt style={{ fontFamily: fonts.mono, fontSize: 13, width: 70 }} tone="muted">{`Row ${e.row}`}</Txt>
                  <Txt style={{ fontFamily: fonts.monoMedium, fontSize: 13, width: 130 }} numberOfLines={1}>
                    {e.value ?? ''}
                  </Txt>
                  <Txt variant="bodySm" tone="ink2" style={{ flex: 1 }}>
                    {e.message}
                  </Txt>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <StatusChip bucket="found" label="Every row reads well" />
        </View>
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button
          label={imp.validCount ? `Add ${fmt(imp.validCount)} containers` : 'Nothing to add'}
          size="lg"
          disabled={!imp.validCount}
          loading={commit.isPending}
          onPress={() => commit.mutate()}
        />
        <Button label="Change the columns" variant="secondary" size="lg" onPress={onRemap} />
      </View>
    </View>
  );
}

/* Step 5 */

function CrewStep({ auditId, current, onDone }: { auditId: string; current: string[]; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const users = useUsers({ role: 'AUDITOR', active: true });
  const [picked, setPicked] = useState<string[]>(current);
  const [q, setQ] = useState('');
  const list = (users.data?.items ?? []).filter((u) => !q || `${u.fullName} ${u.staffId}`.toLowerCase().includes(q.toLowerCase()));

  const save = useMutation({
    mutationFn: () => endpoints.setAssignees(auditId, picked),
    onSuccess: (a) => {
      qc.setQueryData(keys.audit(auditId), a);
      onDone();
    },
    onError: (e) => toast({ text: (e as Error).message, tone: 'error' }),
  });

  return (
    <View style={{ gap: 14 }}>
      <Txt variant="body" tone="ink2">
        The people you pick get this audit on their phones, with the list ready to scan offline.
      </Txt>
      <TextField label="Find someone" value={q} onChangeText={setQ} placeholder="Name or staff ID" />
      {users.isPending ? (
        <Skeleton height={140} />
      ) : list.length === 0 ? (
        <EmptyState icon="users" title="No yard crew found" body="Add crew under People first. Their role must be Yard crew." />
      ) : (
        <View style={{ gap: 2 }}>
          {list.map((u) => (
            <CheckRow
              key={u.id}
              label={u.fullName}
              detail={u.staffId}
              checked={picked.includes(u.id)}
              onChange={(v) => setPicked((p) => (v ? [...p, u.id] : p.filter((x) => x !== u.id)))}
            />
          ))}
        </View>
      )}
      <Button label={picked.length ? `Give it to ${picked.length} ${picked.length === 1 ? 'person' : 'people'}` : 'Pick at least one person'} size="lg" disabled={!picked.length} loading={save.isPending} onPress={() => save.mutate()} />
    </View>
  );
}

/* Step 6 */

function StartStep({ auditId, expected, crew, onBack }: { auditId: string; expected: number; crew: number; onBack: () => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const start = useMutation({
    mutationFn: () => endpoints.startAudit(auditId),
    onSuccess: () => {
      feedback.success();
      void qc.invalidateQueries({ queryKey: ['audits'] });
      toast({ text: 'Audit started. The crew can scan now.', tone: 'success' });
      router.replace(`/dashboard/audits/${auditId}` as never);
    },
    onError: (e) => toast({ text: e instanceof ApiError ? e.message : 'Could not start the audit.', tone: 'error' }),
  });
  return (
    <View style={{ gap: 14 }}>
      <Txt variant="body" tone="ink2">
        {`${fmt(expected)} containers on the list and ${crew} ${crew === 1 ? 'person' : 'people'} ready. When you start, their phones download the list and the dashboard goes live.`}
      </Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Button
          label="Start audit"
          icon="broadcast"
          size="lg"
          loading={start.isPending}
          onPress={async () => {
            const ok = await confirm({ title: 'Start the audit now?', body: 'The crew can start scanning straight away.', confirmLabel: 'Start audit' });
            if (ok) start.mutate();
          }}
        />
        <Button label="Change the crew" variant="secondary" size="lg" onPress={onBack} />
      </View>
    </View>
  );
}
