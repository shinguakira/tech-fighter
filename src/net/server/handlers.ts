// /api/net/* のハンドラ本体（Node http の req/res 非依存の薄いラッパ）。
// Vite dev ミドルウェアと Vercel サーバーレス関数の両方から呼ぶ。
import { createRoom, joinRoom, quickMatch, relay, subscribe, type NetSignal } from './rooms';

export interface JsonReq { body: Record<string, unknown>; query: Record<string, string> }
export interface JsonRes { status: number; json: unknown }

const genId = (): string => 'p_' + Math.random().toString(36).slice(2, 10);

/** POST /api/net/{action} のディスパッチ（events を除く）。 */
export function handleNetPost(action: string, req: JsonReq): JsonRes {
  const playerId = (req.body.playerId as string) || genId();
  if (action === 'create') return { status: 200, json: { ...createRoom(playerId), playerId } };
  if (action === 'join') {
    const roomId = String(req.body.roomId ?? '');
    return { status: 200, json: { ...joinRoom(roomId, playerId), playerId } };
  }
  if (action === 'quick-match') return { status: 200, json: { ...quickMatch(playerId), playerId } };
  if (action === 'signal') {
    const roomId = String(req.body.roomId ?? '');
    const signal = req.body.signal as NetSignal;
    return { status: 200, json: relay(roomId, playerId, signal) };
  }
  return { status: 404, json: { ok: false, error: 'unknown action' } };
}

export interface SseHooks {
  write: (line: string) => void;
  onClose: (fn: () => void) => void;
}

/** GET /api/net/events?roomId=&playerId= の SSE 購読を配線する。 */
export function handleNetEvents(query: Record<string, string>, hooks: SseHooks): void {
  const roomId = query.roomId ?? '';
  const playerId = query.playerId ?? '';
  const send = (s: NetSignal): void => hooks.write(`data: ${JSON.stringify(s)}\n\n`);
  hooks.write(': ok\n\n');
  const unsub = subscribe(roomId, playerId, send);
  const heartbeat = setInterval(() => hooks.write(': ping\n\n'), 10_000);
  hooks.onClose(() => { clearInterval(heartbeat); unsub(); });
}
