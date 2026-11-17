import { describe, expect, it } from 'vitest';
import { roomPreview } from './preview.ts';

describe('room link preview', () => {
  it('invites people to an open table with the code and seats left', () => {
    expect(roomPreview('K7QXM', { host: 'Ana', seats: 3, status: 'lobby' })).toEqual({
      title: "Join Ana's table · Room K7QXM",
      description: 'Room code K7QXM. 5 seats left. Play Saffron together in your browser.',
    });
  });

  it('offers to watch a game in progress', () => {
    expect(roomPreview('K7QXM', { host: 'Ana', seats: 4, status: 'playing' }).title).toBe(
      "Watch Ana's table · Room K7QXM",
    );
  });

  it('still shows the code when the room is unknown', () => {
    expect(roomPreview('K7QXM', null).title).toBe('Saffron · Room K7QXM');
  });

  it('mentions watching when every seat is taken', () => {
    expect(roomPreview('K7QXM', { host: 'Ana', seats: 8, status: 'lobby' }).description).toContain(
      'you can watch',
    );
  });
});
