import type {
  CreateFacilityBody,
  CreateSectionBody,
  CreateYardBody,
  FacilityDto,
  SectionDto,
  UpdateFacilityBody,
  UpdateSectionBody,
  UpdateYardBody,
  YardDto,
} from '@cymis/schemas';
import type { AppContext } from '../../context.js';
import { Prisma } from '../../generated/prisma/client.js';
import { logActivity } from '../../lib/activity.js';
import { toFacilityDto, toSectionDto, toYardDto } from '../../lib/dto.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../lib/errors.js';

interface Actor {
  id: string;
  ip: string | null;
}

export async function listFacilities(ctx: AppContext, includeInactive: boolean): Promise<FacilityDto[]> {
  const rows = await ctx.db.facility.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      sections: { where: includeInactive ? {} : { isActive: true }, orderBy: { code: 'asc' } },
      yards: { where: includeInactive ? {} : { isActive: true }, orderBy: { code: 'asc' } },
    },
    orderBy: { code: 'asc' },
  });
  return rows.map(toFacilityDto);
}

export async function createFacility(ctx: AppContext, input: CreateFacilityBody, actor: Actor): Promise<FacilityDto> {
  const exists = await ctx.db.facility.findUnique({ where: { code: input.code }, select: { id: true } });
  if (exists) throw new ConflictError('A site with that short code already exists', 'code_taken');
  const f = await ctx.db.facility.create({ data: input, include: { sections: true, yards: true } });
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
  if (!exists) throw new NotFoundError('Site');
  const f = await ctx.db.facility.update({
    where: { id },
    data: input,
    include: { sections: { orderBy: { code: 'asc' } }, yards: { orderBy: { code: 'asc' } } },
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

export async function createYard(ctx: AppContext, input: CreateYardBody, actor: Actor): Promise<YardDto> {
  const facility = await ctx.db.facility.findUnique({ where: { id: input.facilityId }, select: { id: true } });
  if (!facility) throw new NotFoundError('Site');
  const dupe = await ctx.db.yard.findUnique({
    where: { facilityId_code: { facilityId: input.facilityId, code: input.code } },
    select: { id: true },
  });
  if (dupe) throw new ConflictError('That short code is already used by a yard on this site', 'code_taken');
  const y = await ctx.db.yard.create({ data: input });
  await logActivity(ctx.db, {
    actorId: actor.id,
    action: 'yard.created',
    entityType: 'yard',
    entityId: y.id,
    ip: actor.ip,
    data: { code: y.code, facilityId: y.facilityId },
  });
  return toYardDto(y);
}

export async function updateYard(ctx: AppContext, id: string, input: UpdateYardBody, actor: Actor): Promise<YardDto> {
  const exists = await ctx.db.yard.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new NotFoundError('Yard');
  if (input.isActive === false) {
    const active = await ctx.db.section.count({ where: { yardId: id, isActive: true } });
    if (active > 0) {
      throw new ConflictError(
        `This yard still has ${active} ${active === 1 ? 'area' : 'areas'} turned on. Turn them off or move them to another yard first.`,
        'yard_has_active_sections',
      );
    }
  }
  const y = await ctx.db.yard.update({ where: { id }, data: input });
  await logActivity(ctx.db, {
    actorId: actor.id,
    action: 'yard.updated',
    entityType: 'yard',
    entityId: id,
    ip: actor.ip,
    data: { changes: input },
  });
  return toYardDto(y);
}

/** A section's yard must be on the same site and turned on. */
async function checkYard(ctx: AppContext, yardId: string, facilityId: string): Promise<void> {
  const yard = await ctx.db.yard.findUnique({ where: { id: yardId }, select: { facilityId: true, isActive: true } });
  if (!yard) throw new NotFoundError('Yard');
  if (yard.facilityId !== facilityId) throw new BadRequestError('That yard is on a different site', 'yard_other_facility');
  if (!yard.isActive) throw new ConflictError('That yard is turned off. Turn it back on first.', 'yard_turned_off');
}

/** Turns an optional shape into what Prisma stores: undefined leaves it, null clears it. */
function boundaryData(boundary: SectionDto['boundary'] | undefined) {
  if (boundary === undefined) return {};
  return { boundary: boundary === null ? Prisma.DbNull : boundary };
}

export async function createSection(ctx: AppContext, input: CreateSectionBody, actor: Actor): Promise<SectionDto> {
  const facility = await ctx.db.facility.findUnique({ where: { id: input.facilityId }, select: { id: true } });
  if (!facility) throw new NotFoundError('Site');
  if (input.yardId) await checkYard(ctx, input.yardId, input.facilityId);
  const dupe = await ctx.db.section.findUnique({
    where: { facilityId_code: { facilityId: input.facilityId, code: input.code } },
    select: { id: true },
  });
  if (dupe) throw new ConflictError('That short code is already used by an area on this site', 'code_taken');
  const { boundary, ...rest } = input;
  const s = await ctx.db.section.create({
    data: { ...rest, locationCodes: [...new Set(input.locationCodes)], ...boundaryData(boundary) },
  });
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
  const exists = await ctx.db.section.findUnique({
    where: { id },
    select: { facilityId: true, yard: { select: { isActive: true } } },
  });
  if (!exists) throw new NotFoundError('Area');
  if (input.yardId) await checkYard(ctx, input.yardId, exists.facilityId);
  // Turning an area back on inside a turned off yard would break the yard's rule.
  if (input.isActive === true && input.yardId === undefined && exists.yard && !exists.yard.isActive) {
    throw new ConflictError('This area is in a yard that is turned off. Turn the yard back on first.', 'yard_turned_off');
  }
  const { boundary, ...rest } = input;
  const s = await ctx.db.section.update({
    where: { id },
    data: {
      ...rest,
      ...(input.locationCodes ? { locationCodes: [...new Set(input.locationCodes)] } : {}),
      ...boundaryData(boundary),
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
