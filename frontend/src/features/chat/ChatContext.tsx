import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

import { tokenStorage } from '../../shared/http';
import type { User } from '../../shared/user';
import type { AuthenticatedSession } from '../auth/authService';
import { chatReducer, initialChatState, type ChatState } from './chatReducer';
import { ChatService } from './chatService';
import { RealtimeClient } from './realtime';
import type { EncryptedRecord } from './types';

interface ChatContextValue {
  me: User;
  state: ChatState;
  openPeer: (peer: User) => void;
  closePeer: () => void;
  sendText: (text: string) => Promise<void>;
  sendFile: (file: File, caption: string) => Promise<void>;
  loadOlder: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function report(context: string, error: unknown): void {
  console.error(`${context}:`, error);
}

export function ChatProvider({
  session,
  children,
}: {
  session: AuthenticatedSession;
  children: ReactNode;
}) {
  const { user } = session;
  const service = useMemo(() => new ChatService(user, session.identity), [user, session.identity]);
  const [state, dispatch] = useReducer(chatReducer, initialChatState);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const refreshConversations = useCallback(async () => {
    dispatch({ type: 'conversationsLoaded', conversations: await service.loadConversations() });
  }, [service]);

  const loadLatest = useCallback(
    async (peer: User) => {
      const { messages, hasMore } = await service.loadHistory(peer);
      dispatch({ type: 'historyLoaded', peerId: peer.id, messages, hasMore });
    },
    [service],
  );

  const receive = useCallback(
    async (record: EncryptedRecord) => {
      const peer = await service.peerOf(record);
      const message = await service.decrypt(record, peer);
      dispatch({ type: 'messageReceived', me: user.id, peer, message });
    },
    [service, user.id],
  );

  useEffect(() => {
    refreshConversations().catch((error) => report('Loading conversations failed', error));
  }, [refreshConversations]);

  useEffect(() => {
    let hasBeenOnline = false;

    // After a dropped connection, anything sent meanwhile is only available through REST.
    const resync = () => {
      refreshConversations().catch((error) => report('Refreshing conversations failed', error));
      const active = stateRef.current.activePeer;
      if (active) loadLatest(active).catch((error) => report('Refreshing history failed', error));
    };

    const client = new RealtimeClient({
      getToken: () => tokenStorage.get(),
      onMessage: (record) => void receive(record).catch((error) => report('Incoming message failed', error)),
      onStatus: (status) => {
        dispatch({ type: 'connectionChanged', status });
        if (status !== 'online') return;
        if (hasBeenOnline) resync();
        hasBeenOnline = true;
      },
    });
    client.start();
    return () => client.stop();
  }, [receive, refreshConversations, loadLatest]);

  const openPeer = useCallback(
    (peer: User) => {
      service.rememberPeer(peer);
      dispatch({ type: 'peerOpened', peer });
      if (!stateRef.current.histories[peer.id]?.loaded) {
        loadLatest(peer).catch((error) => report('Loading history failed', error));
      }
    },
    [service, loadLatest],
  );

  const closePeer = useCallback(() => dispatch({ type: 'peerClosed' }), []);

  const sendText = useCallback(
    async (text: string) => {
      const peer = stateRef.current.activePeer;
      if (!peer) return;
      const message = await service.sendText(peer, text);
      dispatch({ type: 'messageReceived', me: user.id, peer, message });
    },
    [service, user.id],
  );

  const sendFile = useCallback(
    async (file: File, caption: string) => {
      const peer = stateRef.current.activePeer;
      if (!peer) return;
      const message = await service.sendFile(peer, file, caption);
      dispatch({ type: 'messageReceived', me: user.id, peer, message });
    },
    [service, user.id],
  );

  const loadOlder = useCallback(async () => {
    const peer = stateRef.current.activePeer;
    const oldest = peer ? stateRef.current.histories[peer.id]?.messages[0] : undefined;
    if (!peer || !oldest) return;

    const { messages, hasMore } = await service.loadHistory(peer, oldest.createdAt);
    dispatch({ type: 'historyLoaded', peerId: peer.id, messages, hasMore });
  }, [service]);

  const value = useMemo<ChatContextValue>(
    () => ({ me: user, state, openPeer, closePeer, sendText, sendFile, loadOlder }),
    [user, state, openPeer, closePeer, sendText, sendFile, loadOlder],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used inside <ChatProvider>');
  return context;
}
