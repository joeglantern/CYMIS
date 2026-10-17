import type { FacilityDto, FacilityType, SectionDto, SectionKind } from '@cymis/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { keys, useFacilities } from '@/api/queries';
import { feedback } from '@/feedback';
import { AdminOnly } from '@/features/dash/AdminOnly';
import { sectionKindWords } from '@/features/dash/format';
import { Page, PageHeader } from '@/features/dash/Page';
import { Select } from '@/features/dash/Select';
import { useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Button, EmptyState, Icon, Pill, SectionTitle, Sheet, Skeleton, TextField, Txt, useConfirm, useToast } from '@/ui';

const facilityTypes: { value: FacilityType; label: string }[] = [
  { value: 'PORT', label: 'Port' },
  { value: 'CFS', label: 'Container freight station' },
  { value: 'ICD', label: 'Inland container depot' },
  { value: 'DEPOT', label: 'Empty depot' },
];

export default function Sections() {
  return (
    <AdminOnly>
      <SectionsPage />
    </AdminOnly>
  );
}

function SectionsPage() {
  const facilities = useFacilities();
  const [addFacility, setAddFacility] = useState(false);
  const [sectionFor, setSectionFor] = useState<FacilityDto | null>(null);
  const [editing, setEditing] = useState<SectionDto | null>(null);
  const list = facilities.data ?? [];

  return (
    <Page gap={28} maxWidth={980}>
      <PageHeader
        title="Facilities and sections"
        subtitle="Sections are the parts of the yard you audit. Location codes tell the importer which rows belong to a section."
        actions={<Button label="Add facility" icon="plus" variant="secondary" onPress={() => setAddFacility(true)} />}
      />
      {facilities.isPending ? (
        <Skeleton height={160} radius={14} />
      ) : facilities.isError ? (
        <EmptyState icon="warning-circle" title="Could not load facilities" body={(facilities.error as Error).message} />
      ) : list.length === 0 ? (
        <EmptyState icon="buildings" title="No facilities yet" body="Add the port or depot first, then its sections." action={<Button label="Add facility" icon="plus" onPress={() => setAddFacility(true)} />} />
      ) : (
        list.map((f) => (
          <View key={f.id} style={{ gap: 6 }}>
            <SectionTitle
              title={`${f.name}`}
              aside={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Txt variant="monoSm" tone="muted">
                    {f.code}
                  </Txt>
                  {!f.isActive ? <Pill label="Turned off" filled /> : null}
                  <Button label="Add section" icon="plus" variant="quiet" onPress={() => setSectionFor(f)} />
                </View>
              }
            />
            {f.sections.length === 0 ? (
              <Txt variant="bodySm" tone="muted" style={{ paddingVertical: 12 }}>
                No sections yet.
              </Txt>
            ) : (
              f.sections.map((s, i) => <SectionLine key={s.id} section={s} last={i === f.sections.length - 1} onPress={() => setEditing(s)} />)
            )}
          </View>
        ))
      )}

      <FacilitySheet open={addFacility} onClose={() => setAddFacility(false)} />
      <SectionSheet open={!!sectionFor || !!editing} facility={sectionFor} section={editing} onClose={() => { setSectionFor(null); setEditing(null); }} />
    </Page>
  );
}

function SectionLine({ section, last, onPress }: { section: SectionDto; last: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${section.name}`}
      onPress={onPress}
      style={(s) => ({
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 16,
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: c.rule,
        backgroundColor: (s as { hovered?: boolean }).hovered ? c.hover : 'transparent',
        opacity: section.isActive ? 1 : 0.55,
      })}
    >
      <View style={{ flexBasis: 220, flexGrow: 1, gap: 2 }}>
        <Txt variant="bodyStrong" style={{ fontSize: 15 }}>
          {section.name}
        </Txt>
        <Txt variant="caption" tone="muted">{`${section.code}, ${sectionKindWords[section.kind]}`}</Txt>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, flexBasis: 240, flexGrow: 2 }}>
        {section.locationCodes.length ? (
          section.locationCodes.slice(0, 12).map((code) => <CodeChip key={code} code={code} />)
        ) : (
          <Txt variant="caption" tone="muted">
            No location codes. Every row in an import is kept.
          </Txt>
        )}
        {section.locationCodes.length > 12 ? <Txt variant="caption" tone="muted">{`+${section.locationCodes.length - 12} more`}</Txt> : null}
      </View>
      {!section.isActive ? <Pill label="Turned off" filled /> : null}
      <Icon name="pencil-simple" size={18} color={c.muted} />
    </Pressable>
  );
}

function CodeChip({ code, onRemove }: { code: string; onRemove?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, height: 26, paddingLeft: 8, paddingRight: onRemove ? 4 : 8, borderRadius: radius.sm, backgroundColor: c.paper2, borderWidth: 1, borderColor: c.rule }}>
      <Txt style={{ fontFamily: fonts.mono, fontSize: 12, lineHeight: 16 }}>{code}</Txt>
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${code}`} onPress={onRemove} hitSlop={6}>
          <Icon name="x" size={14} color={c.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function FacilitySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<FacilityType>('PORT');
  const create = useMutation({
    mutationFn: () => endpoints.createFacility({ code: code.trim(), name: name.trim(), type }),
    onSuccess: () => {
      feedback.success();
      void qc.invalidateQueries({ queryKey: keys.facilities() });
      toast({ text: `${name.trim()} added.`, tone: 'success' });
      setCode('');
      setName('');
      onClose();
    },
    onError: (e) => toast({ text: (e as Error).message, tone: 'error' }),
  });
  return (
    <Sheet open={open} onClose={onClose} label="Add facility" width={480}>
      <Txt variant="heading">Add a facility</Txt>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Sample Container Terminal" />
      <TextField label="Short code" mono value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="SCT" maxLength={24} hint="Letters, digits, dash or underscore." />
      <Select label="Type" value={type} options={facilityTypes} onChange={(v) => v && setType(v as FacilityType)} />
      <Button label="Add facility" size="lg" block disabled={!code.trim() || name.trim().length < 2} loading={create.isPending} onPress={() => create.mutate()} />
    </Sheet>
  );
}

function SectionSheet({ open, facility, section, onClose }: { open: boolean; facility: FacilityDto | null; section: SectionDto | null; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label={section ? 'Edit section' : 'Add section'} width={540}>
      {open ? <SectionForm key={section?.id ?? facility?.id} facility={facility} section={section} onClose={onClose} /> : null}
    </Sheet>
  );
}

function SectionForm({ facility, section, onClose }: { facility: FacilityDto | null; section: SectionDto | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [code, setCode] = useState(section?.code ?? '');
  const [name, setName] = useState(section?.name ?? '');
  const [kind, setKind] = useState<SectionKind>(section?.kind ?? 'YARD_BLOCK');
  const [codes, setCodes] = useState<string[]>(section?.locationCodes ?? []);
  const [draft, setDraft] = useState('');

  const done = (text: string) => {
    feedback.success();
    void qc.invalidateQueries({ queryKey: keys.facilities() });
    toast({ text, tone: 'success' });
    onClose();
  };
  const save = useMutation({
    mutationFn: () =>
      section
        ? endpoints.updateSection(section.id, { name: name.trim(), kind, locationCodes: codes })
        : endpoints.createSection({ facilityId: facility!.id, code: code.trim(), name: name.trim(), kind, locationCodes: codes }),
    onSuccess: () => done(section ? 'Section saved.' : 'Section added.'),
    onError: (e) => toast({ text: (e as Error).message, tone: 'error' }),
  });
  const toggle = useMutation({
    mutationFn: () => endpoints.updateSection(section!.id, { isActive: !section!.isActive }),
    onSuccess: () => done(section!.isActive ? 'Section turned off.' : 'Section turned back on.'),
    onError: (e) => toast({ text: (e as Error).message, tone: 'error' }),
  });

  const addCodes = () => {
    const parts = draft
      .split(/[\s,;]+/)
      .map((p) => p.trim().toUpperCase())
      .filter(Boolean);
    if (!parts.length) return;
    setCodes((prev) => [...new Set([...prev, ...parts])].slice(0, 200));
    setDraft('');
  };

  return (
    <>
      <Txt variant="heading">{section ? `Edit ${section.name}` : `Add a section to ${facility?.name ?? ''}`}</Txt>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Yard Block A" />
      {!section ? <TextField label="Short code" mono value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="BLK-A" maxLength={24} /> : null}
      <Select label="Kind" value={kind} options={(Object.keys(sectionKindWords) as SectionKind[]).map((k) => ({ value: k, label: sectionKindWords[k] }))} onChange={(v) => v && setKind(v as SectionKind)} />
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <TextField
              label="Location codes"
              mono
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={addCodes}
              placeholder="A01 A02 A03"
              hint="Rows whose location starts with one of these belong here. Separate with spaces or commas."
            />
          </View>
          <View style={{ paddingBottom: 26 }}>
            <Button label="Add" variant="secondary" onPress={addCodes} />
          </View>
        </View>
        {codes.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {codes.map((cd) => (
              <CodeChip key={cd} code={cd} onRemove={() => setCodes((p) => p.filter((x) => x !== cd))} />
            ))}
          </View>
        ) : null}
      </View>
      <Button label={section ? 'Save section' : 'Add section'} size="lg" block disabled={name.trim().length < 2 || (!section && !code.trim())} loading={save.isPending} onPress={() => save.mutate()} />
      {section ? (
        <Button
          label={section.isActive ? 'Turn off this section' : 'Turn this section back on'}
          variant={section.isActive ? 'danger-quiet' : 'secondary'}
          size="lg"
          block
          loading={toggle.isPending}
          onPress={async () => {
            if (section.isActive) {
              const ok = await confirm({
                title: `Turn off ${section.name}?`,
                body: 'It stops showing up when people set up new audits. Past audits are kept.',
                confirmLabel: 'Turn off',
                danger: true,
              });
              if (!ok) return;
            }
            toggle.mutate();
          }}
        />
      ) : null}
    </>
  );
}
