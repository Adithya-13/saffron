import type { ClientMessage, ServerMessage } from '@saffron/protocol';
import { useStore } from '../state/store.ts';
import { loadName, loadToken, saveToken } from './storage.ts';

const MAX_FAILED_OPENS = 4;
const MAX_BACKOFF_MS = 8000;

type Session = {
  readonly code: string;
  readonly watch: boolean;
  socket: WebSocket | null;
  closedByUser: boolean;
  attempts: number;
  everOpened: boolean;
};

let session: Session | null = null;

const socketUrl = (code: string): string => {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/api/rooms/${code}/ws`;
};

const handle = (code: string, message: ServerMessage): void => {
  if (message.type === 'welcome' && message.token) saveToken(code, message.token);
  useStore.getState().receive(message);
  if (message.type === 'kicked' || message.type === 'closed') disconnect();
};

const open = (current: Session): void => {
  const store = useStore.getState();
  store.setConnection(current.everOpened ? 'reconnecting' : 'connecting');
  const socket = new WebSocket(socketUrl(current.code));
  current.socket = socket;

  socket.addEventListener('open', () => {
    current.attempts = 0;
    current.everOpened = true;
    useStore.getState().setConnection('open');
    const token = loadToken(current.code);
    send({
      type: 'join',
      name: loadName() || 'Trader',
      ...(token ? { token } : {}),
      ...(current.watch ? { watch: true } : {}),
    });
  });

  socket.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return;
    try {
      handle(current.code, JSON.parse(event.data) as ServerMessage);
    } catch {
      return;
    }
  });

  socket.addEventListener('close', () => {
    if (session !== current || current.closedByUser) return;
    current.attempts += 1;
    if (!current.everOpened && current.attempts >= MAX_FAILED_OPENS) {
      useStore.getState().setConnection('failed');
      return;
    }
    useStore.getState().setConnection('reconnecting');
    const delay = Math.min(500 * 2 ** current.attempts, MAX_BACKOFF_MS);
    setTimeout(() => {
      if (session === current && !current.closedByUser) open(current);
    }, delay);
  });
};

export const connect = (code: string, watch: boolean): void => {
  disconnect();
  session = { code, watch, socket: null, closedByUser: false, attempts: 0, everOpened: false };
  useStore.getState().setCode(code);
  open(session);
};

export const disconnect = (): void => {
  if (!session) return;
  session.closedByUser = true;
  session.socket?.close();
  session = null;
  useStore.getState().setConnection('idle');
};

export const send = (message: ClientMessage): void => {
  const socket = session?.socket;
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  else useStore.getState().showToast('Reconnecting to the bazaar...', 'error');
};

export const createRoom = async (): Promise<string> => {
  const response = await fetch('/api/rooms', { method: 'POST' });
  if (!response.ok) throw new Error('Could not create a room');
  const body = (await response.json()) as { code: string };
  return body.code;
};
