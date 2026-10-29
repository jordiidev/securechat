import type { MessagePayload } from '../../crypto/payload';
import { fileKind } from './file-kind';

const FILE_LABELS = { image: '🖼 Photo', video: '🎬 Video', document: '📎' } as const;

/** One-line summary of a message for the conversation list. */
export function previewOf(payload: MessagePayload | null): string {
  if (!payload) return '🔒 Message could not be decrypted';

  if (payload.kind === 'text') return payload.text.replace(/\s+/g, ' ').trim();

  const kind = fileKind(payload.file.mime);
  const label = kind === 'document' ? `${FILE_LABELS.document} ${payload.file.name}` : FILE_LABELS[kind];
  return payload.caption ? `${label}, ${payload.caption}` : label;
}
