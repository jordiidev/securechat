import { clearIdentity, loadIdentity, saveIdentity } from '../../crypto/key-store';
import {
  createIdentity,
  deriveCredentials,
  generateKdfSalt,
  restoreIdentity,
  type Identity,
} from '../../crypto/identity';
import { ApiError, tokenStorage } from '../../shared/http';
import type { User } from '../../shared/user';
import * as authApi from './authApi';

export interface AuthenticatedSession {
  user: User;
  identity: Identity;
}

export async function register(username: string, password: string): Promise<AuthenticatedSession> {
  const kdfSalt = generateKdfSalt();
  const { authSecret, wrappingKey } = await deriveCredentials(password, kdfSalt);
  const { identity, bundle } = await createIdentity(kdfSalt, wrappingKey);

  const response = await authApi.register(username, authSecret, bundle);
  return establishSession(response.token, response.user, identity);
}

export async function login(username: string, password: string): Promise<AuthenticatedSession> {
  const kdfSalt = await authApi.fetchKdfSalt(username);
  const { authSecret, wrappingKey } = await deriveCredentials(password, kdfSalt);

  const response = await authApi.login(username, authSecret);
  const identity = await restoreIdentity(response.keys, wrappingKey);
  return establishSession(response.token, response.user, identity);
}

/** Resumes a previous session after a page reload, without asking for the password again. */
export async function resumeSession(): Promise<AuthenticatedSession | null> {
  if (!tokenStorage.get()) return null;

  try {
    const user = await authApi.fetchCurrentUser();
    const identity = await loadIdentity(user.id);
    if (identity) return { user, identity };
  } catch (error) {
    // Keep the credentials when the server is merely unreachable.
    if (!(error instanceof ApiError)) throw error;
  }

  await logout();
  return null;
}

export async function logout(): Promise<void> {
  tokenStorage.clear();
  await clearIdentity();
}

async function establishSession(
  token: string,
  user: User,
  identity: Identity,
): Promise<AuthenticatedSession> {
  tokenStorage.set(token);
  await saveIdentity(user.id, identity);
  return { user, identity };
}
