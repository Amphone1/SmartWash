/**
 * MinIO (S3-compatible) object storage. Slip images are pre-uploaded by the
 * client via a presigned PUT URL; services reference them by object key.
 */
import { Global, Inject, Injectable, Module } from '@nestjs/common';
import { Client } from 'minio';
import { optionalEnv, requireEnv } from '../config/env';
import type { ReadinessCheck } from '../health/health';

export const MINIO_CLIENT = Symbol('MINIO_CLIENT');

function buildClient(): Client {
  const endpoint = optionalEnv('MINIO_ENDPOINT', 'minio:9000');
  const [host, port] = endpoint.split(':');
  return new Client({
    endPoint: host,
    port: port ? Number.parseInt(port, 10) : 9000,
    useSSL: optionalEnv('MINIO_USE_SSL', 'false') === 'true',
    accessKey: requireEnv('MINIO_ACCESS_KEY'),
    secretKey: requireEnv('MINIO_SECRET_KEY'),
  });
}

@Injectable()
export class ObjectStorage implements ReadinessCheck {
  readonly name = 'minio';
  private readonly bucket = optionalEnv('MINIO_BUCKET_SLIPS', 'slips');

  constructor(@Inject(MINIO_CLIENT) private readonly client: Client) {}

  /** Presigned PUT URL the client uses to upload a slip image directly. */
  presignUpload(objectKey: string, expirySeconds = 600): Promise<string> {
    return this.client.presignedPutObject(this.bucket, objectKey, expirySeconds);
  }

  /** Presigned GET URL (e.g. for OCR to fetch the image). */
  presignDownload(objectKey: string, expirySeconds = 600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, objectKey, expirySeconds);
  }

  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket).catch(() => false);
    if (!exists) await this.client.makeBucket(this.bucket);
  }

  async check(): Promise<boolean> {
    return this.client.bucketExists(this.bucket).then(
      (e) => e,
      () => false,
    );
  }
}

@Global()
@Module({
  providers: [
    { provide: MINIO_CLIENT, useFactory: buildClient },
    ObjectStorage,
  ],
  exports: [ObjectStorage, MINIO_CLIENT],
})
export class StorageModule {}
