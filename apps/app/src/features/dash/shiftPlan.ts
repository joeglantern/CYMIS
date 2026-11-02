import type { AuditDto, ShiftBrief } from '@cymis/schemas';

type Plan = Pick<AuditDto, 'assignees' | 'shifts' | 'viaShiftIds'>;

const nameOf = (plan: Plan, id: string) => plan.assignees.find((a) => a.id === id)?.fullName ?? 'Someone';

/** "the Day shift", "Day shift and Night shift". Words only, for a sentence. */
export function shiftNames(shifts: readonly Pick<ShiftBrief, 'name'>[]): string {
  const names = shifts.map((s) => s.name);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The shifts on this plan that hold a person. */
export function shiftsOf(plan: Pick<Plan, 'shifts'>, userId: string): ShiftBrief[] {
  return (plan.shifts ?? []).filter((s) => s.clerkIds.includes(userId));
}

/** What the Clerks step shows beside a name, when the person is on the plan through a shift. */
export function fromShiftWords(plan: Pick<Plan, 'shifts' | 'viaShiftIds'>, userId: string): string | null {
  if (!plan.viaShiftIds?.includes(userId)) return null;
  const held = shiftsOf(plan, userId);
  return held.length ? `From ${shiftNames(held)}` : null;
}

/** Who loses a shift place if the Clerks step saves this list, with the shifts named. */
export function shiftLosses(plan: Plan, picked: readonly string[]): { name: string; shifts: string }[] {
  return plan.assignees
    .filter((a) => !picked.includes(a.id))
    .map((a) => ({ name: a.fullName, shifts: shiftNames(shiftsOf(plan, a.id)) }))
    .filter((x) => x.shifts);
}

export interface ClerkChange {
  /** Newly on this shift and still on another that has not finished. Each can be moved rather than doubled up. */
  moves: { userId: string; name: string; from: ShiftBrief[] }[];
  /** Coming off this shift with nothing else holding them, so the plan leaves their phone. */
  leaving: { userId: string; name: string }[];
}

/** Works out what a save on the shift page would mean for each person. */
export function clerkChange(plan: Plan, shiftId: string | null, before: readonly string[], after: readonly string[], now: number = Date.now()): ClerkChange {
  const others = (plan.shifts ?? []).filter((s) => s.id !== shiftId);
  const moves = after
    .filter((id) => !before.includes(id))
    .map((userId) => ({
      userId,
      name: nameOf(plan, userId),
      from: others.filter((s) => s.clerkIds.includes(userId) && new Date(s.endsAt).getTime() > now),
    }))
    .filter((m) => m.from.length > 0);
  const leaving = before
    .filter((id) => !after.includes(id))
    .filter((id) => plan.viaShiftIds?.includes(id) && !others.some((s) => s.clerkIds.includes(id)))
    .map((userId) => ({ userId, name: nameOf(plan, userId) }));
  return { moves, leaving };
}
