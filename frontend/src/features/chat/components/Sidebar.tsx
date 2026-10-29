import { useEffect, useState } from 'react';

import { Avatar } from '../../../shared/Avatar';
import { formatListTimestamp } from '../../../shared/format';
import { CloseIcon, LogoutIcon, SearchIcon } from '../../../shared/icons';
import type { User } from '../../../shared/user';
import { useAuth } from '../../auth/AuthContext';
import * as chatApi from '../chatApi';
import { useChat } from '../ChatContext';
import { previewOf } from '../preview';

const SEARCH_DEBOUNCE_MS = 250;

function useUserSearch(query: string): { users: User[]; searching: boolean } {
  const [users, setUsers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setUsers([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      chatApi
        .searchUsers(trimmed)
        .then((found) => !cancelled && setUsers(found))
        .catch(() => !cancelled && setUsers([]))
        .finally(() => !cancelled && setSearching(false));
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return { users, searching };
}

export function Sidebar() {
  const { me, state, openPeer } = useChat();
  const { logout } = useAuth();
  const [query, setQuery] = useState('');
  const { users, searching } = useUserSearch(query);
  const isSearching = query.trim().length > 0;

  function open(peer: User) {
    openPeer(peer);
    setQuery('');
  }

  return (
    <aside className="sidebar">
      <header className="sidebar__header">
        <Avatar name={me.username} />
        <div className="sidebar__identity">
          <strong>{me.username}</strong>
          <span className={`status status--${state.connection}`}>
            {state.connection === 'online'
              ? 'Connected'
              : state.connection === 'connecting'
                ? 'Connecting…'
                : 'Offline, retrying…'}
          </span>
        </div>
        <button className="icon-button" onClick={() => void logout()} title="Log out" aria-label="Log out">
          <LogoutIcon />
        </button>
      </header>

      <div className="search">
        <SearchIcon className="search__icon" />
        <input
          className="search__input"
          placeholder="Search people by username"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search people"
        />
        {query && (
          <button className="icon-button icon-button--small" onClick={() => setQuery('')} aria-label="Clear search">
            <CloseIcon width={16} height={16} />
          </button>
        )}
      </div>

      <ul className="list" aria-label={isSearching ? 'Search results' : 'Conversations'}>
        {isSearching ? (
          <>
            {users.map((user) => (
              <li key={user.id}>
                <button className="list__item" onClick={() => open(user)}>
                  <Avatar name={user.username} />
                  <span className="list__body">
                    <span className="list__title">{user.username}</span>
                    <span className="list__subtitle">Start an encrypted chat</span>
                  </span>
                </button>
              </li>
            ))}
            {!searching && users.length === 0 && <li className="list__empty">No one found.</li>}
          </>
        ) : (
          <>
            {state.conversations.map(({ peer, lastMessage }) => {
              const unread = state.unread[peer.id] ?? 0;
              const isActive = state.activePeer?.id === peer.id;
              const prefix = lastMessage.senderId === me.id ? 'You: ' : '';
              return (
                <li key={peer.id}>
                  <button
                    className={`list__item${isActive ? ' list__item--active' : ''}`}
                    onClick={() => open(peer)}
                  >
                    <Avatar name={peer.username} />
                    <span className="list__body">
                      <span className="list__row">
                        <span className="list__title">{peer.username}</span>
                        <time className="list__time" dateTime={lastMessage.createdAt}>
                          {formatListTimestamp(lastMessage.createdAt)}
                        </time>
                      </span>
                      <span className="list__row">
                        <span className="list__subtitle">
                          {prefix}
                          {previewOf(lastMessage.payload)}
                        </span>
                        {unread > 0 && <span className="badge">{unread}</span>}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
            {state.conversations.length === 0 && (
              <li className="list__empty">No chats yet. Search for a username to say hello.</li>
            )}
          </>
        )}
      </ul>
    </aside>
  );
}
