import type { PhotoUrlResponse, PresignPhotoBody, PresignPhotoResponse } from '@cymis/schemas';
import type { AppContext } from '../../context.js';
import { scanInclude, toScanDto } from '../../lib/dto.js';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { Principal, UserPrincipal } from '../../plugins/auth.js';
import { loadAuditFor } from '../audits/access.js';

const UPLOAD_LINK_SECONDS = 15 * 60;
const VIEW_LINK_SECONDS = 5 * 60;
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

export function photoKeys(auditId: string, scanId: string, photoId: string) {
  const base = `audits/${auditId}/scans/${scanId}/${photoId}`;
  return { storageKey: `${base}.jpg`, thumbKey: `${base}_thumb.jpg` };
}

type User = UserPrincipal['user'];

async function scanForUpload(ctx: AppContext, user: User, scanId: string) {
  const scan = await ctx.db.scan.findUnique({ where: { id: scanId }, select: { id: true, auditId: true, auditorId: true } });
  if (!scan) throw new NotFoundError('Scan');
  // The crew member who made the scan uploads its photos. Supervisors may too.
  if (scan.auditorId !== user.id && user.role === 'AUDITOR') throw new ForbiddenError();
  return scan;
}

/** Gives the phone a signed link to upload one photo straight to storage. */
export async function presignPhoto(ctx: AppContext, user: User, input: PresignPhotoBody): Promise<PresignPhotoResponse> {
  const scan = await scanForUpload(ctx, user, input.scanId);
  const { storageKey } = photoKeys(scan.auditId, scan.id, input.photoId);

  const existing = await ctx.db.photo.findUnique({ where: { id: input.photoId } });
  if (existing) {
    if (existing.scanId !== scan.id) throw new ConflictError('This photo id is already used', 'id_conflict');
    if (existing.status === 'UPLOADED') {
      return { photoId: existing.id, alreadyUploaded: true, uploadUrl: null, method: 'PUT', headers: {}, expiresAt: null };
    }
  }

  const photos = await ctx.db.photo.count({ where: { scanId: scan.id } });
  if (!existing && photos >= 5) throw new BadRequestError('A scan can have at most 5 photos', 'too_many_photos');

  await ctx.db.photo.upsert({
    where: { id: input.photoId },
    create: {
      id: input.photoId,
      scanId: scan.id,
      storageKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256 ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
    },
    update: { sizeBytes: input.sizeBytes, sha256: input.sha256 ?? null },
  });

  const uploadUrl = await ctx.storage.signUpload(storageKey, input.contentType, UPLOAD_LINK_SECONDS);
  return {
    photoId: input.photoId,
    alreadyUploaded: false,
    uploadUrl,
    method: 'PUT',
    headers: { 'Content-Type': input.contentType },
    expiresAt: new Date(Date.now() + UPLOAD_LINK_SECONDS * 1000).toISOString(),
  };
}

/**
 * Called by the phone after the upload finishes. Checks the file really is
 * there, is the size we were told, and starts with JPEG bytes. Then hands it
 * to the CV worker.
 */
export async function completePhoto(ctx: AppContext, user: User, photoId: string) {
  const photo = await ctx.db.photo.findUnique({ where: { id: photoId }, include: { scan: true } });
  if (!photo) throw new NotFoundError('Photo');
  await scanForUpload(ctx, user, photo.scanId);

  if (photo.status !== 'UPLOADED') {
    const info = await ctx.storage.head(photo.storageKey);
    if (!info) throw new BadRequestError('The photo has not been uploaded yet', 'not_uploaded');

    const head = await ctx.storage.getBuffer(photo.storageKey, 'bytes=0-2');
    const problems: string[] = [];
    if (info.sizeBytes !== photo.sizeBytes) problems.push('size does not match');
    if (info.sizeBytes > 10 * 1024 * 1024) problems.push('file is too large');
    if (!head.subarray(0, 3).equals(JPEG_MAGIC)) problems.push('not a JPEG');
    if (problems.length > 0) {
      await ctx.storage.delete(photo.storageKey);
      throw new BadRequestError(`The upload was not accepted: ${problems.join(', ')}. Take the photo again.`, 'bad_upload');
    }

    await ctx.db.photo.update({ where: { id: photoId }, data: { status: 'UPLOADED', uploadedAt: new Date() } });

    // Only the first photo of a scan goes through colour and second read.
    if (photo.scan.cvStatus === 'PENDING') {
      const { thumbKey } = photoKeys(photo.scan.auditId, photo.scanId, photo.id);
      await ctx.queues.addCvJob({
        scanId: photo.scanId,
        photoId: photo.id,
        storageKey: photo.storageKey,
        thumbKey,
        deviceNumber: photo.scan.containerNumber,
        attempt: 1,
      });
    }
  }

  const scan = await ctx.db.scan.findUniqueOrThrow({ where: { id: photo.scanId }, include: scanInclude });
  const dto = toScanDto(scan);
  ctx.broadcaster.toAudit(scan.auditId, 'scan:updated', { auditId: scan.auditId, scan: dto });
  return dto;
}

export async function photoUrl(ctx: AppContext, principal: Principal, photoId: string, thumb: boolean): Promise<PhotoUrlResponse> {
  const photo = await ctx.db.photo.findUnique({ where: { id: photoId }, include: { scan: { select: { auditId: true } } } });
  if (!photo || photo.status !== 'UPLOADED') throw new NotFoundError('Photo');
  await loadAuditFor(ctx, photo.scan.auditId, principal, { scopes: ['results:read'] });
  const key = thumb && photo.thumbKey ? photo.thumbKey : photo.storageKey;
  return {
    url: await ctx.storage.signDownload(key, VIEW_LINK_SECONDS),
    expiresAt: new Date(Date.now() + VIEW_LINK_SECONDS * 1000).toISOString(),
  };
}
