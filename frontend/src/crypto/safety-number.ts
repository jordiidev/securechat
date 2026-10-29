import { utf8Encode } from '../shared/encoding';

const GROUPS = 5;
const BYTES_PER_GROUP = 3;
const GROUP_MODULUS = 100_000;

/**
 * A short number both users can compare over another channel (a call, in person).
 * If it matches, the server has not swapped anyone's public key.
 */
export async function safetyNumber(publicKeyA: string, publicKeyB: string): Promise<string> {
  const [first, second] = [publicKeyA, publicKeyB].sort();
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', utf8Encode(`${first}|${second}`)),
  );

  const groups: string[] = [];
  for (let group = 0; group < GROUPS; group += 1) {
    let value = 0;
    for (let i = 0; i < BYTES_PER_GROUP; i += 1) {
      value = value * 256 + (digest[group * BYTES_PER_GROUP + i] ?? 0);
    }
    groups.push(String(value % GROUP_MODULUS).padStart(5, '0'));
  }
  return groups.join(' ');
}
