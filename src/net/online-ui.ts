// オンライン対戦の配線層（ロビー→接続→対戦の状態機械＋オーバーレイ描画）。
// main.ts のループから駆動する。core・描画本体には手を入れない。
import { W } from '../core/constants';
import type { GameState, PlayerInput, Status } from '../core/types';
import { resetRenderState } from '../render/canvas';
import { connectOnline, type MatchKind, type OnlineHandle } from './online';
import { NetSession } from './session';

const FONT = '"Chakra Petch"';
const INPUT_DELAY = 3; // 固定3フレーム（合意済み）

type Phase = 'closed' | 'lobby' | 'connecting' | 'playing' | 'error';

export class OnlineController {
  private phase: Phase = 'closed';
  private status = '';
  private roomCode = '';
  private handle: OnlineHandle | null = null;
  private session: NetSession | null = null;
  private prevStatus: Status | null = null;
  private lastTick = { advanced: 0, stalled: false };

  isActive(): boolean { return this.phase !== 'closed'; }

  /** タイトルで「オンライン」決定時に呼ぶ。 */
  open(): void {
    this.phase = 'lobby';
    this.status = '';
    this.roomCode = '';
  }

  private teardown(): void {
    this.session?.close();
    this.handle?.close();
    this.session = null;
    this.handle = null;
    this.prevStatus = null;
  }

  /** ロビー/対戦中のキー入力（main の keydown から）。 */
  onKey(code: string): void {
    if (this.phase === 'lobby' || this.phase === 'error') {
      if (code === 'KeyQ') this.begin('quick');
      else if (code === 'KeyR') this.begin('create');
      else if (code === 'KeyF') {
        const c = window.prompt('ルームコードを入力:');
        if (c && c.trim()) this.begin('join', c.trim().toUpperCase());
      } else if (code === 'Escape') { this.phase = 'closed'; }
      return;
    }
    if (this.phase === 'connecting' && code === 'Escape') { this.teardown(); this.phase = 'closed'; return; }
    if (this.phase === 'playing' && code === 'Escape') { this.teardown(); this.phase = 'lobby'; this.status = '対戦を終了しました'; }
  }

  private begin(kind: MatchKind, code?: string): void {
    this.phase = 'connecting';
    this.status = 'マッチング中…';
    connectOnline(kind, code, (s) => { this.status = s; }, (room) => { this.roomCode = room; })
      .then((h) => {
        this.handle = h;
        this.session = new NetSession({ seed: h.seed, localSide: h.localSide, delay: INPUT_DELAY, transport: h.transport });
        this.prevStatus = this.session.game.status;
        resetRenderState();
        this.phase = 'playing';
      })
      .catch((err: unknown) => {
        this.status = 'エラー: ' + (err instanceof Error ? err.message : String(err));
        this.phase = 'error';
        this.teardown();
      });
  }

  /**
   * 1フレーム進める。対戦中は net セッションを駆動し、描画すべき GameState を返す。
   * ロビー/接続中は null（タイトル背景の上にオーバーレイを描く）。
   */
  step(localInput: PlayerInput): GameState | null {
    if (this.phase !== 'playing' || !this.session || !this.handle) return null;
    if (!this.handle.alive()) {
      this.teardown();
      this.phase = 'error';
      this.status = '相手が切断しました';
      return null;
    }
    this.lastTick = this.session.tick(localInput);
    const g = this.session.game;
    if (g.status !== this.prevStatus) {
      if (g.status === 'intro' && (this.prevStatus === 'select' || this.prevStatus === 'matchEnd')) resetRenderState();
      this.prevStatus = g.status;
    }
    return g;
  }

  /** 対戦中に描画すべき GameState（無ければ null）。 */
  get liveGame(): GameState | null {
    return this.phase === 'playing' ? this.session?.game ?? null : null;
  }

  // ---- オーバーレイ描画 ----
  draw(c: CanvasRenderingContext2D): void {
    if (this.phase === 'closed') return;
    c.save();
    c.textAlign = 'center';
    if (this.phase === 'lobby' || this.phase === 'error') this.drawLobby(c);
    else if (this.phase === 'connecting') this.drawConnecting(c);
    else if (this.phase === 'playing') this.drawNetHud(c);
    c.restore();
  }

  private panel(c: CanvasRenderingContext2D): void {
    c.fillStyle = 'rgba(6,10,16,0.82)';
    c.fillRect(0, 0, W, 480);
  }

  private drawLobby(c: CanvasRenderingContext2D): void {
    this.panel(c);
    c.shadowColor = '#40c0e0'; c.shadowBlur = 16;
    c.fillStyle = '#7ef0a8'; c.font = `italic 700 34px ${FONT}`;
    c.fillText('ONLINE 対戦', W / 2, 110);
    c.shadowBlur = 0;
    const rows = [
      ['Q', 'クイックマッチ', '待機中の相手と自動でマッチング'],
      ['R', 'ルームを作成', 'コードを共有して友達と対戦'],
      ['F', 'ルームに参加', 'コードを入力して参加'],
    ];
    for (let i = 0; i < rows.length; i++) {
      const y = 180 + i * 60;
      c.fillStyle = 'rgba(20,34,50,0.9)'; c.fillRect(W / 2 - 200, y - 26, 400, 46);
      c.strokeStyle = '#2a4a5a'; c.lineWidth = 1.4; c.strokeRect(W / 2 - 200, y - 26, 400, 46);
      c.textAlign = 'left';
      c.fillStyle = '#ffd24a'; c.font = `700 20px ${FONT}`;
      c.fillText(`[${rows[i]![0]}]`, W / 2 - 186, y + 2);
      c.fillStyle = '#e8eef5'; c.font = `700 16px ${FONT}`;
      c.fillText(rows[i]![1]!, W / 2 - 140, y - 4);
      c.fillStyle = '#8a9aaa'; c.font = `500 11px ${FONT}`;
      c.fillText(rows[i]![2]!, W / 2 - 140, y + 13);
      c.textAlign = 'center';
    }
    c.fillStyle = this.phase === 'error' ? '#ff8f7a' : '#8a9aaa';
    c.font = `600 13px ${FONT}`;
    c.fillText(this.status || 'Esc でタイトルへ戻る', W / 2, 400);
    c.fillStyle = '#5a6a7a'; c.font = `500 11px ${FONT}`;
    c.fillText('操作は 1P と同じ（WASD＋JKL）／入力ディレイ 3フレーム', W / 2, 424);
  }

  private drawConnecting(c: CanvasRenderingContext2D): void {
    this.panel(c);
    c.fillStyle = '#7adcf0'; c.font = `italic 700 26px ${FONT}`;
    c.fillText('接続中…', W / 2, 210);
    const dots = '.'.repeat(1 + (Math.floor(Date.now() / 300) % 3));
    c.fillStyle = '#c8d4e0'; c.font = `600 15px ${FONT}`;
    c.fillText(this.status + dots, W / 2, 250);
    if (this.roomCode) {
      c.fillStyle = '#ffd24a'; c.font = `700 30px ${FONT}`;
      c.fillText(`ルームコード: ${this.roomCode}`, W / 2, 300);
      c.fillStyle = '#8a9aaa'; c.font = `500 12px ${FONT}`;
      c.fillText('このコードを相手に伝えて「ルームに参加」してもらう', W / 2, 326);
    }
    c.fillStyle = '#5a6a7a'; c.font = `500 11px ${FONT}`;
    c.fillText('Esc で中止', W / 2, 400);
  }

  private drawNetHud(c: CanvasRenderingContext2D): void {
    const side = this.handle?.localSide === 0 ? '1P (左)' : '2P (右)';
    c.textAlign = 'center';
    c.fillStyle = this.lastTick.stalled ? '#ff8f5f' : '#7ef0a8';
    c.font = `700 11px ${FONT}`;
    c.fillText(`● ONLINE  ルーム ${this.roomCode || this.handle?.roomId || ''}  あなた=${side}${this.lastTick.stalled ? '  (通信待ち)' : ''}`, W / 2, 128);
    c.fillStyle = '#5a6a7a'; c.font = `500 10px ${FONT}`;
    c.fillText('Esc で退出', W / 2, 142);
  }
}
