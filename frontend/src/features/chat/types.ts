import type { MessagePayload } from '../../crypto/payload';
import type { User } from '../../shared/user';

/** A message exactly as the server stores it: only routing data and ciphertext. */
export interface EncryptedRecord {
  id: string;
  senderId: string;
  recipientId: string;
  ciphertext: string;
  iv: string;
  createdAt: string;
}

/** A message after decryption. `payload` is null when it could not be decrypted. */
export interface ChatMessage {
  id: string;
  senderId: string;
  recipientId: string;
  createdAt: string;
  payload: MessagePayload | null;
}

export interface Conversation {
  peer: User;
  lastMessage: ChatMessage;
}

export type ConnectionStatus = 'connecting' | 'online' | 'offline';
