// マッチング＆WebRTCシグナリングの単一エンドポイント（Vercel サーバーレス関数）。
//
// 設計方針（Vercel 制約下での最大安定化）:
//  - 全操作を **1関数** に統合（create/join/quick-match/signal/poll）。
//    → 別関数だとメモリを共有できないので、1関数にしてインスタンス内で共有。
//  - SSE をやめて **ポーリング**（サーバーレスと相性が良く、接続を掴みっぱなしにしない）。
//  - **生の Node req/res** のみ使用（res.status()/res.json() 等の拡張に依存しない＝落ちない）。
//  - このファイルは **自己完結**（src への import 無し）＝バンドルの取りこぼしで落ちない。
//
// 既知の限界: Vercel は状態を持てないため、稀に別インスタンスに載るとルームが噛み合わない。
// 低トラフィック（2人・数秒のシグナリング窓）なら実用上ほぼ同一インスタンスで動く。
// 100%の確実性が要るなら共有ストア（KV等）が必要。

export interface Signal {
  kind: 'offer' | 'answer' | 'ice' | 'hello' | 'peer-joined' | 'peer-left' | 'ready';
  from?: string;
  sdp?: string;
  candidate?: unknown;
  seed?: number;
  [k: string]: unknown;
}
interface Room { id: string; players: string[]; mailbox: Record<string, Signal[]>; createdAt: number }

const ROOMS: Record<string, Room> = {};
const ROOM_TTL = 10 * 60 * 1000;
const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genCode(): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += CODE[Math.floor(Math.random() * CODE.length)];
  return s;
}
function sweep(): void {
  const now = Date.now();
  for (const id of Object.keys(ROOMS)) if (now - ROOMS[id]!.createdAt > ROOM_TTL) delete ROOMS[id];
}
function other(room: Room, me: string): string | undefined { return room.players.find((p) => p !== me); }
function deliver(room: Room, to: string, s: Signal): void {
  (room.mailbox[to] ??= []).push(s);
}

export interface NetResult { ok: boolean; roomId?: string; role?: 'host' | 'guest'; playerId?: string; error?: string; signals?: Signal[] }

export function createRoom(playerId: string): NetResult {
  sweep();
  let id = genCode();
  while (ROOMS[id]) id = genCode();
  ROOMS[id] = { id, players: [playerId], mailbox: {}, createdAt: Date.now() };
  return { ok: true, roomId: id, role: 'host', playerId };
}
export function joinRoom(roomId: string, playerId: string): NetResult {
  sweep();
  const room = ROOMS[roomId.toUpperCase()];
  if (!room) return { ok: false, error: 'ルームが見つかりません' };
  if (!room.players.includes(playerId)) {
    if (room.players.length >= 2) return { ok: false, error: 'ルームが満員です' };
    room.players.push(playerId);
    deliver(room, room.players[0]!, { kind: 'peer-joined', from: playerId });
  }
  return { ok: true, roomId: room.id, role: room.players[0] === playerId ? 'host' : 'guest', playerId };
}
export function quickMatch(playerId: string): NetResult {
  sweep();
  for (const id of Object.keys(ROOMS)) {
    const r = ROOMS[id]!;
    if (r.players.length === 1 && !r.players.includes(playerId)) return joinRoom(id, playerId);
  }
  return createRoom(playerId);
}
export function relay(roomId: string, from: string, signal: Signal): NetResult {
  const room = ROOMS[roomId.toUpperCase()];
  if (!room) return { ok: false, error: 'ルームが見つかりません' };
  const to = other(room, from);
  if (to) deliver(room, to, { ...signal, from });
  return { ok: true };
}
/** 保留中のシグナルを取り出して空にする（ポーリング）。 */
export function poll(roomId: string, playerId: string): NetResult {
  const room = ROOMS[roomId.toUpperCase()];
  if (!room) return { ok: false, error: 'ルームが見つかりません', signals: [] };
  const box = room.mailbox[playerId] ?? [];
  room.mailbox[playerId] = [];
  return { ok: true, signals: box };
}

const genId = (): string => 'p_' + Math.random().toString(36).slice(2, 10);

/** action ディスパッチ（純粋）。 */
export function dispatch(body: Record<string, unknown>): NetResult {
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
    const out = dispatch(body);
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
export function _reset(): void { for (const k of Object.keys(ROOMS)) delete ROOMS[k]; }
