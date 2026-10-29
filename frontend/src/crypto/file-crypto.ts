import { fromBase64, randomBytes, toBase64 } from '../shared/encoding';
import type { FileDescriptor } from './payload';

const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;

export interface EncryptedFile {
  /** Ciphertext to upload. */
  bytes: ArrayBuffer;
  /** Base64 key, to be put in the file descriptor. */
  key: string;
  /** Base64 IV, to be put in the file descriptor. */
  iv: string;
}

/** Encrypts a file with a fresh random key so each file can be shared on its own. */
export async function encryptFile(file: Blob): Promise<EncryptedFile> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const iv = randomBytes(AES_GCM_IV_BYTES);
  const bytes = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, await file.arrayBuffer());
  const rawKey = await crypto.subtle.exportKey('raw', key);
  return { bytes, key: toBase64(rawKey), iv: toBase64(iv) };
}

export async function decryptFile(encrypted: ArrayBuffer, file: FileDescriptor): Promise<Blob> {
  const key = await crypto.subtle.importKey('raw', fromBase64(file.key), 'AES-GCM', false, ['decrypt']);
  const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(file.iv) }, key, encrypted);
  return new Blob([bytes], { type: file.mime });
}

/** Largest plaintext that still fits the server's upload limit once the GCM tag is added. */
export function maxPlainFileBytes(serverLimitBytes: number): number {
  return serverLimitBytes - AES_GCM_TAG_BYTES;
}
