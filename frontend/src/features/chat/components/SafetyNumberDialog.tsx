import { useEffect, useState } from 'react';

import { safetyNumber } from '../../../crypto/safety-number';
import { CloseIcon, LockIcon } from '../../../shared/icons';
import type { User } from '../../../shared/user';

interface SafetyNumberDialogProps {
  me: User;
  peer: User;
  onClose: () => void;
}

export function SafetyNumberDialog({ me, peer, onClose }: SafetyNumberDialogProps) {
  const [number, setNumber] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    safetyNumber(me.publicKey, peer.publicKey).then((value) => !cancelled && setNumber(value));
    return () => {
      cancelled = true;
    };
  }, [me.publicKey, peer.publicKey]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="safety-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="icon-button dialog__close" onClick={onClose} aria-label="Close">
          <CloseIcon />
        </button>
        <div className="auth__badge">
          <LockIcon />
        </div>
        <h2 id="safety-title" className="dialog__title">
          Verify encryption with {peer.username}
        </h2>
        <p className="dialog__text">
          Compare this number with {peer.username} in person or over a call. If it is identical on
          both devices, nobody, including the server, has swapped your keys.
        </p>
        <output className="dialog__number">{number ?? '…'}</output>
      </div>
    </div>
  );
}
