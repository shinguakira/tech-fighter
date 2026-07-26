import { beforeEach, describe, expect, it } from 'vitest';
import { _setClient, createRoom, dispatch, joinRoom, poll, quickMatch, relay } from '../api/net';
import type { RedisLike } from '../api/net';

/** Upstash Redis の最小部分集合を in-memory で再現するフェイク（テスト専用）。 */
function fakeRedis(): RedisLike {
  const store = new Map<string, unknown>();
  const lists = new Map<string, unknown[]>();
  const sets = new Map<string, Set<string>>();
  return {
    async get<T>(key: string) { return (store.has(key) ? (store.get(key) as T) : null); },
    async set(key, value) { store.set(key, value); return 'OK'; },
    async exists(...keys: string[]) { return keys.filter((k) => store.has(k) || lists.has(k) || sets.has(k)).length; },
    async del(...keys: string[]) {
      let n = 0;
      for (const k of keys) {
        if (store.delete(k)) n++;
        if (lists.delete(k)) n++;
        if (sets.delete(k)) n++;
      }
      return n;
    },
    async expire() { return 1; },
    async rpush(key, ...values: unknown[]) {
      const l = lists.get(key) ?? [];
      l.push(...values);
      lists.set(key, l);
      return l.length;
    },
    async lrange<T>(key: string, start: number, stop: number) {
      const l = (lists.get(key) ?? []) as T[];
      const end = stop < 0 ? l.length + stop + 1 : stop + 1;
      return l.slice(start, end);
    },
    async sadd(key, ...members: string[]) {
      const s = sets.get(key) ?? new Set<string>();
      let n = 0;
      for (const m of members) if (!s.has(m)) { s.add(m); n++; }
      sets.set(key, s);
      return n;
    },
    async srem(key, ...members: string[]) {
      const s = sets.get(key);
      if (!s) return 0;
      let n = 0;
      for (const m of members) if (s.delete(m)) n++;
      return n;
    },
    async spop<T>(key: string) {
      const s = sets.get(key);
      if (!s || s.size === 0) return null;
      const [first] = s;
      s.delete(first!);
      return first as unknown as T;
    },
    async keys(pattern: string) {
      const prefix = pattern.replace(/\*$/, '');
      return [...store.keys(), ...lists.keys(), ...sets.keys()].filter((k) => k.startsWith(prefix));
    },
  };
}

describe('マッチング/シグナリング（単一エンドポイント・ポーリング・Redis バックエンド）', () => {
  beforeEach(() => { _setClient(fakeRedis()); });

  it('createRoom: host が作成され、コードが返る', async () => {
    const r = await createRoom('a');
    expect(r.ok).toBe(true);
    expect(r.role).toBe('host');
    expect(r.roomId).toMatch(/^[A-Z0-9]{4}$/);
  });

  it('joinRoom: guest 参加で2人に。満員は弾く', async () => {
    const host = await createRoom('a');
    const g = await joinRoom(host.roomId!, 'b');
    expect(g.ok).toBe(true);
    expect(g.role).toBe('guest');
    expect((await joinRoom(host.roomId!, 'c')).ok).toBe(false);
  });

  it('存在しないコードは参加失敗', async () => {
    expect((await joinRoom('ZZZZ', 'x')).ok).toBe(false);
  });

  it('quickMatch: 待機があれば参加、無ければ作成', async () => {
    const first = await quickMatch('a');
    expect(first.role).toBe('host');
    const second = await quickMatch('b');
    expect(second.role).toBe('guest');
    expect(second.roomId).toBe(first.roomId);
    const third = await quickMatch('c');
    expect(third.role).toBe('host');
    expect(third.roomId).not.toBe(first.roomId);
  });

  it('join で host に peer-joined が poll で届く', async () => {
    const host = await createRoom('a');
    await joinRoom(host.roomId!, 'b');
    const got = await poll(host.roomId!, 'a');
    expect(got.signals!.some((s) => s.kind === 'peer-joined' && s.from === 'b')).toBe(true);
  });

  it('relay: 相手にだけ届き、poll で取り出すと空になる', async () => {
    const host = await createRoom('a');
    await joinRoom(host.roomId!, 'b');
    await poll(host.roomId!, 'a'); // peer-joined を消化
    await relay(host.roomId!, 'a', { kind: 'offer', sdp: 'X', seed: 42 });
    const first = await poll(host.roomId!, 'b');
    const offer = first.signals!.find((s) => s.kind === 'offer');
    expect(offer).toBeTruthy();
    expect(offer!.seed).toBe(42);
    expect(offer!.from).toBe('a');
    // 送信者には届かない
    expect((await poll(host.roomId!, 'a')).signals!.length).toBe(0);
    // 2回目の poll は空（ドレイン済み）
    expect((await poll(host.roomId!, 'b')).signals!.length).toBe(0);
  });

  it('dispatch: action で正しく分岐する', async () => {
    const c = await dispatch({ action: 'create', playerId: 'a' });
    expect(c.role).toBe('host');
    const j = await dispatch({ action: 'join', roomId: c.roomId, playerId: 'b' });
    expect(j.role).toBe('guest');
    await dispatch({ action: 'signal', roomId: c.roomId, playerId: 'b', signal: { kind: 'ready' } });
    const p = await dispatch({ action: 'poll', roomId: c.roomId, playerId: 'a' });
    expect(p.signals!.some((s) => s.kind === 'ready')).toBe(true);
    expect((await dispatch({ action: 'bogus' })).ok).toBe(false);
  });
});
