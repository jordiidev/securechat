export type FileKind = 'image' | 'video' | 'document';

// Only formats browsers render natively and safely are previewed inline.
// Everything else, SVG included, is offered as a download.
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']);

export function fileKind(mime: string): FileKind {
  const normalised = mime.toLowerCase();
  if (IMAGE_TYPES.has(normalised)) return 'image';
  if (VIDEO_TYPES.has(normalised)) return 'video';
  return 'document';
}
