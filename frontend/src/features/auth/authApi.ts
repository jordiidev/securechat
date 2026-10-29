import { getJson, postJson } from '../../shared/http';
import { toUser, type User, type UserDto } from '../../shared/user';
import type { KeyBundle } from '../../crypto/identity';

interface KeyBundleDto {
  kdf_salt: string;
  public_key: string;
  encrypted_private_key: string;
  private_key_iv: string;
}

interface AuthResponseDto {
  token: string;
  user: UserDto;
  keys: KeyBundleDto;
}

export interface AuthResponse {
  token: string;
  user: User;
  keys: KeyBundle;
}

function toAuthResponse(dto: AuthResponseDto): AuthResponse {
  return {
    token: dto.token,
    user: toUser(dto.user),
    keys: {
      kdfSalt: dto.keys.kdf_salt,
      publicKey: dto.keys.public_key,
      encryptedPrivateKey: dto.keys.encrypted_private_key,
      privateKeyIv: dto.keys.private_key_iv,
    },
  };
}

export async function fetchKdfSalt(username: string): Promise<string> {
  const response = await postJson<{ kdf_salt: string }>(
    '/auth/prelogin',
    { username },
    { authenticated: false },
  );
  return response.kdf_salt;
}

export async function register(
  username: string,
  authSecret: string,
  keys: KeyBundle,
): Promise<AuthResponse> {
  const dto = await postJson<AuthResponseDto>(
    '/auth/register',
    {
      username,
      auth_secret: authSecret,
      kdf_salt: keys.kdfSalt,
      public_key: keys.publicKey,
      encrypted_private_key: keys.encryptedPrivateKey,
      private_key_iv: keys.privateKeyIv,
    },
    { authenticated: false },
  );
  return toAuthResponse(dto);
}

export async function login(username: string, authSecret: string): Promise<AuthResponse> {
  const dto = await postJson<AuthResponseDto>(
    '/auth/login',
    { username, auth_secret: authSecret },
    { authenticated: false },
  );
  return toAuthResponse(dto);
}

export async function fetchCurrentUser(): Promise<User> {
  return toUser(await getJson<UserDto>('/users/me'));
}
