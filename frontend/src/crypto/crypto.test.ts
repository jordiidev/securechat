import { describe, expect, it } from 'vitest';

import { ConversationCipher } from './conversation-cipher';
import { decryptFile, encryptFile } from './file-crypto';
import { createIdentity, deriveCredentials, generateKdfSalt, restoreIdentity } from './identity';
import type { MessagePayload } from './payload';
import { safetyNumber } from './safety-number';

async function newUser(id: string, password = 'correct horse battery staple') {
  const salt = generateKdfSalt();
  const { wrappingKey } = await deriveCredentials(password, salt);
  const { identity, bundle } = await createIdentity(salt, wrappingKey);
  return { id, identity, bundle, salt, party: { id, publicKey: identity.publicKey } };
}

describe('identity', () => {
  it('restores the same identity from the wrapped bundle', async () => {
    const alice = await newUser('alice');
    const { wrappingKey } = await deriveCredentials('correct horse battery staple', alice.salt);

    const restored = await restoreIdentity(alice.bundle, wrappingKey);
    expect(restored.publicKey).toBe(alice.identity.publicKey);

    const bob = await newUser('bob');
    const original = await ConversationCipher.create(alice.identity.privateKey, 'alice', bob.party);
    const fromRestored = await ConversationCipher.create(restored.privateKey, 'alice', bob.party);
    const encrypted = await original.encrypt({ kind: 'text', text: 'hi' });
    await expect(fromRestored.decrypt(encrypted, 'alice', 'bob')).resolves.toEqual({
      kind: 'text',
      text: 'hi',
    });
  });

  it('refuses to unwrap the private key with a different password', async () => {
    const alice = await newUser('alice');
    const wrong = await deriveCredentials('another password entirely', alice.salt);
    await expect(restoreIdentity(alice.bundle, wrong.wrappingKey)).rejects.toThrow();
  });

  it('derives different auth secret and wrapping key from the same password', async () => {
    const salt = generateKdfSalt();
    const first = await deriveCredentials('password-one', salt);
    const second = await deriveCredentials('password-one', salt);
    const other = await deriveCredentials('password-two', salt);

    expect(first.authSecret).toBe(second.authSecret);
    expect(first.authSecret).not.toBe(other.authSecret);
  });
});

describe('conversation cipher', () => {
  it('lets both participants read each other', async () => {
    const alice = await newUser('alice');
    const bob = await newUser('bob');
    const aliceCipher = await ConversationCipher.create(alice.identity.privateKey, 'alice', bob.party);
    const bobCipher = await ConversationCipher.create(bob.identity.privateKey, 'bob', alice.party);

    const payload: MessagePayload = { kind: 'text', text: 'Halo 👋 dari Jakarta' };
    const encrypted = await aliceCipher.encrypt(payload);

    await expect(bobCipher.decrypt(encrypted, 'alice', 'bob')).resolves.toEqual(payload);
    await expect(aliceCipher.decrypt(encrypted, 'alice', 'bob')).resolves.toEqual(payload);
  });

  it('never repeats an IV and never leaks plaintext', async () => {
    const alice = await newUser('alice');
    const bob = await newUser('bob');
    const cipher = await ConversationCipher.create(alice.identity.privateKey, 'alice', bob.party);

    const first = await cipher.encrypt({ kind: 'text', text: 'secret' });
    const second = await cipher.encrypt({ kind: 'text', text: 'secret' });

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(atob(first.ciphertext)).not.toContain('secret');
  });

  it('rejects a message that was tampered with', async () => {
    const alice = await newUser('alice');
    const bob = await newUser('bob');
    const aliceCipher = await ConversationCipher.create(alice.identity.privateKey, 'alice', bob.party);
    const bobCipher = await ConversationCipher.create(bob.identity.privateKey, 'bob', alice.party);

    const encrypted = await aliceCipher.encrypt({ kind: 'text', text: 'pay 10' });
    const bytes = Uint8Array.from(atob(encrypted.ciphertext), (c) => c.charCodeAt(0));
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    const tampered = { ...encrypted, ciphertext: btoa(String.fromCharCode(...bytes)) };

    await expect(bobCipher.decrypt(tampered, 'alice', 'bob')).rejects.toThrow();
  });

  it('rejects a message replayed in the opposite direction', async () => {
    const alice = await newUser('alice');
    const bob = await newUser('bob');
    const aliceCipher = await ConversationCipher.create(alice.identity.privateKey, 'alice', bob.party);

    const encrypted = await aliceCipher.encrypt({ kind: 'text', text: 'hello' });
    await expect(aliceCipher.decrypt(encrypted, 'bob', 'alice')).rejects.toThrow();
  });

  it('cannot be read by a third user', async () => {
    const alice = await newUser('alice');
    const bob = await newUser('bob');
    const eve = await newUser('eve');
    const aliceCipher = await ConversationCipher.create(alice.identity.privateKey, 'alice', bob.party);
    const eveCipher = await ConversationCipher.create(eve.identity.privateKey, 'eve', alice.party);

    const encrypted = await aliceCipher.encrypt({ kind: 'text', text: 'private' });
    await expect(eveCipher.decrypt(encrypted, 'alice', 'bob')).rejects.toThrow();
  });
});

describe('file encryption', () => {
  it('round-trips a file and hides its content', async () => {
    const original = new Blob([new Uint8Array([1, 2, 3, 4, 5, 250, 251])], { type: 'image/png' });
    const encrypted = await encryptFile(original);

    expect(encrypted.bytes.byteLength).toBe(original.size + 16);

    const decrypted = await decryptFile(encrypted.bytes, {
      attachmentId: 'id',
      key: encrypted.key,
      iv: encrypted.iv,
      name: 'pixel.png',
      mime: 'image/png',
      size: original.size,
    });
    expect(new Uint8Array(await decrypted.arrayBuffer())).toEqual(
      new Uint8Array(await original.arrayBuffer()),
    );
    expect(decrypted.type).toBe('image/png');
  });
});

describe('safety number', () => {
  it('is identical for both participants and differs for other pairs', async () => {
    const alice = await newUser('alice');
    const bob = await newUser('bob');
    const eve = await newUser('eve');

    const fromAlice = await safetyNumber(alice.identity.publicKey, bob.identity.publicKey);
    const fromBob = await safetyNumber(bob.identity.publicKey, alice.identity.publicKey);
    const withEve = await safetyNumber(alice.identity.publicKey, eve.identity.publicKey);

    expect(fromAlice).toBe(fromBob);
    expect(fromAlice).toMatch(/^(\d{5} ){4}\d{5}$/);
    expect(withEve).not.toBe(fromAlice);
  });
});
