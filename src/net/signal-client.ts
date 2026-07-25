// シグナリングのクライアント。単一エンドポイント /api/net を POST で叩き、
// SSE の代わりに **ポーリング** でシグナルを受け取る（サーバーレスと相性が良い）。
import type { Signal } from '../../api/net';

export interface MatchResult { ok: boolean; roomId?: string; role?: 'host' | 'guest'; playerId?: string; error?: string }

export class SignalClient {
  private roomId = '';
  private playerId = '';
  private timer: ReturnType<typeof setInterval> | null = null;

  get room(): string { return this.roomId; }
  get me(): string { return this.playerId; }

  private async post(body: Record<string, unknown>): Promise<any> {
    const r = await fetch('/api/net', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // 500 等で HTML/テキストが返っても JSON.parse で落ちないようにする
    const text = await r.text();
    try { return JSON.parse(text); }
    catch { return { ok: false, error: `サーバー応答が不正です (${r.status})` }; }
  }

  async create(): Promise<MatchResult> {
    const r = await this.post({ action: 'create' });
    if (r.ok && r.roomId) { this.roomId = r.roomId; this.playerId = r.playerId ?? ''; }
    return r;
  }
  async join(code: string): Promise<MatchResult> {
    const r = await this.post({ action: 'join', roomId: code });
    if (r.ok && r.roomId) { this.roomId = r.roomId; this.playerId = r.playerId ?? ''; }
    return r;
  }
  async quickMatch(): Promise<MatchResult> {
    const r = await this.post({ action: 'quick-match' });
    if (r.ok && r.roomId) { this.roomId = r.roomId; this.playerId = r.playerId ?? ''; }
    return r;
  }

  /** ポーリング開始。届いたシグナルを onSignal に流す。 */
  listen(onSignal: (s: Signal) => void, intervalMs = 350): void {
    if (this.timer) return;
    const tick = async (): Promise<void> => {
      const r = await this.post({ action: 'poll', roomId: this.roomId, playerId: this.playerId });
      if (r.ok && Array.isArray(r.signals)) for (const s of r.signals) onSignal(s);
    };
    void tick();
    this.timer = setInterval(() => { void tick(); }, intervalMs);
  }

  /** シグナルを相手へ送る。 */
  send(signal: Signal): void {
    void this.post({ action: 'signal', roomId: this.roomId, playerId: this.playerId, signal });
  }

  close(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }
}
