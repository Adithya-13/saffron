const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const randomBytes = (length: number): Uint8Array => crypto.getRandomValues(new Uint8Array(length));

export const randomId = (): string =>
  Array.from(randomBytes(8), (b) => b.toString(16).padStart(2, '0')).join('');

export const randomSeed = (): number => crypto.getRandomValues(new Uint32Array(1))[0] ?? 1;

export const randomRoomCode = (length: number): string =>
  Array.from(randomBytes(length), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
