import type { FacilityDto, FacilityType, SectionDto, SectionKind, YardDto } from '@cymis/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { keys, useAllFacilities } from '@/api/queries';
import { feedback } from '@/feedback';
import { AdminOnly } from '@/features/dash/AdminOnly';
import { areaWords, isWholeYard, sectionKindWords } from '@/features/dash/format';
import { Page, PageHeader } from '@/features/dash/Page';
import { Select } from '@/features/dash/Select';
import { useLayout, useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Button, EmptyState, Icon, IconButton, Pill, SectionTitle, Sheet, Skeleton, TextField, Txt, useConfirm, useToast } from '@/ui';

const siteTypes: { value: FacilityType; label: string }[] = [
  { value: 'PORT', label: 'Port' },
  { value: 'CFS', label: 'Container freight station' },
  { value: 'ICD', label: 'Inland container depot' },
  { value: 'DEPOT', label: 'Empty depot' },
];

type AreaOpen = { facility: FacilityDto; yardId: string | null; section: SectionDto | null; whole: boolean };

export default function YardManagement() {
  return (
    <AdminOnly>
      <YardManagementPage />
    </AdminOnly>
  );
}

function YardManagementPage() {
  const facilities = useAllFacilities();
  const [addSite, setAddSite] = useState(false);
  const [yardOpen, setYardOpen] = useState<{ facility: FacilityDto; yard: YardDto | null } | null>(null);
  const [areaOpen, setAreaOpen] = useState<AreaOpen | null>(null);
  const list = facilities.data ?? [];

  return (
    <Page gap={32} maxWidth={980}>
      <PageHeader
        title="Yard management"
        subtitle="Set up each yard and the blocks inside it. A yard plan counts one block, or one whole yard."
        actions={<Button label="Add site" icon="plus" variant="secondary" onPress={() => setAddSite(true)} />}
      />
      {facilities.isPending ? (
        <View style={{ gap: 12 }}>
          <Skeleton height={28} width="40%" />
          <Skeleton height={64} radius={14} />
          <Skeleton height={64} radius={14} />
        </View>
      ) : facilities.isError ? (
        <EmptyState
          icon="warning-circle"
          title="Could not load your yards"
          body={(facilities.error as Error).message}
          action={<Button label="Try again" variant="secondary" onPress={() => void facilities.refetch()} />}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon="buildings"
          title="No sites yet"
          body="A site is the port or depot your yards belong to. Add it first, then its yards and blocks."
          action={<Button label="Add site" icon="plus" onPress={() => setAddSite(true)} />}
        />
      ) : (
        list.map((f) => <Site key={f.id} facility={f} onAddYard={() => setYardOpen({ facility: f, yard: null })} onEditYard={(yard) => setYardOpen({ facility: f, yard })} onArea={setAreaOpen} />)
      )}

      <SiteSheet open={addSite} onClose={() => setAddSite(false)} />
      <Sheet open={!!yardOpen} onClose={() => setYardOpen(null)} label={yardOpen?.yard ? 'Edit yard' : 'Add yard'} width={480}>
        {yardOpen ? <YardForm key={yardOpen.yard?.id ?? yardOpen.facility.id} facility={yardOpen.facility} yard={yardOpen.yard} onClose={() => setYardOpen(null)} /> : null}
      </Sheet>
      <Sheet open={!!areaOpen} onClose={() => setAreaOpen(null)} label={areaOpen?.section ? 'Edit area' : 'Add area'} width={560}>
        {areaOpen ? <AreaForm key={areaOpen.section?.id ?? `${areaOpen.yardId}-${areaOpen.whole}`} open={areaOpen} onClose={() => setAreaOpen(null)} /> : null}
      </Sheet>
    </Page>
  );
}

function Site({ facility, onAddYard, onEditYard, onArea }: { facility: FacilityDto; onAddYard: () => void; onEditYard: (y: YardDto) => void; onArea: (o: AreaOpen) => void }) {
  const loose = facility.sections.filter((s) => !s.yardId);
  return (
    <View style={{ gap: 18 }}>
      <SectionTitle
        title={facility.name}
        aside={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Txt variant="monoSm" tone="muted">
              {facility.code}
            </Txt>
            {!facility.isActive ? <Pill label="Turned off" filled /> : null}
            <Button label="Add yard" icon="plus" variant="secondary" onPress={onAddYard} />
          </View>
        }
      />
      {facility.yards.length === 0 ? (
        <EmptyState
          icon="map-trifold"
          title="No yards yet"
          body={loose.length ? 'Add a yard, then put the areas below into it.' : 'Add a yard, then the blocks inside it.'}
          action={<Button label="Add yard" icon="plus" onPress={onAddYard} />}
        />
      ) : (
        facility.yards.map((y) => (
          <YardGroup
            key={y.id}
            yard={y}
            areas={facility.sections.filter((s) => s.yardId === y.id)}
            onEdit={() => onEditYard(y)}
            onAdd={(whole) => onArea({ facility, yardId: y.id, section: null, whole })}
            onEditArea={(section) => onArea({ facility, yardId: y.id, section, whole: false })}
          />
        ))
      )}
      {loose.length ? (
        <View style={{ gap: 2 }}>
          <View style={{ gap: 2, paddingBottom: 6 }}>
            <Txt variant="bodyStrong">Not in a yard</Txt>
            <Txt variant="caption" tone="muted">
              {facility.yards.length ? 'These still work. Edit one to put it in a yard.' : 'These still work, and can go into a yard once you add one.'}
            </Txt>
          </View>
          {loose.map((s) => (
            <AreaRow key={s.id} area={s} onEdit={() => onArea({ facility, yardId: null, section: s, whole: false })} />
          ))}
        </View>
      ) : null}
      {facility.yards.length === 0 && !loose.length ? null : (
        <View style={{ alignSelf: 'flex-start' }}>
          <Button label="Add an area not in a yard" variant="quiet" onPress={() => onArea({ facility, yardId: null, section: null, whole: false })} />
        </View>
      )}
    </View>
  );
}

function YardGroup({ yard, areas, onEdit, onAdd, onEditArea }: { yard: YardDto; areas: SectionDto[]; onEdit: () => void; onAdd: (whole: boolean) => void; onEditArea: (s: SectionDto) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: c.ruleStrong, opacity: yard.isActive ? 1 : 0.6 }}>
        <Txt variant="bodyStrong" accessibilityRole="header">
          {yard.name}
        </Txt>
        <Txt variant="monoSm" tone="muted">
          {yard.code}
        </Txt>
        {!yard.isActive ? <Pill label="Turned off" filled /> : null}
        <View style={{ flex: 1 }} />
        {yard.isActive ? <Button label="Add block" icon="plus" variant="quiet" onPress={() => onAdd(false)} /> : null}
        <IconButton icon="pencil-simple" label={`Edit ${yard.name}`} onPress={onEdit} />
      </View>
      {areas.length ? (
        areas.map((s) => <AreaRow key={s.id} area={s} onEdit={() => onEditArea(s)} />)
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingVertical: 14 }}>
          <Txt variant="bodySm" tone="muted" style={{ flexBasis: 280, flexGrow: 1 }}>
            {yard.isActive ? 'Nothing here yet. Add its blocks, or count the whole yard as one area.' : 'This yard is turned off.'}
          </Txt>
          {yard.isActive ? <Button label="Count the whole yard" variant="secondary" onPress={() => onAdd(true)} /> : null}
        </View>
      )}
    </View>
  );
}

function AreaRow({ area, onEdit }: { area: SectionDto; onEdit: () => void }) {
  const { c } = useTheme();
  const corners = area.boundary?.length ?? 0;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.rule, opacity: area.isActive ? 1 : 0.6 }}>
      <View style={{ flexBasis: 200, flexGrow: 1, gap: 2 }}>
        <Txt variant="bodyStrong" style={{ fontSize: 15 }}>
          {area.name}
        </Txt>
        <Txt variant="caption" tone="muted">{`${area.code}, ${areaWords(area)}`}</Txt>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, flexBasis: 220, flexGrow: 2 }}>
        {area.locationCodes.length ? (
          area.locationCodes.slice(0, 10).map((code) => <CodeChip key={code} code={code} />)
        ) : (
          <Txt variant="caption" tone="muted">
            Every row in an upload is kept.
          </Txt>
        )}
        {area.locationCodes.length > 10 ? <Txt variant="caption" tone="muted">{`+${area.locationCodes.length - 10} more`}</Txt> : null}
      </View>
      {!area.isActive ? <Pill label="Turned off" filled /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {corners ? <Icon name="check-circle" size={16} color={c.muted} /> : null}
        <MapLink id={area.id} label={corners ? `Edit shape, ${corners} corners` : 'Choose coordinates'} name={area.name} />
        <IconButton icon="pencil-simple" label={`Edit ${area.name}`} onPress={onEdit} />
      </View>
    </View>
  );
}

/** A real link, so Ctrl click opens the map in a new tab. */
function MapLink({ id, label, name }: { id: string; label: string; name: string }) {
  const { c } = useTheme();
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <Link href={`/dashboard/admin/sections/${id}/map` as Href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${label}, ${name}`}
        onPress={() => feedback.select()}
        onHoverIn={() => setHover(true)}
        onHoverOut={() => setHover(false)}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: 36,
          paddingHorizontal: 12,
          borderRadius: radius.sm,
          borderWidth: 1,
          borderColor: c.rule,
          backgroundColor: hover ? c.hover : 'transparent',
          opacity: pressed ? 0.7 : 1,
        }}
      >
        <Icon name="map-pin" size={16} color={c.ink2} />
        <Txt style={{ fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 }} tone="ink2">
          {label}
        </Txt>
      </Pressable>
    </Link>
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

/** Says what went wrong inside the sheet. A toast would sit behind the sheet's dimmer on the web. */
function FormError({ error }: { error: unknown }) {
  const { c } = useTheme();
  if (!error) return null;
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', gap: 8 }}>
      <Icon name="warning-circle" size={18} color={c.dangerText} />
      <Txt variant="bodySm" tone="dangerText" style={{ flex: 1 }}>
        {(error as Error).message}
      </Txt>
    </View>
  );
}

function SiteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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
  });
  return (
    <Sheet open={open} onClose={onClose} label="Add site" width={480}>
      <Txt variant="heading">Add a site</Txt>
      <Txt variant="bodySm" tone="muted">
        The port or depot your yards belong to.
      </Txt>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Sample Container Terminal" />
      <TextField label="Short code" mono value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="SCT" maxLength={24} hint="Letters, digits, dash or underscore." />
      <Select label="Type" value={type} options={siteTypes} onChange={(v) => v && setType(v as FacilityType)} />
      <FormError error={create.error} />
      <Button label="Add site" size="lg" block disabled={!code.trim() || name.trim().length < 2} loading={create.isPending} onPress={() => create.mutate()} />
    </Sheet>
  );
}

function YardForm({ facility, yard, onClose }: { facility: FacilityDto; yard: YardDto | null; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [code, setCode] = useState('');
  const [name, setName] = useState(yard?.name ?? '');
  const done = (text: string) => {
    feedback.success();
    void qc.invalidateQueries({ queryKey: keys.facilities() });
    toast({ text, tone: 'success' });
    onClose();
  };
  const save = useMutation({
    mutationFn: () => (yard ? endpoints.updateYard(yard.id, { name: name.trim() }) : endpoints.createYard({ facilityId: facility.id, code: code.trim(), name: name.trim() })),
    onSuccess: () => done(yard ? 'Yard saved.' : `${name.trim()} added.`),
  });
  const toggle = useMutation({
    mutationFn: () => endpoints.updateYard(yard!.id, { isActive: !yard!.isActive }),
    onSuccess: () => done(yard!.isActive ? 'Yard turned off.' : 'Yard turned back on.'),
  });
  return (
    <>
      <Txt variant="heading">{yard ? `Edit ${yard.name}` : `Add a yard to ${facility.name}`}</Txt>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Main yard" />
      {!yard ? <TextField label="Short code" mono value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="MAIN" maxLength={20} hint="Letters, digits, dash or underscore." /> : null}
      <FormError error={save.error ?? toggle.error} />
      <Button label={yard ? 'Save yard' : 'Add yard'} size="lg" block disabled={name.trim().length < 2 || (!yard && !code.trim())} loading={save.isPending} onPress={() => save.mutate()} />
      {yard ? (
        <Button
          label={yard.isActive ? 'Turn off this yard' : 'Turn this yard back on'}
          variant={yard.isActive ? 'danger-quiet' : 'secondary'}
          size="lg"
          block
          loading={toggle.isPending}
          onPress={async () => {
            if (yard.isActive) {
              const ok = await confirm({ title: `Turn off ${yard.name}?`, body: 'It leaves the list of yards. Blocks and past yard plans are kept.', confirmLabel: 'Turn off', danger: true });
              if (!ok) return;
            }
            toggle.mutate();
          }}
        />
      ) : null}
    </>
  );
}

function AreaForm({ open, onClose }: { open: AreaOpen; onClose: () => void }) {
  const { facility, section, whole: startWhole } = open;
  const { height } = useLayout();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const startYard = facility.yards.find((y) => y.id === open.yardId);
  const [whole, setWhole] = useState(section ? isWholeYard(section) : startWhole);
  const [yardId, setYardId] = useState<string | null>(section ? section.yardId : open.yardId);
  const [code, setCode] = useState(startWhole && startYard ? `${startYard.code}-ALL`.slice(0, 24) : '');
  const [name, setName] = useState(section?.name ?? (startWhole && startYard ? `${startYard.name}, whole yard` : ''));
  const [kind, setKind] = useState<SectionKind>(section && !isWholeYard(section) ? section.kind : 'YARD_BLOCK');
  const [codes, setCodes] = useState<string[]>(section?.locationCodes ?? []);
  const [draft, setDraft] = useState('');
  const yards = facility.yards.filter((y) => y.isActive || y.id === section?.yardId);

  const done = (text: string) => {
    feedback.success();
    void qc.invalidateQueries({ queryKey: keys.facilities() });
    toast({ text, tone: 'success' });
    onClose();
  };
  // A whole yard is an area with no location codes, which keeps every row.
  const body = { name: name.trim(), kind: whole ? ('OTHER' as const) : kind, locationCodes: whole ? [] : codes, yardId };
  const save = useMutation({
    mutationFn: () => (section ? endpoints.updateSection(section.id, body) : endpoints.createSection({ facilityId: facility.id, code: code.trim(), ...body })),
    onSuccess: () => done(section ? 'Saved.' : `${name.trim()} added.`),
  });
  const toggle = useMutation({
    mutationFn: () => endpoints.updateSection(section!.id, { isActive: !section!.isActive }),
    onSuccess: () => done(section!.isActive ? 'Turned off.' : 'Turned back on.'),
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

  // Taller than a laptop screen, so it scrolls inside the sheet and its button can always be reached.
  return (
    <ScrollView style={{ maxHeight: Math.max(240, height - 120) }} contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
      <Txt variant="heading">{section ? `Edit ${section.name}` : startWhole ? 'Count the whole yard' : 'Add a block'}</Txt>

      <View accessibilityRole="radiogroup" accessibilityLabel="What this covers" style={{ gap: 8 }}>
        <Txt variant="bodySmStrong">What does this cover?</Txt>
        <CoverChoice on={!whole} title="A block" body="Rows whose location starts with one of its codes are kept. Rows with a location elsewhere are left off, and you see how many before loading." onPress={() => setWhole(false)} />
        <CoverChoice on={whole} title="The whole yard" body="Every row in an upload is kept, so one yard plan covers the whole yard." onPress={() => setWhole(true)} />
      </View>

      <TextField label="Name" value={name} onChangeText={setName} placeholder={whole ? 'Main yard, whole yard' : 'Yard Block A'} />
      {!section ? <TextField label="Short code" mono value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder={whole ? 'MAIN-ALL' : 'BLK-A'} maxLength={24} hint="Letters, digits, dash or underscore." /> : null}
      <Select
        label="Yard"
        value={yardId}
        options={yards.map((y) => ({ value: y.id, label: y.name }))}
        onChange={setYardId}
        allowNone
        noneLabel="Not in a yard"
        placeholder="Not in a yard"
      />

      {!whole ? (
        <>
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
                  hint={codes.length ? 'Separate with spaces or commas.' : 'With no codes, every row is kept, the same as the whole yard. Separate with spaces or commas.'}
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
        </>
      ) : null}

      <FormError error={save.error ?? toggle.error} />
      <Button label={section ? 'Save' : whole ? 'Add the whole yard' : 'Add block'} size="lg" block disabled={name.trim().length < 2 || (!section && !code.trim())} loading={save.isPending} onPress={() => save.mutate()} />
      {section ? (
        <Button
          label={section.isActive ? 'Turn this off' : 'Turn this back on'}
          variant={section.isActive ? 'danger-quiet' : 'secondary'}
          size="lg"
          block
          loading={toggle.isPending}
          onPress={async () => {
            if (section.isActive) {
              const ok = await confirm({
                title: `Turn off ${section.name}?`,
                body: 'It stops showing up when people set up new yard plans. Past yard plans are kept.',
                confirmLabel: 'Turn off',
                danger: true,
              });
              if (!ok) return;
            }
            toggle.mutate();
          }}
        />
      ) : null}
    </ScrollView>
  );
}

function CoverChoice({ on, title, body, onPress }: { on: boolean; title: string; body: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={() => {
        feedback.select();
        onPress();
      }}
      style={(s) => ({
        flexDirection: 'row',
        gap: 12,
        padding: 12,
        borderRadius: radius.sm,
        borderWidth: on ? 2 : 1,
        borderColor: on ? c.ink : c.rule,
        backgroundColor: (s as { hovered?: boolean }).hovered ? c.hover : c.raised,
      })}
    >
      <View style={{ width: 18, height: 18, marginTop: 2, borderRadius: 9, borderWidth: on ? 5 : 1.5, borderColor: on ? c.ink : c.ruleStrong }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodySmStrong">{title}</Txt>
        <Txt variant="caption" tone="muted">
          {body}
        </Txt>
      </View>
    </Pressable>
  );
}
