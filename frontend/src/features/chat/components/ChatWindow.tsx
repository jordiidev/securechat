import { useState } from 'react';

import { Avatar } from '../../../shared/Avatar';
import { BackIcon, LockIcon } from '../../../shared/icons';
import { useChat } from '../ChatContext';
import { Composer } from './Composer';
import { MessageList } from './MessageList';
import { SafetyNumberDialog } from './SafetyNumberDialog';

export function ChatWindow() {
  const { me, state, closePeer, sendText, sendFile, loadOlder } = useChat();
  const [verifying, setVerifying] = useState(false);
  const peer = state.activePeer;
  if (!peer) return null;

  return (
    <section className="chat">
      <header className="chat__header">
        <button className="icon-button chat__back" onClick={closePeer} aria-label="Back to chats">
          <BackIcon />
        </button>
        <Avatar name={peer.username} />
        <div className="chat__title">
          <strong>{peer.username}</strong>
          <button className="chat__verify" onClick={() => setVerifying(true)}>
            <LockIcon width={13} height={13} /> End-to-end encrypted · verify
          </button>
        </div>
      </header>

      <MessageList
        history={state.histories[peer.id]}
        meId={me.id}
        peerId={peer.id}
        onLoadOlder={loadOlder}
      />
      <Composer onSendText={sendText} onSendFile={sendFile} />

      {verifying && <SafetyNumberDialog me={me} peer={peer} onClose={() => setVerifying(false)} />}
    </section>
  );
}
