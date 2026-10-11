import type {
  CreateFacilityBody,
  CreateSectionBody,
  FacilityDto,
  SectionDto,
  UpdateFacilityBody,
  UpdateSectionBody,
} from '@cymis/schemas';
import type { AppContext } from '../../context.js';
import { logActivity } from '../../lib/activity.js';
import { toFacilityDto, toSectionDto } from '../../lib/dto.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';

interface Actor {
  id: string;
  ip: string | null;
}

export async function listFacilities(ctx: AppContext, includeInactive: boolean): Promise<FacilityDto[]> {
  const rows = await ctx.db.facility.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      sections: { where: includeInactive ? {} : { isActive: true }, orderBy: { code: 'asc' } },
    },
    orderBy: { code: 'asc' },
  });
  return rows.map(toFacilityDto);
}

export async function createFacility(ctx: AppContext, input: CreateFacilityBody, actor: Actor): Promise<FacilityDto> {
  const exists = await ctx.db.facility.findUnique({ where: { code: input.code }, select: { id: true } });
  if (exists) throw new ConflictError('A facility with that code already exists', 'code_taken');
  const f = await ctx.db.facility.create({ data: input, include: { sections: true } });
  await logActivity(ctx.db, {
    actorId: actor.id,
    action: 'facility.created',
    entityType: 'facility',
    entityId: f.id,
    ip: actor.ip,
    data: { code: f.code },
  });
  return toFacilityDto(f);
}

export async function updateFacility(
  ctx: AppContext,
  id: string,
  input: UpdateFacilityBody,
  actor: Actor,
): Promise<FacilityDto> {
  const exists = await ctx.db.facility.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new NotFoundError('Facility');
  const f = await ctx.db.facility.update({
    where: { id },
    data: input,
    include: { sections: { orderBy: { code: 'asc' } } },
  });
  await logActivity(ctx.db, {
    actorId: actor.id,
    action: 'facility.updated',
    entityType: 'facility',
    entityId: id,
    ip: actor.ip,
    data: { changes: input },
  });
  return toFacilityDto(f);
}

export async function createSection(ctx: AppContext, input: CreateSectionBody, actor: Actor): Promise<SectionDto> {
  const facility = await ctx.db.facility.findUnique({ where: { id: input.facilityId }, select: { id: true } });
  if (!facility) throw new NotFoundError('Facility');
  const dupe = await ctx.db.section.findUnique({
    where: { facilityId_code: { facilityId: input.facilityId, code: input.code } },
    select: { id: true },
  });
  if (dupe) throw new ConflictError('That section code is already used in this facility', 'code_taken');
  const s = await ctx.db.section.create({ data: { ...input, locationCodes: [...new Set(input.locationCodes)] } });
  await logActivity(ctx.db, {
    actorId: actor.id,
    action: 'section.created',
    entityType: 'section',
    entityId: s.id,
    ip: actor.ip,
    data: { code: s.code, facilityId: s.facilityId },
  });
  return toSectionDto(s);
}

export async function updateSection(
  ctx: AppContext,
  id: string,
  input: UpdateSectionBody,
  actor: Actor,
): Promise<SectionDto> {
  const exists = await ctx.db.section.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new NotFoundError('Section');
  const s = await ctx.db.section.update({
    where: { id },
    data: {
      ...input,
      ...(input.locationCodes ? { locationCodes: [...new Set(input.locationCodes)] } : {}),
    },
  });
  await logActivity(ctx.db, {
    actorId: actor.id,
    action: 'section.updated',
    entityType: 'section',
    entityId: id,
    ip: actor.ip,
    data: { changes: input },
  });
  return toSectionDto(s);
}
