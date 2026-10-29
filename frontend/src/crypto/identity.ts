import { fromBase64, randomBytes, toBase64, utf8Encode } from '../shared/encoding';

const PBKDF2_ITERATIONS = 600_000;
const KDF_SALT_BYTES = 16;
const AES_GCM_IV_BYTES = 12;
const ECDH_PARAMS: EcKeyImportParams = { name: 'ECDH', namedCurve: 'P-256' };

/** Credentials derived from the password. Only `authSecret` is ever sent to the server. */
export interface DerivedCredentials {
  authSecret: string;
  wrappingKey: CryptoKey;
}

/** The user's long-term key pair. The private key is non-extractable once loaded. */
export interface Identity {
  privateKey: CryptoKey;
  publicKey: string;
}

/** What the server stores so the identity can be restored on another device. */
export interface KeyBundle {
  kdfSalt: string;
  publicKey: string;
  encryptedPrivateKey: string;
  privateKeyIv: string;
}

export function generateKdfSalt(): string {
  return toBase64(randomBytes(KDF_SALT_BYTES));
}

/**
 * One PBKDF2 run yields 512 bits: the first half authenticates to the server,
 * the second half wraps the private key. The server only ever sees the first half,
 * so it cannot unwrap the key.
 */
export async function deriveCredentials(
  password: string,
  kdfSalt: string,
): Promise<DerivedCredentials> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    utf8Encode(password.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(kdfSalt), iterations: PBKDF2_ITERATIONS },
      passwordKey,
      512,
    ),
  );

  const wrappingKey = await crypto.subtle.importKey('raw', bits.slice(32), 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
  const authSecret = toBase64(bits.slice(0, 32));
  bits.fill(0);
  return { authSecret, wrappingKey };
}

export async function createIdentity(
  kdfSalt: string,
  wrappingKey: CryptoKey,
): Promise<{ identity: Identity; bundle: KeyBundle }> {
  const pair = await crypto.subtle.generateKey(ECDH_PARAMS, true, ['deriveBits']);
  const publicKey = toBase64(await crypto.subtle.exportKey('raw', pair.publicKey));
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);

  const iv = randomBytes(AES_GCM_IV_BYTES);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, pkcs8);
  const privateKey = await importPrivateKey(pkcs8);

  return {
    identity: { privateKey, publicKey },
    bundle: {
      kdfSalt,
      publicKey,
      encryptedPrivateKey: toBase64(encrypted),
      privateKeyIv: toBase64(iv),
    },
  };
}

export async function restoreIdentity(
  bundle: KeyBundle,
  wrappingKey: CryptoKey,
): Promise<Identity> {
  const pkcs8 = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(bundle.privateKeyIv) },
    wrappingKey,
    fromBase64(bundle.encryptedPrivateKey),
  );
  return { privateKey: await importPrivateKey(pkcs8), publicKey: bundle.publicKey };
}

export function importPublicKey(publicKey: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromBase64(publicKey), ECDH_PARAMS, false, []);
}

function importPrivateKey(pkcs8: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey('pkcs8', pkcs8, ECDH_PARAMS, false, ['deriveBits']);
}
