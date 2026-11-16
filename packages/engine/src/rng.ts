export type RngState = number;

export type RngStep = { readonly value: number; readonly next: RngState };

export const seedRng = (seed: number): RngState => seed >>> 0;

export const nextFloat = (state: RngState): RngStep => {
  const advanced = (state + 0x6d2b79f5) >>> 0;
  let t = advanced;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, next: advanced };
};

export const shuffle = <T>(
  items: readonly T[],
  state: RngState,
): { readonly items: T[]; readonly next: RngState } => {
  const result = [...items];
  let current = state;
  for (let i = result.length - 1; i > 0; i--) {
    const step = nextFloat(current);
    current = step.next;
    const j = Math.floor(step.value * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return { items: result, next: current };
};
