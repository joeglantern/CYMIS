import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../config/env.js';

export interface ObjectInfo {
  sizeBytes: number;
  contentType: string | undefined;
}

/**
 * Thin wrapper over S3. Works with Contabo Object Storage in production and
 * SeaweedFS locally. The bucket is private; files are only reachable through
 * short lived signed links.
 */
export class Storage {
  private readonly client: S3Client;
  private readonly signer: S3Client;

  constructor(
    private readonly env: Pick<
      Env,
      | 'S3_ENDPOINT'
      | 'S3_PUBLIC_ENDPOINT'
      | 'S3_REGION'
      | 'S3_BUCKET'
      | 'S3_ACCESS_KEY_ID'
      | 'S3_SECRET_ACCESS_KEY'
      | 'S3_FORCE_PATH_STYLE'
    >,
  ) {
    const base: S3ClientConfig = {
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
      // Newer SDKs add CRC checksums by default. Many S3 compatible stores and
      // signed upload links do not handle them, so only send them when required.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    };
    this.client = new S3Client({ ...base, endpoint: env.S3_ENDPOINT });
    // Phones may reach storage on a different address than the API does.
    this.signer = new S3Client({ ...base, endpoint: env.S3_PUBLIC_ENDPOINT ?? env.S3_ENDPOINT });
  }

  get bucket(): string {
    return this.env.S3_BUCKET;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
  }

  async getBuffer(key: string, range?: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: range }));
    if (!res.Body) return Buffer.alloc(0);
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  /** Size and type of an object, or null if it is not there. */
  async head(key: string): Promise<ObjectInfo | null> {
    try {
      const res = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { sizeBytes: res.ContentLength ?? 0, contentType: res.ContentType };
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  /** Signed PUT link. The content type is part of the signature, so the phone must send the same one. */
  async signUpload(key: string, contentType: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.signer,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: expiresInSeconds, signableHeaders: new Set(['content-type']) },
    );
  }

  async signDownload(key: string, expiresInSeconds: number, downloadName?: string): Promise<string> {
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: downloadName ? `attachment; filename="${safeFileName(downloadName)}"` : undefined,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
  }

  /** Local and test only. Production buckets are made by hand with the right policy. */
  async ensureBucket(): Promise<void> {
    try {
      await this.ping();
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    }
  }

  destroy(): void {
    this.client.destroy();
    this.signer.destroy();
  }
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === 'NotFound' || e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404;
}

function safeFileName(name: string): string {
  return name.replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 120);
}
