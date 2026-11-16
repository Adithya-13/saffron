import { ROOM_CODE_LENGTH } from '@saffron/protocol';
import { randomRoomCode } from './random.ts';

export { Room } from './durableRoom.ts';

type Env = {
  readonly ROOMS: DurableObjectNamespace;
  readonly ASSETS: Fetcher;
};

const CREATE_ATTEMPTS = 5;
const ROOM_SOCKET_PATH = /^\/api\/rooms\/([A-Z0-9]+)\/ws$/;

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const createRoom = async (env: Env, origin: string): Promise<Response> => {
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const code = randomRoomCode(ROOM_CODE_LENGTH);
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    const response = await stub.fetch(`${origin}/init?code=${code}`, { method: 'POST' });
    if (response.ok) return json({ code });
  }
  return json({ error: 'Could not allocate a room' }, 503);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      return createRoom(env, url.origin);
    }
    const socketMatch = ROOM_SOCKET_PATH.exec(url.pathname);
    const code = socketMatch?.[1];
    if (code) return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
