import { fromBase64, randomBytes, toBase64, utf8Decode, utf8Encode } from '../shared/encoding';
import { importPublicKey } from './identity';
import { isMessagePayload, type MessagePayload } from './payload';

const AES_GCM_IV_BYTES = 12;
const HKDF_INFO = 'secure-chat/v1/message';

export interface EncryptedMessage {
  ciphertext: string;
  iv: string;
}

export interface Party {
  id: string;
  publicKey: string;
}

/**
 * Encrypts and decrypts the messages of one conversation.
 *
 * Both users derive the same AES-256-GCM key from an ECDH exchange of their long-term keys.
 * The sender and recipient ids are authenticated as additional data, so a ciphertext cannot be
 * replayed in another conversation or reflected back in the opposite direction.
 */
export class ConversationCipher {
  private constructor(
    private readonly key: CryptoKey,
    private readonly me: string,
    private readonly peer: string,
  ) {}

  static async create(myPrivateKey: CryptoKey, myId: string, peer: Party): Promise<ConversationCipher> {
    const sharedSecret = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: await importPublicKey(peer.publicKey) },
      myPrivateKey,
      256,
    );
    const hkdfKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: utf8Encode([myId, peer.id].sort().join(':')),
        info: utf8Encode(HKDF_INFO),
      },
      hkdfKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    return new ConversationCipher(key, myId, peer.id);
  }

  async encrypt(payload: MessagePayload): Promise<EncryptedMessage> {
    const iv = randomBytes(AES_GCM_IV_BYTES);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: this.direction(this.me, this.peer) },
      this.key,
      utf8Encode(JSON.stringify(payload)),
    );
    return { ciphertext: toBase64(ciphertext), iv: toBase64(iv) };
  }

  async decrypt(
    message: EncryptedMessage,
    senderId: string,
    recipientId: string,
  ): Promise<MessagePayload> {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: fromBase64(message.iv),
        additionalData: this.direction(senderId, recipientId),
      },
      this.key,
      fromBase64(message.ciphertext),
    );

    const payload: unknown = JSON.parse(utf8Decode(plaintext));
    if (!isMessagePayload(payload)) {
      throw new Error('Decrypted message has an unknown format');
    }
    return payload;
  }

  private direction(senderId: string, recipientId: string): Uint8Array<ArrayBuffer> {
    return utf8Encode(`${senderId}>${recipientId}`);
  }
}
