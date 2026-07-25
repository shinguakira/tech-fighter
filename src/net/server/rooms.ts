// マッチング＆シグナリングのサーバーコア（フレームワーク非依存・in-memory）。
// Vite dev ミドルウェアと Vercel サーバーレス関数の両方から使う。
//
// 役割は「2人のプレイヤーをルームに集め、WebRTC の接続情報(SDP/ICE)を
// 相手へ中継する」だけ。ゲーム本体は接続後 P2P で進むのでここは低頻度。
//
// 注意（Vercel）: サーバーレスはインスタンス毎にこのメモリが別になり得る。
// SSE と POST が同一インスタンスに載れば動作（dev/単一ノードでは常に一致）。
// 恒久運用で不安定なら Vercel KV 等に置き換え可能（本ファイルの Rooms を差替）。

/** クライアント間で中継するシグナル（server は中身をほぼ透過中継）。 */
export interface NetSignal {
  kind: 'offer' | 'answer' | 'ice' | 'hello' | 'peer-joined' | 'peer-left' | 'ready';
  from?: string;
  sdp?: string;
  candidate?: unknown;
  seed?: number;
  [k: string]: unknown;
}

interface Room {
  id: string;
  players: string[]; // 最大2。index0=host(offerer) / index1=guest(answerer)
  createdAt: number;
  mailbox: Map<string, NetSignal[]>;          // 未接続プレイヤー宛の保留
  listeners: Map<string, (s: NetSignal) => void>; // SSE 接続中の配信先
}

const ROOMS = new Map<string, Room>();
const ROOM_TTL = 10 * 60 * 1000; // 10分で無効化
const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字を除外

function genCode(len = 4): string {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE[Math.floor(Math.random() * CODE.length)];
  return s;
}

function sweep(): void {
  const now = Date.now();
  for (const [id, r] of ROOMS) if (now - r.createdAt > ROOM_TTL) ROOMS.delete(id);
}

function mkRoom(hostId: string): Room {
  sweep();
  let id = genCode();
  while (ROOMS.has(id)) id = genCode();
  const room: Room = { id, players: [hostId], createdAt: Date.now(), mailbox: new Map(), listeners: new Map() };
  ROOMS.set(id, room);
  return room;
}

/** 相手プレイヤーへ配信（接続中なら即時、未接続ならメールボックスへ保留）。 */
function deliver(room: Room, toPlayer: string, s: NetSignal): void {
  const cb = room.listeners.get(toPlayer);
  if (cb) cb(s);
  else {
    const box = room.mailbox.get(toPlayer) ?? [];
    box.push(s);
    room.mailbox.set(toPlayer, box);
  }
}

function otherPlayer(room: Room, me: string): string | undefined {
  return room.players.find((p) => p !== me);
}

// ---- 公開 API ----

export interface JoinResult { ok: boolean; roomId?: string; role?: 'host' | 'guest'; error?: string; peerPresent?: boolean }

/** ルーム作成（host になる）。 */
export function createRoom(playerId: string): JoinResult {
  const room = mkRoom(playerId);
  return { ok: true, roomId: room.id, role: 'host', peerPresent: false };
}

/** コード指定で参加（guest になる）。 */
export function joinRoom(roomId: string, playerId: string): JoinResult {
  sweep();
  const room = ROOMS.get(roomId.toUpperCase());
  if (!room) return { ok: false, error: 'ルームが見つかりません' };
  if (room.players.includes(playerId)) return { ok: true, roomId: room.id, role: room.players[0] === playerId ? 'host' : 'guest', peerPresent: room.players.length === 2 };
  if (room.players.length >= 2) return { ok: false, error: 'ルームが満員です' };
  room.players.push(playerId);
  // host へ peer-joined 通知
  const host = room.players[0]!;
  deliver(room, host, { kind: 'peer-joined', from: playerId });
  return { ok: true, roomId: room.id, role: 'guest', peerPresent: true };
}

/** クイックマッチ: 待機中ルームがあれば参加、無ければ作成。 */
export function quickMatch(playerId: string): JoinResult {
  sweep();
  for (const room of ROOMS.values()) {
    if (room.players.length === 1 && !room.players.includes(playerId)) {
      return joinRoom(room.id, playerId);
    }
  }
  return createRoom(playerId);
}

/** シグナル(offer/answer/ice/hello/ready)を相手へ中継。 */
export function relay(roomId: string, fromPlayer: string, signal: NetSignal): { ok: boolean; error?: string } {
  const room = ROOMS.get(roomId.toUpperCase());
  if (!room) return { ok: false, error: 'ルームが見つかりません' };
  const to = otherPlayer(room, fromPlayer);
  if (!to) return { ok: true }; // 相手未参加なら黙って捨てる（後で peer-joined 後に再送）
  deliver(room, to, { ...signal, from: fromPlayer });
  return { ok: true };
}

/** SSE 購読。保留メールボックスを吐き出し、以後の配信を cb に流す。unsubscribe を返す。 */
export function subscribe(roomId: string, playerId: string, cb: (s: NetSignal) => void): () => void {
  const room = ROOMS.get(roomId.toUpperCase());
  if (!room) { cb({ kind: 'peer-left', from: 'server', error: 'ルームが見つかりません' } as NetSignal); return () => {}; }
  room.listeners.set(playerId, cb);
  // 保留メールボックスを配信（join 時の peer-joined 等はここで届く。
  // 別途 synthetic な peer-joined は送らない＝host が二重にオファーしないため）
  const box = room.mailbox.get(playerId);
  if (box) { for (const s of box) cb(s); room.mailbox.delete(playerId); }
  return () => {
    if (room.listeners.get(playerId) === cb) room.listeners.delete(playerId);
    const peer = otherPlayer(room, playerId);
    if (peer) deliver(room, peer, { kind: 'peer-left', from: playerId });
  };
}

/** テスト・デバッグ用: ルーム数。 */
export function roomCount(): number { return ROOMS.size; }
/** テスト用: 全消去。 */
export function _resetRooms(): void { ROOMS.clear(); }
