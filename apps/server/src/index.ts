import { ROOM_CODE_LENGTH } from '@saffron/protocol';
import { HOME_PREVIEW, roomPreview } from './preview.ts';
import type { Preview, RoomInfo } from './preview.ts';
import { randomRoomCode } from './random.ts';

export { Room } from './durableRoom.ts';

type Env = {
  readonly ROOMS: DurableObjectNamespace;
  readonly ASSETS: Fetcher;
};

const CREATE_ATTEMPTS = 5;
const ROOM_SOCKET_PATH = /^\/api\/rooms\/([A-Z0-9]+)\/ws$/;
const ROOM_PAGE_PATH = /^\/r\/([A-Za-z0-9]+)\/?$/;

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

const roomInfoFor = async (env: Env, origin: string, code: string): Promise<RoomInfo | null> => {
  if (code.length !== ROOM_CODE_LENGTH) return null;
  try {
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    const response = await stub.fetch(`${origin}/info`);
    return response.ok ? ((await response.json()) as RoomInfo) : null;
  } catch {
    return null;
  }
};

const setContent = (value: string) => ({
  element: (element: Element) => {
    element.setAttribute('content', value);
  },
});

const withPreview = async (env: Env, url: URL, preview: Preview): Promise<Response> => {
  const page = await env.ASSETS.fetch(new Request(new URL('/', url)));
  const response = new HTMLRewriter()
    .on('title', {
      element: (element) => {
        element.setInnerContent(preview.title);
      },
    })
    .on('meta[property="og:title"]', setContent(preview.title))
    .on('meta[property="og:description"]', setContent(preview.description))
    .on('meta[name="description"]', setContent(preview.description))
    .on('meta[property="og:image"]', setContent(new URL('/og.jpg', url).href))
    .on('meta[property="og:url"]', setContent(url.href))
    .transform(page);
  return new Response(response.body, {
    status: page.status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' },
  });
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
    if (url.pathname === '/') return withPreview(env, url, HOME_PREVIEW);
    const pageCode = ROOM_PAGE_PATH.exec(url.pathname)?.[1]?.toUpperCase();
    if (pageCode) {
      const info = await roomInfoFor(env, url.origin, pageCode);
      return withPreview(env, url, roomPreview(pageCode, info));
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
