// マッチング＆WebRTCシグナリングの単一エンドポイント（Vercel サーバーレス関数）。
//
// 設計方針:
//  - 全操作を **1関数** に統合（create/join/quick-match/signal/poll）。
//  - SSE をやめて **ポーリング**（サーバーレスと相性が良く、接続を掴みっぱなしにしない）。
//  - **状態は Upstash Redis（Vercel の Storage 統合）に保持**。関数インスタンスが
//    どれに載っても同じデータを見られるので、in-memory 版の「別インスタンスに
//    載ると噛み合わない」問題が原理的に起きない。
//  - **生の Node req/res** のみ使用（res.status()/res.json() 等の拡張に依存しない＝落ちない）。
//
// 必要な環境変数（Vercel の Storage タブで Redis/Upstash を接続すると自動注入される）:
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
//   （Vercel KV 由来の KV_REST_API_URL / KV_REST_API_TOKEN でも可 — fromEnv が両対応）
// ローカル dev では `vercel env pull .env.local` で同じ値を取得する。

import { Redis } from '@upstash/redis';

export interface Signal {
  kind: 'offer' | 'answer' | 'ice' | 'hello' | 'peer-joined' | 'peer-left' | 'ready';
  from?: string;
  sdp?: string;
  candidate?: unknown;
  seed?: number;
  [k: string]: unknown;
}
interface RoomRec { id: string; players: string[]; createdAt: number }

export interface NetResult { ok: boolean; roomId?: string; role?: 'host' | 'guest'; playerId?: string; error?: string; signals?: Signal[] }

const ROOM_TTL_SEC = 10 * 60;
const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const WAITING = 'net:waiting';
const roomKey = (id: string): string => `net:room:${id}`;
const mboxKey = (roomId: string, playerId: string): string => `net:mbox:${roomId}:${playerId}`;

/** dispatch が使う Redis 操作の最小部分集合（テストでは in-memory 実装に差し替える）。 */
export interface RedisLike {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, opts?: { ex?: number }): Promise<unknown>;
  exists(...keys: string[]): Promise<number>;
  del(...keys: string[]): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  rpush(key: string, ...values: unknown[]): Promise<number>;
  lrange<T>(key: string, start: number, stop: number): Promise<T[]>;
  sadd(key: string, ...members: string[]): Promise<number>;
  srem(key: string, ...members: string[]): Promise<number>;
  spop<T>(key: string): Promise<T | null>;
  keys(pattern: string): Promise<string[]>;
}

let redis: RedisLike | null = null;
function db(): RedisLike {
  if (!redis) redis = Redis.fromEnv() as unknown as RedisLike;
  return redis;
}
/** テスト用: Redis 実装を差し替える（in-memory フェイク等）。 */
export function _setClient(client: RedisLike | null): void { redis = client; }

function genCode(): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE[Math.floor(Math.random() * CODE.length)];
  return s;
}
function other(room: RoomRec, me: string): string | undefined { return room.players.find((p) => p !== me); }

async function getRoom(id: string): Promise<RoomRec | null> {
  return await db().get<RoomRec>(roomKey(id));
}
async function saveRoom(room: RoomRec): Promise<void> {
  await db().set(roomKey(room.id), room, { ex: ROOM_TTL_SEC });
}
async function deliver(roomId: string, to: string, s: Signal): Promise<void> {
  const key = mboxKey(roomId, to);
  await db().rpush(key, s);
  await db().expire(key, ROOM_TTL_SEC);
}

export async function createRoom(playerId: string): Promise<NetResult> {
  let id = genCode();
  for (let i = 0; i < 5 && (await db().exists(roomKey(id))); i++) id = genCode();
  await saveRoom({ id, players: [playerId], createdAt: Date.now() });
  return { ok: true, roomId: id, role: 'host', playerId };
}

export async function joinRoom(roomIdRaw: string, playerId: string): Promise<NetResult> {
  const roomId = roomIdRaw.toUpperCase();
  const room = await getRoom(roomId);
  if (!room) return { ok: false, error: 'ルームが見つかりません' };
  if (!room.players.includes(playerId)) {
    if (room.players.length >= 2) return { ok: false, error: 'ルームが満員です' };
    room.players.push(playerId);
    await saveRoom(room);
    await db().srem(WAITING, roomId);
    await deliver(roomId, room.players[0]!, { kind: 'peer-joined', from: playerId });
  }
  return { ok: true, roomId: room.id, role: room.players[0] === playerId ? 'host' : 'guest', playerId };
}

export async function quickMatch(playerId: string): Promise<NetResult> {
  // waiting set から原子的に1件取り出す（spop）。同時アクセスでも同じルームを
  // 2人が同時に取ることはない。
  for (let i = 0; i < 5; i++) {
    const id = await db().spop<string>(WAITING);
    if (!id) break;
    const room = await getRoom(id);
    if (room && room.players.length === 1 && !room.players.includes(playerId)) {
      return joinRoom(id, playerId);
    }
    // 期限切れ/無効な waiting エントリはスキップして次を試す。
  }
  const created = await createRoom(playerId);
  if (created.ok && created.roomId) await db().sadd(WAITING, created.roomId);
  return created;
}

export async function relay(roomIdRaw: string, from: string, signal: Signal): Promise<NetResult> {
  const roomId = roomIdRaw.toUpperCase();
  const room = await getRoom(roomId);
  if (!room) return { ok: false, error: 'ルームが見つかりません' };
  const to = other(room, from);
  if (to) await deliver(roomId, to, { ...signal, from });
  return { ok: true };
}

/** 保留中のシグナルを取り出して空にする（ポーリング）。 */
export async function poll(roomIdRaw: string, playerId: string): Promise<NetResult> {
  const roomId = roomIdRaw.toUpperCase();
  const key = mboxKey(roomId, playerId);
  const signals = await db().lrange<Signal>(key, 0, -1);
  if (signals.length) await db().del(key);
  return { ok: true, signals };
}

const genId = (): string => 'p_' + Math.random().toString(36).slice(2, 10);

/** action ディスパッチ（Redis I/O を含む）。 */
export async function dispatch(body: Record<string, unknown>): Promise<NetResult> {
  const action = String(body.action ?? '');
  const playerId = (body.playerId as string) || genId();
  switch (action) {
    case 'create': return createRoom(playerId);
    case 'join': return joinRoom(String(body.roomId ?? ''), playerId);
    case 'quick-match': return quickMatch(playerId);
    case 'signal': return relay(String(body.roomId ?? ''), playerId, body.signal as Signal);
    case 'poll': return poll(String(body.roomId ?? ''), playerId);
    default: return { ok: false, error: 'unknown action' };
  }
}

// ---- 生の Node req/res ハンドラ（Vercel でも Vite dev でも同一コードで動く） ----

function readBody(req: any): Promise<Record<string, unknown>> {
  // Vercel が既に body を parse 済みならそれを使う（stream は消費済みのことがある）
  if (req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  if (typeof req.body === 'string' && req.body) {
    try { return Promise.resolve(JSON.parse(req.body)); } catch { return Promise.resolve({}); }
  }
  return new Promise((resolve) => {
    let d = '';
    req.on('data', (c: unknown) => { d += c; });
    req.on('end', () => { try { resolve(d ? JSON.parse(d) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req: any, res: any): Promise<void> {
  try {
    const body = req.method === 'POST' ? await readBody(req) : {};
    const out = await dispatch(body);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(out));
  } catch (e) {
    // どんな失敗でも必ず JSON を返す（クライアントが JSON.parse で落ちないように）
    try {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: false, error: 'server: ' + (e instanceof Error ? e.message : String(e)) }));
    } catch { /* noop */ }
  }
}

/** テスト用: 全ルーム消去。 */
export async function _reset(): Promise<void> {
  const keys = await db().keys('net:*');
  if (keys.length) await db().del(...keys);
}
