import { useLayoutEffect, useRef, useState } from 'react';

import { formatDayLabel, isSameDay } from '../../../shared/format';
import type { History } from '../chatReducer';
import { MessageBubble } from './MessageBubble';

const STICK_TO_BOTTOM_THRESHOLD_PX = 96;

interface MessageListProps {
  history: History | undefined;
  meId: string;
  peerId: string;
  onLoadOlder: () => Promise<void>;
}

export function MessageList({ history, meId, peerId, onLoadOlder }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const pendingRestore = useRef<{ height: number; top: number } | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const messages = history?.messages ?? [];
  const newest = messages[messages.length - 1];

  // Opening another conversation starts at the newest message.
  useLayoutEffect(() => {
    stickToBottom.current = true;
  }, [peerId]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const restore = pendingRestore.current;
    if (restore) {
      container.scrollTop = container.scrollHeight - restore.height + restore.top;
      pendingRestore.current = null;
    } else if (stickToBottom.current || newest?.senderId === meId) {
      container.scrollTop = container.scrollHeight;
    }
  }, [newest?.id, newest?.senderId, meId, history?.loaded, peerId, messages.length]);

  function handleScroll() {
    const container = containerRef.current;
    if (!container) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    stickToBottom.current = distance < STICK_TO_BOTTOM_THRESHOLD_PX;
  }

  async function loadOlder() {
    const container = containerRef.current;
    if (container) {
      pendingRestore.current = { height: container.scrollHeight, top: container.scrollTop };
    }
    setLoadingOlder(true);
    try {
      await onLoadOlder();
    } finally {
      setLoadingOlder(false);
    }
  }

  return (
    <div className="messages" ref={containerRef} onScroll={handleScroll}>
      <div className="messages__notice">
        Messages and files in this chat are end-to-end encrypted.
      </div>

      {history?.hasMore && (
        <button className="button button--link" onClick={() => void loadOlder()} disabled={loadingOlder}>
          {loadingOlder ? 'Loading…' : 'Load earlier messages'}
        </button>
      )}
      {!history?.loaded && <p className="messages__status">Loading messages…</p>}
      {history?.loaded && messages.length === 0 && (
        <p className="messages__status">No messages yet. Say hello 👋</p>
      )}

      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const startsNewDay =
          !previous || !isSameDay(new Date(previous.createdAt), new Date(message.createdAt));
        return (
          <div key={message.id}>
            {startsNewDay && <div className="day-chip">{formatDayLabel(message.createdAt)}</div>}
            <MessageBubble message={message} own={message.senderId === meId} />
          </div>
        );
      })}
    </div>
  );
}
