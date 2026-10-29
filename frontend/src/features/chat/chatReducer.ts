import type { User } from '../../shared/user';
import type { ChatMessage, ConnectionStatus, Conversation } from './types';

export interface History {
  messages: ChatMessage[];
  /** True once the latest page has been fetched from the server. */
  loaded: boolean;
  /** True while older messages may still exist on the server. */
  hasMore: boolean;
}

export interface ChatState {
  conversations: Conversation[];
  histories: Record<string, History>;
  unread: Record<string, number>;
  activePeer: User | null;
  connection: ConnectionStatus;
}

export type ChatAction =
  | { type: 'conversationsLoaded'; conversations: Conversation[] }
  | { type: 'peerOpened'; peer: User }
  | { type: 'peerClosed' }
  | { type: 'historyLoaded'; peerId: string; messages: ChatMessage[]; hasMore: boolean }
  | { type: 'messageReceived'; me: string; peer: User; message: ChatMessage }
  | { type: 'connectionChanged'; status: ConnectionStatus };

export const initialChatState: ChatState = {
  conversations: [],
  histories: {},
  unread: {},
  activePeer: null,
  connection: 'connecting',
};

const EMPTY_HISTORY: History = { messages: [], loaded: false, hasMore: false };

/** Merges two lists by message id, oldest first. Duplicates (e.g. REST reply plus WebSocket echo) collapse. */
export function mergeMessages(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const message of [...existing, ...incoming]) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function upsertConversation(
  conversations: Conversation[],
  peer: User,
  message: ChatMessage,
): Conversation[] {
  const current = conversations.find((conversation) => conversation.peer.id === peer.id);
  const lastMessage =
    current && current.lastMessage.createdAt > message.createdAt ? current.lastMessage : message;

  return [
    { peer, lastMessage },
    ...conversations.filter((conversation) => conversation.peer.id !== peer.id),
  ].sort((a, b) => b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt));
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'conversationsLoaded':
      return { ...state, conversations: action.conversations };

    case 'peerOpened':
      return {
        ...state,
        activePeer: action.peer,
        unread: { ...state.unread, [action.peer.id]: 0 },
      };

    case 'peerClosed':
      return { ...state, activePeer: null };

    case 'historyLoaded': {
      const history = state.histories[action.peerId] ?? EMPTY_HISTORY;
      return {
        ...state,
        histories: {
          ...state.histories,
          [action.peerId]: {
            messages: mergeMessages(history.messages, action.messages),
            loaded: true,
            hasMore: action.hasMore,
          },
        },
      };
    }

    case 'messageReceived': {
      const { me, peer, message } = action;
      const history = state.histories[peer.id];
      const isIncoming = message.senderId !== me;
      const isViewing = state.activePeer?.id === peer.id;

      return {
        ...state,
        conversations: upsertConversation(state.conversations, peer, message),
        histories: history
          ? {
              ...state.histories,
              [peer.id]: { ...history, messages: mergeMessages(history.messages, [message]) },
            }
          : state.histories,
        unread:
          isIncoming && !isViewing
            ? { ...state.unread, [peer.id]: (state.unread[peer.id] ?? 0) + 1 }
            : state.unread,
      };
    }

    case 'connectionChanged':
      return { ...state, connection: action.status };
  }
}
