import { useEffect, useState, type ReactNode } from 'react';

import type { FileDescriptor } from '../../../crypto/payload';
import { formatBytes } from '../../../shared/format';
import { DownloadIcon, FileIcon, PlayIcon } from '../../../shared/icons';
import { fileKind } from '../file-kind';
import { saveDecryptedFile, useDecryptedFile } from './useDecryptedFile';

const AUTO_LOAD_IMAGE_LIMIT_BYTES = 8 * 1024 * 1024;

export function AttachmentView({ file }: { file: FileDescriptor }) {
  switch (fileKind(file.mime)) {
    case 'image':
      return <ImageAttachment file={file} />;
    case 'video':
      return <VideoAttachment file={file} />;
    case 'document':
      return <DocumentAttachment file={file} />;
  }
}

function ImageAttachment({ file }: { file: FileDescriptor }) {
  const { state, load } = useDecryptedFile(file);
  const autoLoad = file.size <= AUTO_LOAD_IMAGE_LIMIT_BYTES;

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  if (state.status === 'ready') {
    return <img className="media" src={state.url} alt={file.name} />;
  }
  return (
    <MediaPlaceholder
      label={`${file.name} · ${formatBytes(file.size)}`}
      state={state.status}
      onLoad={load}
      actionIcon={<DownloadIcon />}
    />
  );
}

function VideoAttachment({ file }: { file: FileDescriptor }) {
  const { state, load } = useDecryptedFile(file);

  if (state.status === 'ready') {
    return <video className="media" src={state.url} controls autoPlay playsInline />;
  }
  return (
    <MediaPlaceholder
      label={`${file.name} · ${formatBytes(file.size)}`}
      state={state.status}
      onLoad={load}
      actionIcon={<PlayIcon />}
    />
  );
}

function MediaPlaceholder({
  label,
  state,
  onLoad,
  actionIcon,
}: {
  label: string;
  state: 'idle' | 'loading' | 'error';
  onLoad: () => void;
  actionIcon: ReactNode;
}) {
  return (
    <button className="media media--placeholder" onClick={onLoad} disabled={state === 'loading'}>
      <span className="media__action">{actionIcon}</span>
      <span className="media__label">
        {state === 'loading' ? 'Decrypting…' : state === 'error' ? 'Failed. Tap to retry.' : label}
      </span>
    </button>
  );
}

function DocumentAttachment({ file }: { file: FileDescriptor }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      await saveDecryptedFile(file);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="document" onClick={() => void download()} disabled={busy}>
      <span className="document__icon">
        <FileIcon />
      </span>
      <span className="document__text">
        <span className="document__name">{file.name}</span>
        <span className="document__meta">
          {busy ? 'Decrypting…' : failed ? 'Failed. Tap to retry.' : formatBytes(file.size)}
        </span>
      </span>
      <DownloadIcon className="document__download" />
    </button>
  );
}
