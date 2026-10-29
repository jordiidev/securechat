import { LockIcon } from '../../../shared/icons';
import { useChat } from '../ChatContext';
import { ChatWindow } from './ChatWindow';
import { Sidebar } from './Sidebar';

export function ChatLayout() {
  const { state } = useChat();
  const peer = state.activePeer;

  return (
    <div className={`layout${peer ? ' layout--chat-open' : ''}`}>
      <Sidebar />
      {peer ? (
        <ChatWindow key={peer.id} />
      ) : (
        <section className="chat chat--empty">
          <div className="empty">
            <LockIcon width={32} height={32} />
            <p>Select a chat or search for a username to start an encrypted conversation.</p>
          </div>
        </section>
      )}
    </div>
  );
}
