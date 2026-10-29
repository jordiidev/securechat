import { getBytes, getJson, postBytes, postJson } from '../../shared/http';
import { toUser, type User, type UserDto } from '../../shared/user';
import type { EncryptedRecord } from './types';

export interface MessageDto {
  id: string;
  sender_id: string;
  recipient_id: string;
  ciphertext: string;
  iv: string;
  created_at: string;
}

interface ConversationDto {
  peer: UserDto;
  last_message: MessageDto;
}

export function toEncryptedRecord(dto: MessageDto): EncryptedRecord {
  return {
    id: dto.id,
    senderId: dto.sender_id,
    recipientId: dto.recipient_id,
    ciphertext: dto.ciphertext,
    iv: dto.iv,
    createdAt: dto.created_at,
  };
}

export async function searchUsers(query: string): Promise<User[]> {
  const dtos = await getJson<UserDto[]>(`/users?q=${encodeURIComponent(query)}`);
  return dtos.map(toUser);
}

export async function fetchUser(id: string): Promise<User> {
  return toUser(await getJson<UserDto>(`/users/${encodeURIComponent(id)}`));
}

export async function fetchConversations(): Promise<{ peer: User; lastMessage: EncryptedRecord }[]> {
  const dtos = await getJson<ConversationDto[]>('/conversations');
  return dtos.map((dto) => ({
    peer: toUser(dto.peer),
    lastMessage: toEncryptedRecord(dto.last_message),
  }));
}

export async function fetchHistory(
  peerId: string,
  options: { before?: string; limit: number },
): Promise<EncryptedRecord[]> {
  const params = new URLSearchParams({ peer_id: peerId, limit: String(options.limit) });
  if (options.before) params.set('before', options.before);

  const dtos = await getJson<MessageDto[]>(`/messages?${params}`);
  return dtos.map(toEncryptedRecord);
}

export async function postMessage(
  recipientId: string,
  encrypted: { ciphertext: string; iv: string },
): Promise<EncryptedRecord> {
  const dto = await postJson<MessageDto>('/messages', {
    recipient_id: recipientId,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
  });
  return toEncryptedRecord(dto);
}

export async function uploadAttachment(recipientId: string, bytes: ArrayBuffer): Promise<string> {
  const response = await postBytes<{ id: string }>(
    `/attachments?recipient_id=${encodeURIComponent(recipientId)}`,
    bytes,
  );
  return response.id;
}

export function downloadAttachment(id: string): Promise<ArrayBuffer> {
  return getBytes(`/attachments/${encodeURIComponent(id)}`);
}
