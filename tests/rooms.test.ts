import { beforeEach, describe, expect, it } from 'vitest';
import { _reset, createRoom, dispatch, joinRoom, poll, quickMatch, relay } from '../api/net';

describe('マッチング/シグナリング（単一エンドポイント・ポーリング）', () => {
  beforeEach(() => _reset());

  it('createRoom: host が作成され、コードが返る', () => {
    const r = createRoom('a');
    expect(r.ok).toBe(true);
    expect(r.role).toBe('host');
    expect(r.roomId).toMatch(/^[A-Z0-9]{4}$/);
  });

  it('joinRoom: guest 参加で2人に。満員は弾く', () => {
    const host = createRoom('a');
    const g = joinRoom(host.roomId!, 'b');
    expect(g.ok).toBe(true);
    expect(g.role).toBe('guest');
    expect(joinRoom(host.roomId!, 'c').ok).toBe(false);
  });

  it('存在しないコードは参加失敗', () => {
    expect(joinRoom('ZZZZ', 'x').ok).toBe(false);
  });

  it('quickMatch: 待機があれば参加、無ければ作成', () => {
    const first = quickMatch('a');
    expect(first.role).toBe('host');
    const second = quickMatch('b');
    expect(second.role).toBe('guest');
    expect(second.roomId).toBe(first.roomId);
    const third = quickMatch('c');
    expect(third.role).toBe('host');
    expect(third.roomId).not.toBe(first.roomId);
  });

  it('join で host に peer-joined が poll で届く', () => {
    const host = createRoom('a');
    joinRoom(host.roomId!, 'b');
    const got = poll(host.roomId!, 'a');
    expect(got.signals!.some((s) => s.kind === 'peer-joined' && s.from === 'b')).toBe(true);
  });

  it('relay: 相手にだけ届き、poll で取り出すと空になる', () => {
    const host = createRoom('a');
    joinRoom(host.roomId!, 'b');
    poll(host.roomId!, 'a'); // peer-joined を消化
    relay(host.roomId!, 'a', { kind: 'offer', sdp: 'X', seed: 42 });
    const first = poll(host.roomId!, 'b');
    const offer = first.signals!.find((s) => s.kind === 'offer');
    expect(offer).toBeTruthy();
    expect(offer!.seed).toBe(42);
    expect(offer!.from).toBe('a');
    // 送信者には届かない
    expect(poll(host.roomId!, 'a').signals!.length).toBe(0);
    // 2回目の poll は空（ドレイン済み）
    expect(poll(host.roomId!, 'b').signals!.length).toBe(0);
  });

  it('dispatch: action で正しく分岐する', () => {
    const c = dispatch({ action: 'create', playerId: 'a' });
    expect(c.role).toBe('host');
    const j = dispatch({ action: 'join', roomId: c.roomId, playerId: 'b' });
    expect(j.role).toBe('guest');
    dispatch({ action: 'signal', roomId: c.roomId, playerId: 'b', signal: { kind: 'ready' } });
    const p = dispatch({ action: 'poll', roomId: c.roomId, playerId: 'a' });
    expect(p.signals!.some((s) => s.kind === 'ready')).toBe(true);
    expect(dispatch({ action: 'bogus' }).ok).toBe(false);
  });
});
