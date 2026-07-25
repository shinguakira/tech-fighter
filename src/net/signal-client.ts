// シグナリングのクライアント。/api/net/* を叩いてマッチング＆シグナル中継。
import type { NetSignal } from './server/rooms';

export interface MatchResult { ok: boolean; roomId?: string; role?: 'host' | 'guest'; playerId?: string; error?: string }

export class SignalClient {
  private roomId = '';
  private playerId = '';
  private es: EventSource | null = null;

  get room(): string { return this.roomId; }
  get me(): string { return this.playerId; }

  private async post(action: string, body: Record<string, unknown>): Promise<MatchResult> {
    const r = await fetch(`/api/net/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return r.json() as Promise<MatchResult>;
  }

  async create(): Promise<MatchResult> {
    const r = await this.post('create', {});
    if (r.ok && r.roomId) { this.roomId = r.roomId; this.playerId = r.playerId ?? ''; }
    return r;
  }
  async join(code: string): Promise<MatchResult> {
    const r = await this.post('join', { roomId: code });
    if (r.ok && r.roomId) { this.roomId = r.roomId; this.playerId = r.playerId ?? ''; }
    return r;
  }
  async quickMatch(): Promise<MatchResult> {
    const r = await this.post('quick-match', {});
    if (r.ok && r.roomId) { this.roomId = r.roomId; this.playerId = r.playerId ?? ''; }
    return r;
  }

  /** SSE を開いてシグナルを受け取る。 */
  listen(onSignal: (s: NetSignal) => void): void {
    this.es = new EventSource(`/api/net/events?roomId=${encodeURIComponent(this.roomId)}&playerId=${encodeURIComponent(this.playerId)}`);
    this.es.onmessage = (e) => {
      try { onSignal(JSON.parse(e.data) as NetSignal); } catch { /* ignore */ }
    };
  }

  /** シグナルを相手へ送る。 */
  send(signal: NetSignal): void {
    void fetch('/api/net/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: this.roomId, playerId: this.playerId, signal }),
    });
  }

  close(): void { this.es?.close(); this.es = null; }
}
