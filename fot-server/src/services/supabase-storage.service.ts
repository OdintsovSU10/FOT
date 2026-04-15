import path from 'path';
import { randomUUID } from 'crypto';
import { supabase } from '../config/database.js';

export const SKUD_OBJECT_MAPS_BUCKET = 'skud-object-maps';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60;

const normalizeStoragePath = (value: string): string => value.replace(/^\/+/, '').trim();

const buildBucketError = (error: unknown, bucket: string): Error => {
  const message = error instanceof Error ? error.message : String(error || '');
  if (
    message.toLowerCase().includes('bucket')
    && (message.toLowerCase().includes('not found') || message.toLowerCase().includes('does not exist'))
  ) {
    return new Error(
      `Bucket "${bucket}" не найден в Supabase Storage. `
      + 'Примените миграцию 026_skud_object_maps.sql в текущую базу.',
    );
  }

  return error instanceof Error ? error : new Error('Ошибка Supabase Storage');
};

export const supabaseStorageService = {
  buildObjectMapPath(objectId: string, fileName: string): string {
    const extension = path.extname(fileName || '').toLowerCase() || '.bin';
    return `travel-objects/${objectId}/${randomUUID()}${extension}`;
  },

  async createSignedUploadUrl(bucket: string, storagePath: string): Promise<{ signedUrl: string; path: string; token: string }> {
    const normalizedPath = normalizeStoragePath(storagePath);
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(normalizedPath, { upsert: true });

    if (error || !data) {
      throw buildBucketError(error, bucket);
    }

    return data;
  },

  async createSignedDownloadUrl(bucket: string, storagePath: string, expiresIn = DEFAULT_SIGNED_URL_TTL_SECONDS): Promise<string> {
    const normalizedPath = normalizeStoragePath(storagePath);
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(normalizedPath, expiresIn);

    if (error || !data?.signedUrl) {
      throw buildBucketError(error, bucket);
    }

    return data.signedUrl;
  },

  async ensureObjectExists(bucket: string, storagePath: string): Promise<void> {
    const normalizedPath = normalizeStoragePath(storagePath);
    const { data, error } = await supabase.storage
      .from(bucket)
      .exists(normalizedPath);

    if (error) {
      throw buildBucketError(error, bucket);
    }

    if (!data) {
      throw new Error('Файл карты не найден в Supabase Storage');
    }
  },

  async removeObject(bucket: string, storagePath: string | null | undefined): Promise<void> {
    const normalizedPath = normalizeStoragePath(storagePath || '');
    if (!normalizedPath) return;

    const { error } = await supabase.storage
      .from(bucket)
      .remove([normalizedPath]);

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes('not found') || message.includes('does not exist')) {
        return;
      }
      throw buildBucketError(error, bucket);
    }
  },
};
