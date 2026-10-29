import { useCallback, useEffect, useState } from 'react';

import type { FileDescriptor } from '../../../crypto/payload';
import { fetchDecryptedFile } from '../chatService';

type FileState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'error' };

/** Downloads and decrypts a file on demand, exposing it as an object URL that is released on unmount. */
export function useDecryptedFile(file: FileDescriptor) {
  const [state, setState] = useState<FileState>({ status: 'idle' });
  const url = state.status === 'ready' ? state.url : null;

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const blob = await fetchDecryptedFile(file);
      setState({ status: 'ready', url: URL.createObjectURL(blob) });
    } catch {
      setState({ status: 'error' });
    }
  }, [file]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  return { state, load };
}

/** Decrypts a file and hands it to the browser as a download. */
export async function saveDecryptedFile(file: FileDescriptor): Promise<void> {
  const blob = await fetchDecryptedFile(file);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
