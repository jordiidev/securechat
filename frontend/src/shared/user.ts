export interface User {
  id: string;
  username: string;
  publicKey: string;
  createdAt: string;
}

export interface UserDto {
  id: string;
  username: string;
  public_key: string;
  created_at: string;
}

export function toUser(dto: UserDto): User {
  return {
    id: dto.id,
    username: dto.username,
    publicKey: dto.public_key,
    createdAt: dto.created_at,
  };
}
