import { ConversationCipher } from '../../crypto/conversation-cipher';
import { decryptFile, encryptFile, maxPlainFileBytes } from '../../crypto/file-crypto';
import type { Identity } from '../../crypto/identity';
import type { FileDescriptor, MessagePayload } from '../../crypto/payload';
import type { User } from '../../shared/user';
import * as chatApi from './chatApi';
import type { ChatMessage, Conversation, EncryptedRecord } from './types';

export const HISTORY_PAGE_SIZE = 50;
/** Must match the backend's MAX_UPLOAD_BYTES. */
export const SERVER_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;
export const MAX_FILE_BYTES = maxPlainFileBytes(SERVER_UPLOAD_LIMIT_BYTES);

/**
 * Everything that touches both the network and the keys: it fetches ciphertext,
 * decrypts it, and encrypts outgoing content before it leaves the browser.
 */
export class ChatService {
  private readonly ciphers = new Map<string, Promise<ConversationCipher>>();
  private readonly peers = new Map<string, User>();

  constructor(
    private readonly me: User,
    private readonly identity: Identity,
  ) {}

  rememberPeer(peer: User): void {
    this.peers.set(peer.id, peer);
  }

  async peerOf(record: EncryptedRecord): Promise<User> {
    const peerId = record.senderId === this.me.id ? record.recipientId : record.senderId;
    const known = this.peers.get(peerId);
    if (known) return known;

    const peer = await chatApi.fetchUser(peerId);
    this.rememberPeer(peer);
    return peer;
  }

  async loadConversations(): Promise<Conversation[]> {
    const summaries = await chatApi.fetchConversations();
    return Promise.all(
      summaries.map(async ({ peer, lastMessage }) => {
        this.rememberPeer(peer);
        return { peer, lastMessage: await this.decrypt(lastMessage, peer) };
      }),
    );
  }

  async loadHistory(
    peer: User,
    before?: string,
  ): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
    const records = await chatApi.fetchHistory(peer.id, { before, limit: HISTORY_PAGE_SIZE });
    const messages = await Promise.all(records.map((record) => this.decrypt(record, peer)));
    return { messages, hasMore: records.length === HISTORY_PAGE_SIZE };
  }

  async decrypt(record: EncryptedRecord, peer: User): Promise<ChatMessage> {
    const base = {
      id: record.id,
      senderId: record.senderId,
      recipientId: record.recipientId,
      createdAt: record.createdAt,
    };
    try {
      const cipher = await this.cipherFor(peer);
      const payload = await cipher.decrypt(record, record.senderId, record.recipientId);
      return { ...base, payload };
    } catch {
      return { ...base, payload: null };
    }
  }

  sendText(peer: User, text: string): Promise<ChatMessage> {
    return this.send(peer, { kind: 'text', text });
  }

  async sendFile(peer: User, file: File, caption: string): Promise<ChatMessage> {
    if (file.size > MAX_FILE_BYTES) throw new Error('File is too large.');

    const encrypted = await encryptFile(file);
    const attachmentId = await chatApi.uploadAttachment(peer.id, encrypted.bytes);
    const descriptor: FileDescriptor = {
      attachmentId,
      key: encrypted.key,
      iv: encrypted.iv,
      name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
    };
    return this.send(peer, { kind: 'file', caption, file: descriptor });
  }

  private async send(peer: User, payload: MessagePayload): Promise<ChatMessage> {
    const cipher = await this.cipherFor(peer);
    const record = await chatApi.postMessage(peer.id, await cipher.encrypt(payload));
    return {
      id: record.id,
      senderId: record.senderId,
      recipientId: record.recipientId,
      createdAt: record.createdAt,
      payload,
    };
  }

  private cipherFor(peer: User): Promise<ConversationCipher> {
    let cipher = this.ciphers.get(peer.id);
    if (!cipher) {
      cipher = ConversationCipher.create(this.identity.privateKey, this.me.id, peer);
      this.ciphers.set(peer.id, cipher);
      cipher.catch(() => this.ciphers.delete(peer.id));
    }
    return cipher;
  }
}

export async function fetchDecryptedFile(file: FileDescriptor): Promise<Blob> {
  return decryptFile(await chatApi.downloadAttachment(file.attachmentId), file);
}
