import { create } from 'zustand';
import type { Move, PlayerView, Spice, VisibleEvent } from '@saffron/engine';
import type { ChatMessage, ErrorCode, RoomSnapshot, ServerMessage } from '@saffron/protocol';

export type Connection = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'failed';

export type SyncMessage = Extract<ServerMessage, { type: 'sync' }>;

export type Selection =
  | { readonly kind: 'market'; readonly tier: 1 | 2 | 3; readonly slot: number }
  | { readonly kind: 'deck'; readonly tier: 1 | 2 | 3 }
  | { readonly kind: 'reserve'; readonly playerId: string; readonly index: number }
  | null;

const reservedKey = (view: PlayerView, playerId: string, index: number): string | null => {
  const entry = view.players.find((p) => p.id === playerId)?.reserved[index];
  return entry ? (entry.card?.id ?? `hidden-${entry.tier}`) : null;
};

const keepSelection = (
  selection: Selection,
  before: PlayerView | null,
  after: PlayerView | null,
): Selection => {
  if (!selection || !before || !after) return null;
  switch (selection.kind) {
    case 'market': {
      const was = before.market[selection.tier][selection.slot]?.id;
      return was !== undefined && was === after.market[selection.tier][selection.slot]?.id
        ? selection
        : null;
    }
    case 'deck':
      return after.deckCounts[selection.tier] > 0 ? selection : null;
    case 'reserve': {
      const was = reservedKey(before, selection.playerId, selection.index);
      return was !== null && was === reservedKey(after, selection.playerId, selection.index)
        ? selection
        : null;
    }
  }
};

export type Toast = { readonly id: number; readonly text: string; readonly tone: 'info' | 'error' };

type State = {
  readonly code: string | null;
  readonly connection: Connection;
  readonly seatId: string | null;
  readonly viewerId: string | null;
  readonly room: RoomSnapshot | null;
  readonly view: PlayerView | null;
  readonly legal: readonly Move[];
  readonly log: readonly VisibleEvent[];
  readonly chat: readonly ChatMessage[];
  readonly unreadChat: number;
  readonly queue: readonly SyncMessage[];
  readonly draft: readonly Spice[];
  readonly selection: Selection;
  readonly toast: Toast | null;
  readonly serverOffset: number;
  readonly removed: 'kicked' | 'closed' | null;
};

type Actions = {
  readonly setCode: (code: string | null) => void;
  readonly setConnection: (connection: Connection) => void;
  readonly receive: (message: ServerMessage) => void;
  readonly shiftQueue: () => SyncMessage | undefined;
  readonly commitSync: (message: SyncMessage) => void;
  readonly setDraft: (draft: readonly Spice[]) => void;
  readonly select: (selection: Selection) => void;
  readonly showToast: (text: string, tone?: Toast['tone']) => void;
  readonly clearToast: (id: number) => void;
  readonly markChatRead: () => void;
};

const ERROR_TEXT: Partial<Record<ErrorCode, string>> = {
  notYourTurn: "It isn't your turn yet",
  cannotAfford: "You can't afford that card",
  reserveFull: 'You already hold 3 reserved cards',
  pileTooSmall: 'Take two only from a pile of 4 or more',
  invalidTokens: 'That spice combination is not allowed',
  notEnoughPlayers: 'Need at least 2 players to open the market',
  roomFull: 'This room is full',
  rateLimited: 'Easy there, one message at a time',
  undoPending: 'Waiting on the take-back vote',
  undoUnavailable: 'Take-back is no longer available',
  notHost: 'Only the host can do that',
  notInLobby: 'The game has already started',
  paused: 'The game is paused',
};

let toastCounter = 0;

export const memberIdOf = (s: Pick<State, 'seatId' | 'viewerId'>): string | null =>
  s.seatId ?? s.viewerId;

export const useStore = create<State & Actions>()((set, get) => ({
  code: null,
  connection: 'idle',
  seatId: null,
  viewerId: null,
  room: null,
  view: null,
  legal: [],
  log: [],
  chat: [],
  unreadChat: 0,
  queue: [],
  draft: [],
  selection: null,
  toast: null,
  serverOffset: 0,
  removed: null,

  setCode: (code) =>
    set({
      code,
      room: null,
      view: null,
      queue: [],
      chat: [],
      log: [],
      seatId: null,
      viewerId: null,
      removed: null,
    }),
  setConnection: (connection) => set({ connection }),

  receive: (message) => {
    switch (message.type) {
      case 'welcome':
        set({ seatId: message.seatId, viewerId: message.viewerId });
        return;
      case 'sync':
        set((s) => ({
          queue: [...s.queue, message],
          serverOffset: message.serverNow - Date.now(),
        }));
        return;
      case 'chat':
        set((s) => ({
          chat: message.replace ? message.messages : [...s.chat, ...message.messages].slice(-100),
          unreadChat: message.replace
            ? 0
            : s.unreadChat +
              message.messages.filter((m) => m.seatId !== null && m.seatId !== memberIdOf(s))
                .length,
        }));
        return;
      case 'error':
        get().showToast(ERROR_TEXT[message.code] ?? 'That move is not allowed', 'error');
        return;
      case 'kicked':
      case 'closed':
        set({ removed: message.type });
        return;
    }
  },

  shiftQueue: () => {
    const [head, ...rest] = get().queue;
    if (head) set({ queue: rest });
    return head;
  },

  commitSync: (message) => {
    const before = get().view;
    const turnChanged =
      before?.turn !== message.view?.turn || before?.phase.kind !== message.view?.phase.kind;
    set({
      room: message.room,
      view: message.view,
      legal: message.legal,
      log: message.log,
      selection: keepSelection(get().selection, before, message.view),
      ...(turnChanged ? { draft: [] } : {}),
    });
  },

  setDraft: (draft) => set({ draft, selection: null }),
  select: (selection) => set({ selection }),

  showToast: (text, tone = 'info') => {
    const id = ++toastCounter;
    set({ toast: { id, text, tone } });
  },
  clearToast: (id) => {
    if (get().toast?.id === id) set({ toast: null });
  },
  markChatRead: () => set({ unreadChat: 0 }),
}));
