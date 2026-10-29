import { describe, expect, it } from 'vitest';

import type { User } from '../../shared/user';
import { chatReducer, initialChatState, mergeMessages, type ChatState } from './chatReducer';
import type { ChatMessage } from './types';

const me = 'me';
const bob: User = { id: 'bob', username: 'bob', publicKey: 'k', createdAt: '2026-01-01T00:00:00Z' };

function message(id: string, senderId: string, createdAt: string): ChatMessage {
  const recipientId = senderId === me ? bob.id : me;
  return { id, senderId, recipientId, createdAt, payload: { kind: 'text', text: id } };
}

describe('mergeMessages', () => {
  it('collapses duplicates and keeps chronological order', () => {
    const first = message('1', me, '2026-10-29T10:00:00Z');
    const second = message('2', bob.id, '2026-10-29T10:01:00Z');

    expect(mergeMessages([second], [first, second]).map((m) => m.id)).toEqual(['1', '2']);
  });
});

describe('chatReducer', () => {
  it('counts unread only for incoming messages in a conversation that is not open', () => {
    const incoming = message('1', bob.id, '2026-10-29T10:00:00Z');
    const outgoing = message('2', me, '2026-10-29T10:01:00Z');

    let state = chatReducer(initialChatState, { type: 'messageReceived', me, peer: bob, message: incoming });
    state = chatReducer(state, { type: 'messageReceived', me, peer: bob, message: outgoing });

    expect(state.unread[bob.id]).toBe(1);
  });

  it('does not count unread while the conversation is open, and clears the badge when opened', () => {
    let state: ChatState = chatReducer(initialChatState, { type: 'peerOpened', peer: bob });
    state = chatReducer(state, {
      type: 'messageReceived',
      me,
      peer: bob,
      message: message('1', bob.id, '2026-10-29T10:00:00Z'),
    });
    expect(state.unread[bob.id]).toBe(0);

    const closed = chatReducer(state, { type: 'peerClosed' });
    const withUnread = chatReducer(closed, {
      type: 'messageReceived',
      me,
      peer: bob,
      message: message('2', bob.id, '2026-10-29T10:05:00Z'),
    });
    expect(withUnread.unread[bob.id]).toBe(1);
    expect(chatReducer(withUnread, { type: 'peerOpened', peer: bob }).unread[bob.id]).toBe(0);
  });

  it('moves the conversation with the newest message to the top', () => {
    const carol: User = { ...bob, id: 'carol', username: 'carol' };
    let state = chatReducer(initialChatState, {
      type: 'messageReceived',
      me,
      peer: bob,
      message: message('1', bob.id, '2026-10-29T10:00:00Z'),
    });
    state = chatReducer(state, {
      type: 'messageReceived',
      me,
      peer: carol,
      message: { ...message('2', 'carol', '2026-10-29T10:01:00Z'), recipientId: me },
    });
    state = chatReducer(state, {
      type: 'messageReceived',
      me,
      peer: bob,
      message: message('3', bob.id, '2026-10-29T10:02:00Z'),
    });

    expect(state.conversations.map((c) => c.peer.id)).toEqual(['bob', 'carol']);
  });

  it('merges a late history page with messages that arrived in the meantime', () => {
    let state = chatReducer(initialChatState, {
      type: 'historyLoaded',
      peerId: bob.id,
      messages: [message('1', bob.id, '2026-10-29T10:00:00Z')],
      hasMore: false,
    });
    state = chatReducer(state, {
      type: 'messageReceived',
      me,
      peer: bob,
      message: message('2', me, '2026-10-29T10:01:00Z'),
    });
    state = chatReducer(state, {
      type: 'historyLoaded',
      peerId: bob.id,
      messages: [message('1', bob.id, '2026-10-29T10:00:00Z')],
      hasMore: false,
    });

    expect(state.histories[bob.id]?.messages.map((m) => m.id)).toEqual(['1', '2']);
  });
});
