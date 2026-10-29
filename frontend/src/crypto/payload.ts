/** Describes an encrypted file. It travels inside the encrypted message, so the server never sees it. */
export interface FileDescriptor {
  attachmentId: string;
  /** Base64 AES-256-GCM key of the file. */
  key: string;
  /** Base64 IV of the file. */
  iv: string;
  name: string;
  mime: string;
  /** Size of the original, decrypted file in bytes. */
  size: number;
}

export type MessagePayload =
  | { kind: 'text'; text: string }
  | { kind: 'file'; caption: string; file: FileDescriptor };

export function isMessagePayload(value: unknown): value is MessagePayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;

  if (candidate.kind === 'text') return typeof candidate.text === 'string';
  if (candidate.kind === 'file') {
    const file = candidate.file as Record<string, unknown> | null;
    return (
      typeof candidate.caption === 'string' &&
      typeof file === 'object' &&
      file !== null &&
      ['attachmentId', 'key', 'iv', 'name', 'mime'].every((field) => typeof file[field] === 'string') &&
      typeof file.size === 'number'
    );
  }
  return false;
}
