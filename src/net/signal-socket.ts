// シグナリングのクライアント（Socket.IO・常駐サーバー版）。
// video-call と同じく WebSocket で確実にマッチング＆シグナル中継する。
// 接続先: VITE_SIGNALING_URL（別ホスト運用時）or 同一オリジン（サーバー一体運用）。
import { io, type Socket } from 'socket.io-client';

export type Role = 'host' | 'guest';
export interface MatchResult { ok: boolean; roomId?: string; role?: Role; error?: string }

const URL = (import.meta.env.VITE_SIGNALING_URL as string | undefined) || undefined;

export class SignalSocket {
  private socket: Socket;
  roomId = '';
  role: Role = 'host';

  constructor() {
    // URL 未指定なら同一オリジンへ接続（サーバー一体運用）。
    this.socket = URL ? io(URL, { transports: ['websocket'] }) : io({ transports: ['websocket'] });
  }

  get connected(): boolean { return this.socket.connected; }

  /** マッチング。ack で {ok, roomId, role} が返る。 */
  matchmake(mode: 'create' | 'join' | 'quick', code?: string): Promise<MatchResult> {
    return new Promise((resolve) => {
      const done = (r: MatchResult): void => {
        if (r.ok && r.roomId) { this.roomId = r.roomId; if (r.role) this.role = r.role; }
        resolve(r);
      };
      // 接続待ち（接続済みなら即送信）
      if (this.socket.connected) this.socket.emit('matchmake', { mode, code }, done);
      else this.socket.once('connect', () => this.socket.emit('matchmake', { mode, code }, done));
      // タイムアウト（サーバー未到達）
      setTimeout(() => resolve({ ok: false, error: 'シグナリングサーバーに接続できません' }), 8000);
    });
  }

  /** 相手が入室（host が offer を作る合図）。 */
  onPeerJoined(cb: () => void): void { this.socket.on('peer-joined', cb); }
  /** シグナル受信。 */
  onSignal(cb: (signal: unknown) => void): void { this.socket.on('signal', (p: { signal: unknown }) => cb(p.signal)); }
  /** 相手が退室/切断。 */
  onPeerLeft(cb: () => void): void { this.socket.on('peer-left', cb); }

  /** シグナルを相手へ送る。 */
  send(signal: unknown): void { this.socket.emit('signal', { signal }); }

  close(): void { try { this.socket.emit('leave'); } catch { /* noop */ } this.socket.disconnect(); }
}
