const NAME_KEY = 'saffron:name';
const tokenKey = (code: string): string => `saffron:seat:${code}`;

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    return;
  }
};

export const loadName = (): string => read(NAME_KEY) ?? '';
export const saveName = (name: string): void => write(NAME_KEY, name);
export const loadToken = (code: string): string | null => read(tokenKey(code));
export const saveToken = (code: string, token: string): void => write(tokenKey(code), token);
export const loadSetting = (key: string): string | null => read(`saffron:setting:${key}`);
export const saveSetting = (key: string, value: string): void =>
  write(`saffron:setting:${key}`, value);
