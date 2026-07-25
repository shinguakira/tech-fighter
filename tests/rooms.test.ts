import { beforeEach, describe, expect, it } from 'vitest';
import { _resetRooms, createRoom, joinRoom, quickMatch, relay, roomCount, subscribe, type NetSignal } from '../src/net/server/rooms';

describe('マッチング/シグナリング サーバーコア', () => {
  beforeEach(() => _resetRooms());

  it('createRoom: host が作成され、コードが返る', () => {
    const r = createRoom('a');
    expect(r.ok).toBe(true);
    expect(r.role).toBe('host');
    expect(r.roomId).toMatch(/^[A-Z0-9]{4}$/);
    expect(roomCount()).toBe(1);
  });

  it('joinRoom: guest が参加すると2人に。満員は弾く', () => {
    const host = createRoom('a');
    const g = joinRoom(host.roomId!, 'b');
    expect(g.ok).toBe(true);
    expect(g.role).toBe('guest');
    const c = joinRoom(host.roomId!, 'c');
    expect(c.ok).toBe(false);
  });

  it('存在しないコードは参加失敗', () => {
    expect(joinRoom('ZZZZ', 'x').ok).toBe(false);
  });

  it('quickMatch: 待機ルームがあれば参加、無ければ作成', () => {
    const first = quickMatch('a');
    expect(first.role).toBe('host'); // 最初は作成
    const second = quickMatch('b');
    expect(second.role).toBe('guest'); // 2人目は既存へ
    expect(second.roomId).toBe(first.roomId);
    // 次の quickMatch は新規ルーム（前のは満員）
    const third = quickMatch('c');
    expect(third.role).toBe('host');
    expect(third.roomId).not.toBe(first.roomId);
  });

  it('relay: 相手にだけ届く（送信者には届かない）', () => {
    const host = createRoom('a');
    joinRoom(host.roomId!, 'b');
    const got: NetSignal[] = [];
    subscribe(host.roomId!, 'b', (s) => got.push(s));
    relay(host.roomId!, 'a', { kind: 'offer', sdp: 'X', seed: 42 });
    const offer = got.find((s) => s.kind === 'offer');
    expect(offer).toBeTruthy();
    expect(offer!.seed).toBe(42);
    expect(offer!.from).toBe('a');
  });

  it('subscribe 前に来たシグナルはメールボックスで保留され、購読時に配信', () => {
    const host = createRoom('a');
    joinRoom(host.roomId!, 'b');
    relay(host.roomId!, 'a', { kind: 'offer', sdp: 'Y' }); // b 未購読
    const got: NetSignal[] = [];
    subscribe(host.roomId!, 'b', (s) => got.push(s)); // ここで保留分が届く
    expect(got.some((s) => s.kind === 'offer' && s.sdp === 'Y')).toBe(true);
  });

  it('join で host に peer-joined が届く', () => {
    const host = createRoom('a');
    const got: NetSignal[] = [];
    subscribe(host.roomId!, 'a', (s) => got.push(s));
    joinRoom(host.roomId!, 'b');
    expect(got.some((s) => s.kind === 'peer-joined' && s.from === 'b')).toBe(true);
  });

  it('unsubscribe で相手に peer-left が届く', () => {
    const host = createRoom('a');
    joinRoom(host.roomId!, 'b');
    const got: NetSignal[] = [];
    subscribe(host.roomId!, 'a', (s) => got.push(s));
    const unsub = subscribe(host.roomId!, 'b', () => {});
    unsub();
    expect(got.some((s) => s.kind === 'peer-left' && s.from === 'b')).toBe(true);
  });
});
