"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Helpers de upload/download para os buckets do Supabase Storage.
 * Convenção de caminho: `${userId}/${...resto}` — as policies de RLS
 * garantem que cada usuário só acessa a própria pasta.
 */

export async function uploadFile(
  bucket: string,
  path: string,
  file: File | Blob,
  options?: { contentType?: string; upsert?: boolean }
): Promise<{ path: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: options?.contentType,
    upsert: options?.upsert ?? true,
  });
  if (error) throw error;
  return { path: data.path };
}

export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 3600
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export function getPublicUrl(bucket: string, path: string): string {
  const supabase = createClient();
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function downloadFile(bucket: string, path: string): Promise<Blob> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;
  return data;
}

export async function removeFile(bucket: string, paths: string[]): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw error;
}

/** Monta um caminho seguro: userId/timestamp-nome-sanitizado.ext */
export function buildStoragePath(userId: string, filename: string): string {
  const sanitized = filename
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-");
  return `${userId}/${Date.now()}-${sanitized}`;
}
