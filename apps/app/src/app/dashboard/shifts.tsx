import type { AuditDto, ShiftDto } from '@cymis/schemas';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { endpoints } from '@/api/endpoints';
import { keys, useAudit, useAudits, useShifts, useUsers } from '@/api/queries';
import { statusWords } from '@/features/dash/format';
import { Page, PageHeader } from '@/features/dash/Page';
import { CheckRow, Select, type SelectOption } from '@/features/dash/Select';
import { clerkChange, shiftNames, type ClerkChange } from '@/features/dash/shiftPlan';
import { feedback } from '@/feedback';
import { addDays, dayKey, dayWord, eatTime, longDay, parseTime, shiftTimes } from '@/lib/eat';
import { useLayout, useTheme } from '@/theme/theme';
import { fonts, radius } from '@/theme/tokens';
import { Avatar, Button, Card, EmptyState, FilterPills, Icon, LiveBadge, Pill, SectionTitle, Skeleton, TextField, Txt, useChoice, useConfirm, useToast } from '@/ui';

type Tab = 'upcoming' | 'past';

// Below this the form takes the whole page instead of sitting beside the list.
const SIDE_BY_SIDE = 1180;
const PANEL_W = 400;
const OPEN: AuditDto['status'][] = ['DRAFT', 'ACTIVE'];
const LIST_LIMIT = 200;

function PlanStatus({ status }: { status: AuditDto['status'] }) {
  if (status === 'ACTIVE') return <LiveBadge />;
  return <Pill label={status === 'DRAFT' ? 'Not started' : statusWords[status]} filled={status !== 'DRAFT'} />;
}

function Hours({ shift }: { shift: Pick<ShiftDto, 'startsAt' | 'endsAt'> }) {
  const next = dayKey(shift.startsAt) !== dayKey(shift.endsAt);
  return (
    <View style={{ gap: 1 }}>
      <Txt variant="monoSm" style={{ fontFamily: fonts.monoMedium }}>{`${eatTime(shift.startsAt)} to ${eatTime(shift.endsAt)}`}</Txt>
      {next ? (
        <Txt variant="caption" tone="muted">
          Ends the next day
        </Txt>
      ) : null}
    </View>
  );
}

function clerkWords(shift: ShiftDto) {
  const names = shift.clerks.map((c) => c.fullName.split(' ')[0]);
  if (!names.length) return 'No clerks yet';
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}

function ShiftRow({ shift, first, selected, narrow, onOpen }: { shift: ShiftDto; first: boolean; selected: boolean; narrow: boolean; onOpen: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      {...({ dataSet: { focusInset: 'true' } } as object)}
      accessibilityState={{ selected }}
      accessibilityLabel={`${shift.name}, ${eatTime(shift.startsAt)} to ${eatTime(shift.endsAt)}, ${shift.audit.name}, ${clerkWords(shift)}, ${statusWords[shift.audit.status]}`}
      onPress={() => {
        feedback.select();
        onOpen();
      }}
      style={(s) => {
        const st = s as { hovered?: boolean; pressed?: boolean };
        return {
          flexDirection: narrow ? 'column' : 'row',
          alignItems: narrow ? 'stretch' : 'center',
          gap: narrow ? 8 : 16,
          minHeight: 60,
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderTopWidth: first ? 0 : 1,
          borderTopColor: c.rule,
          backgroundColor: selected || st.hovered ? c.hover : 'transparent',
          opacity: st.pressed ? 0.7 : 1,
        };
      }}
    >
      {narrow ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <Hours shift={shift} />
          <PlanStatus status={shift.audit.status} />
        </View>
      ) : (
        <View style={{ width: 118 }}>
          <Hours shift={shift} />
        </View>
      )}
      <View style={{ flex: narrow ? undefined : 1.4, minWidth: 0, gap: 2 }}>
        <Txt variant="bodySmStrong" numberOfLines={1}>
          {shift.name}
        </Txt>
        <Txt variant="caption" tone="muted" numberOfLines={1}>
          {`${shift.audit.name}, ${shift.audit.section.name}`}
        </Txt>
      </View>
      <View style={{ flex: narrow ? undefined : 1.2, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {shift.clerks.length ? (
          <View style={{ flexDirection: 'row' }}>
            {shift.clerks.slice(0, 3).map((p, i) => (
              <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -6 }}>
                <Avatar name={p.fullName} size={24} ring={c.raised} />
              </View>
            ))}
          </View>
        ) : null}
        <Txt variant="caption" tone={shift.clerks.length ? 'ink2' : 'muted'} numberOfLines={1} style={{ flexShrink: 1 }}>
          {clerkWords(shift)}
        </Txt>
      </View>
      {narrow ? null : (
        <View style={{ width: 96, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <PlanStatus status={shift.audit.status} />
        </View>
      )}
    </Pressable>
  );
}

function DayGroup({ day, shifts, selected, narrow, onOpen }: { day: string; shifts: ShiftDto[]; selected: string | undefined; narrow: boolean; onOpen: (id: string) => void }) {
  const { c } = useTheme();
  const today = dayKey(Date.now()) === day;
  const word = dayWord(day);
  const named = today || word === 'Tomorrow' || word === 'Yesterday';
  return (
    <View>
      <SectionTitle title={named ? word : longDay(day)} aside={named ? longDay(day) : undefined} />
      {shifts.length ? (
        // Today carries the same dark edge the wizard gives the step you are on.
        <Card style={{ padding: 0, gap: 0, overflow: 'hidden', ...(today ? { borderWidth: 1, borderColor: c.ink } : null) }}>
          {shifts.map((s, i) => (
            <ShiftRow key={s.id} shift={s} first={i === 0} selected={selected === s.id} narrow={narrow} onOpen={() => onOpen(s.id)} />
          ))}
        </Card>
      ) : (
        <Txt variant="bodySm" tone="muted">
          No shifts today.
        </Txt>
      )}
    </View>
  );
}

function groupByDay(shifts: ShiftDto[]) {
  const map = new Map<string, ShiftDto[]>();
  for (const s of shifts) {
    const k = dayKey(s.startsAt);
    map.set(k, [...(map.get(k) ?? []), s]);
  }
  return map;
}

/** Add a shift, or change one. Sits on the page, never over it. */
function ShiftForm({ shift, planId, docked, onClose, onSaved }: { shift: ShiftDto | null; planId?: string; docked: boolean; onClose: () => void; onSaved: (id: string | null) => void }) {
  const { c } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const choose = useChoice();
  const today = dayKey(Date.now());
  const plans = useAudits({});
  const open = (plans.data?.items ?? []).filter((a) => OPEN.includes(a.status));
  const [auditId, setAuditId] = useState<string | null>(shift?.audit.id ?? planId ?? null);
  const [name, setName] = useState(shift?.name ?? '');
  const [day, setDay] = useState(shift ? dayKey(shift.startsAt) : today);
  const [start, setStart] = useState(shift ? eatTime(shift.startsAt) : '06:00');
  const [end, setEnd] = useState(shift ? eatTime(shift.endsAt) : '14:00');
  const [picked, setPicked] = useState<string[]>(shift?.clerks.map((p) => p.id) ?? []);
  const [q, setQ] = useState('');
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const plan = useAudit(auditId ?? undefined);
  const users = useUsers({ role: 'AUDITOR', active: true });
  const finished = !!shift && !OPEN.includes(shift.audit.status);

  // Someone on the shift who has since been turned off still shows, so they can be taken off.
  const everyone = useMemo(() => {
    const all = users.data?.items ?? [];
    const extra = (shift?.clerks ?? []).filter((p) => !all.some((u) => u.id === p.id));
    return [...all, ...extra];
  }, [users.data, shift]);
  const list = everyone.filter((u) => !q || `${u.fullName} ${u.staffId}`.toLowerCase().includes(q.toLowerCase()));

  const startOk = parseTime(start);
  const endOk = parseTime(end);
  const times = startOk && endOk ? shiftTimes(day, startOk, endOk) : null;
  const nameError = tried && name.trim().length < 2 ? 'Give the shift a name, such as Day shift.' : null;
  const planError = tried && !auditId ? 'Pick the yard plan this shift works on.' : null;
  const startError = tried && !startOk ? 'Use a time like 06:00.' : null;
  const endError = tried && !endOk ? 'Use a time like 14:00.' : tried && startOk && endOk && !times ? 'The end must be after the start.' : null;

  const days: SelectOption[] = useMemo(() => {
    const list31 = Array.from({ length: 31 }, (_, i) => addDays(today, i));
    if (!list31.includes(day)) list31.unshift(day);
    return list31.map((k) => ({ value: k, label: longDay(k), detail: k === today ? 'Today' : k === addDays(today, 1) ? 'Tomorrow' : undefined }));
  }, [today, day]);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['shifts'] }),
      qc.invalidateQueries({ queryKey: ['audits'] }),
      auditId ? qc.invalidateQueries({ queryKey: keys.audit(auditId) }) : Promise.resolve(),
    ]);
  };

  const save = useMutation({
    mutationFn: async ({ moves }: { moves: ClerkChange['moves'] }) => {
      if (!auditId || !times) throw new Error('Check the shift details.');

      // Join the new shift before leaving the old one, so a person being moved is never without the plan.
      const saved = shift
        ? await endpoints.updateShift(shift.id, { name: name.trim(), startsAt: times.startsAt, endsAt: times.endsAt, clerkIds: picked })
        : await endpoints.createShift({ auditId, name: name.trim(), startsAt: times.startsAt, endsAt: times.endsAt, clerkIds: picked });

      const sources = new Map<string, { clerkIds: string[]; leave: string[] }>();
      for (const m of moves) {
        for (const s of m.from) {
          const entry = sources.get(s.id) ?? { clerkIds: s.clerkIds, leave: [] };
          entry.leave.push(m.userId);
          sources.set(s.id, entry);
        }
      }
      for (const [id, s] of sources) {
        await endpoints.updateShift(id, { clerkIds: s.clerkIds.filter((u) => !s.leave.includes(u)) });
      }
      return saved;
    },
    onSuccess: async (saved) => {
      await refresh();
      feedback.success();
      toast({ text: shift ? 'Shift saved.' : 'Shift added.', tone: 'success' });
      onSaved(saved.id);
    },
    onError: async (e) => {
      await refresh();
      setProblem((e as Error).message);
    },
  });

  const remove = useMutation({
    mutationFn: () => endpoints.deleteShift(shift!.id),
    onSuccess: async () => {
      await refresh();
      toast({ text: 'Shift deleted.', tone: 'success' });
      onSaved(null);
    },
    onError: (e) => setProblem((e as Error).message),
  });

  const submit = async () => {
    setTried(true);
    setProblem(null);
    if (name.trim().length < 2 || !auditId || !times) return;
    const before = shift?.clerks.map((p) => p.id) ?? [];
    const change: ClerkChange = plan.data ? clerkChange(plan.data, shift?.id ?? null, before, picked) : { moves: [], leaving: [] };

    let moveThem = false;
    if (change.moves.length) {
      const one = change.moves.length === 1;
      const choice = await choose({
        title: one ? `Move ${change.moves[0]!.name} to this shift?` : `Move ${change.moves.length} clerks to this shift?`,
        body: one
          ? `They are also on ${shiftNames(change.moves[0]!.from)}. Move takes them off it. Keep on both leaves them on both.`
          : `Also on another shift: ${change.moves.map((m) => `${m.name} (${shiftNames(m.from)})`).join(', ')}. Move takes them off it. Keep on both leaves them on both.`,
        confirmLabel: 'Move',
        altLabel: 'Keep on both',
      });
      if (!choice) return;
      moveThem = choice === 'confirm';
    }
    if (change.leaving.length) {
      const one = change.leaving.length === 1;
      const ok = await confirm({
        title: 'Take this yard plan off their phone?',
        body: `${change.leaving.map((l) => l.name).join(', ')} ${one ? 'has' : 'have'} no other shift on this plan and ${one ? 'was' : 'were'} not given it directly, so it leaves their phone. Scans they have already taken still arrive. Move them to another shift first if they are still working it.`,
        confirmLabel: 'Take them off',
        danger: true,
      });
      if (!ok) return;
    }
    save.mutate({ moves: moveThem ? change.moves : [] });
  };

  const askDelete = async () => {
    const ok = await confirm({
      title: `Delete ${shift!.name}?`,
      body: 'Clerks who are on this yard plan only through this shift lose it from their phones. Scans they have already taken still arrive. Clerks given the plan directly keep it.',
      confirmLabel: 'Delete shift',
      danger: true,
    });
    if (ok) remove.mutate();
  };

  const planOptions: SelectOption[] = open.map((a) => ({ value: a.id, label: a.name, detail: `${a.section.name}, ${statusWords[a.status]}` }));

  const fields = (
    <View style={{ gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <Txt variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
          {shift ? shift.name : 'New shift'}
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          hitSlop={6}
          style={(s) => ({ width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: (s as { hovered?: boolean }).hovered ? c.hover : 'transparent' })}
        >
          <Icon name="x" size={18} color={c.ink2} />
        </Pressable>
      </View>

      {finished ? (
        <Txt variant="bodySm" tone="ink2">
          {`This yard plan is ${statusWords[shift!.audit.status].toLowerCase()}, so its shifts can no longer change.`}
        </Txt>
      ) : null}

      {shift ? (
        <View style={{ gap: 6 }}>
          <Txt variant="bodySmStrong">Yard plan</Txt>
          <Txt variant="bodySm" tone="ink2">{`${shift.audit.name}, ${shift.audit.section.name}`}</Txt>
        </View>
      ) : (
        <View style={{ gap: 6 }}>
          <Select label="Yard plan" required value={auditId} options={planOptions} onChange={setAuditId} placeholder={plans.isPending ? 'Loading' : 'Choose a yard plan'} />
          {planError ? (
            <Txt variant="caption" color={c.missing}>
              {planError}
            </Txt>
          ) : null}
        </View>
      )}

      {finished ? null : (
        <>
          <TextField label="Name" value={name} onChangeText={setName} placeholder="Day shift" maxLength={60} error={nameError} />
          <Select label="Day" value={day} options={days} onChange={(v) => v && setDay(v)} />
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <TextField label="Starts" value={start} onChangeText={setStart} onBlur={() => setStart((t) => parseTime(t) ?? t)} keyboardType="numbers-and-punctuation" autoCorrect={false} maxLength={5} mono error={startError} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <TextField label="Ends" value={end} onChangeText={setEnd} onBlur={() => setEnd((t) => parseTime(t) ?? t)} keyboardType="numbers-and-punctuation" autoCorrect={false} maxLength={5} mono error={endError} />
              </View>
            </View>
            <Txt variant="caption" tone="muted">
              {times?.nextDay ? 'East Africa Time. Ends the next morning.' : 'East Africa Time.'}
            </Txt>
          </View>
        </>
      )}

      <View style={{ gap: 8 }}>
        <Txt variant="bodySmStrong">{picked.length ? `Clerks (${picked.length})` : 'Clerks'}</Txt>
        {finished ? (
          <Txt variant="bodySm" tone="ink2">
            {shift!.clerks.map((p) => p.fullName).join(', ') || 'Nobody on this shift.'}
          </Txt>
        ) : (
          <>
            <Txt variant="caption" tone="muted">
              Adding a clerk to a shift also gives them the yard plan.
            </Txt>
            <TextField label="Find someone" value={q} onChangeText={setQ} placeholder="Name or staff ID" />
            {users.isPending ? (
              <Skeleton height={120} />
            ) : users.isError ? (
              <Txt variant="bodySm" color={c.missing}>
                {(users.error as Error).message}
              </Txt>
            ) : list.length === 0 ? (
              <Txt variant="bodySm" tone="muted">
                {q ? 'Nobody by that name or staff ID.' : 'No clerks yet. Add them under People first.'}
              </Txt>
            ) : (
              <View style={{ gap: 2 }}>
                {list.map((u) => (
                  <CheckRow key={u.id} label={u.fullName} detail={u.staffId} checked={picked.includes(u.id)} onChange={(v) => setPicked((p) => (v ? [...p, u.id] : p.filter((x) => x !== u.id)))} />
                ))}
              </View>
            )}
          </>
        )}
      </View>

    </View>
  );

  const actions = finished ? null : (
    <View style={{ gap: 8 }}>
      {problem ? (
        <Txt accessibilityRole="alert" variant="bodySm" color={c.missing}>
          {problem}
        </Txt>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button label={shift ? 'Save shift' : 'Add shift'} size="lg" style={{ flex: 1 }} loading={save.isPending} disabled={remove.isPending || (!!auditId && plan.isPending)} onPress={() => void submit()} />
        {shift ? <Button label="Delete" accessibilityLabel="Delete shift" variant="danger-quiet" size="lg" loading={remove.isPending} disabled={save.isPending} onPress={() => void askDelete()} /> : null}
      </View>
    </View>
  );

  // Beside the list the actions stay in view however long the clerk list runs.
  if (docked) {
    return (
      <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }} keyboardShouldPersistTaps="handled">
          {fields}
        </ScrollView>
        {actions ? <View style={{ padding: 16, paddingHorizontal: 24, borderTopWidth: 1, borderTopColor: c.rule }}>{actions}</View> : null}
      </View>
    );
  }
  return (
    <View style={{ gap: 18 }}>
      {fields}
      {actions}
    </View>
  );
}

function Loading() {
  return (
    <View style={{ gap: 12 }}>
      <Skeleton height={28} width={200} />
      <Skeleton height={124} radius={14} />
      <Skeleton height={28} width={200} />
      <Skeleton height={64} radius={14} />
    </View>
  );
}

/** Who works which yard plan, and when. Planning only: shift times never stop a scan. */
export default function Shifts() {
  const { c } = useTheme();
  const { width } = useLayout();
  const params = useLocalSearchParams<{ shift?: string; plan?: string; view?: string }>();
  const tab: Tab = params.view === 'past' ? 'past' : 'upcoming';
  // The start of today in EAT, so the query key holds still through the day.
  const today = dayKey(Date.now());
  const startOfToday = `${today}T00:00:00.000+03:00`;
  const shifts = useShifts(tab === 'past' ? { endsBefore: startOfToday, order: 'desc' } : { endsFrom: startOfToday, order: 'asc' });
  const plans = useAudits({});
  const hasOpenPlan = (plans.data?.items ?? []).some((a) => OPEN.includes(a.status));
  // Arrived from a yard plan: keep the way back to it in view.
  const fromPlan = useAudit(params.plan);
  const items = useMemo(() => shifts.data?.items ?? [], [shifts.data]);

  const panel = params.shift;
  const editing = panel && panel !== 'new' ? (items.find((s) => s.id === panel) ?? null) : null;
  const formOpen = panel === 'new' || !!editing;
  const side = width >= SIDE_BY_SIDE;
  const narrow = width < 700 || (formOpen && side && width < 1400);

  // A link to a shift that has gone, or that sits under the other tab, closes once the list is known.
  useEffect(() => {
    if (panel && panel !== 'new' && shifts.isSuccess && !editing) router.setParams({ shift: undefined });
  }, [panel, editing, shifts.isSuccess]);

  const openShift = (id: string) => router.setParams({ shift: id });
  const closeForm = () => router.setParams({ shift: undefined });
  const newShift = () => router.setParams({ shift: 'new' });
  const newPlan = () => router.push('/dashboard/yard-plans/new' as never);

  const groups = groupByDay(items);
  // Today always has its place, so the page answers "what is on today" even when nothing is.
  if (tab === 'upcoming' && items.length && !groups.has(today)) groups.set(today, []);
  const days = [...groups.keys()].sort((a, b) => (tab === 'past' ? b.localeCompare(a) : a.localeCompare(b)));

  const body = (
    <Page gap={24} maxWidth={1040}>
      <PageHeader
        crumbs={fromPlan.data ? [{ label: fromPlan.data.name, href: `/dashboard/yard-plans/${fromPlan.data.id}` }, { label: 'Shift planning' }] : undefined}
        title="Shift planning"
        subtitle="Who works which yard plan, and when. All times are East Africa Time."
        actions={!formOpen && hasOpenPlan && items.length ? <Button label="New shift" icon="plus" onPress={newShift} /> : undefined}
      />
      <FilterPills<Tab>
        label="Which shifts"
        value={tab}
        onChange={(v) => router.setParams({ view: v === 'past' ? 'past' : undefined })}
        options={[
          { id: 'upcoming', label: 'Today and later' },
          { id: 'past', label: 'Past' },
        ]}
      />
      {shifts.isPending ? (
        <Loading />
      ) : shifts.isError ? (
        <EmptyState icon="warning-circle" title="Could not load shifts" body={(shifts.error as Error).message} action={<Button label="Try again" variant="secondary" onPress={() => void shifts.refetch()} />} />
      ) : items.length === 0 ? (
        tab === 'past' ? (
          <EmptyState icon="clock" title="No past shifts" body="Shifts show up here once their day is over." />
        ) : (
          <EmptyState
            icon="clock"
            title="No shifts yet"
            body={
              hasOpenPlan
                ? 'A shift says which clerks work a yard plan and when. They see it on their phones as soon as it is saved.'
                : 'A shift says which clerks work a yard plan and when. Upload a list to make a yard plan first, then add its shifts here.'
            }
            action={hasOpenPlan ? <Button label="Add the first shift" icon="plus" onPress={newShift} /> : <Button label="New yard plan" icon="plus" onPress={newPlan} />}
          />
        )
      ) : (
        <View style={{ gap: 28 }}>
          {days.map((d) => (
            <DayGroup key={d} day={d} shifts={groups.get(d) ?? []} selected={editing?.id} narrow={narrow} onOpen={openShift} />
          ))}
          {items.length >= LIST_LIMIT ? (
            <Txt variant="caption" tone="muted">
              {`Showing the first ${LIST_LIMIT} shifts.`}
            </Txt>
          ) : null}
        </View>
      )}
    </Page>
  );

  if (!formOpen) return body;

  const form = <ShiftForm key={editing?.id ?? 'new'} shift={editing} planId={params.plan} docked={side} onClose={closeForm} onSaved={(id) => (id && side ? openShift(id) : closeForm())} />;

  if (side) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', minHeight: 0 }}>
        <View style={{ flex: 1, minWidth: 0 }}>{body}</View>
        <View
          role="complementary"
          accessibilityLabel={editing ? `Edit ${editing.name}` : 'New shift'}
          style={{ width: PANEL_W, borderLeftWidth: 1, borderLeftColor: c.rule, backgroundColor: c.raised }}
        >
          {form}
        </View>
      </View>
    );
  }
  return (
    <Page gap={24} maxWidth={560}>
      {form}
    </Page>
  );
}
