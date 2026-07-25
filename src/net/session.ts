// 決定論ロックステップのネット対戦セッション（トランスポート非依存）。
//
// 前提: core の step() は決定論。両クライアントが「各フレームの p1/p2 入力」を
// 完全一致で組み立てられれば、GameState は常に一致する（画面も一致）。
//
// 仕組み（ディレイ式ロックステップ）:
//  - 入力ディレイ D フレーム。自分の入力は「D フレーム先」にスケジュールして送る。
//  - フレーム 0..D-1 は両者ニュートラル固定（試合開始直後の一瞬。intro とも重なる）。
//  - 各 tick で自分の入力を1つ送り、両者の入力が揃ったフレームだけ step() を進める。
//  - 相手入力が未着ならそのフレームで待つ（stall）。RTT < D フレームなら基本 stall しない。
import { CHAR_LIST } from '../core/constants';
import { createGame, startVsMatch, step } from '../core/game';
import type { CharId, GameInput, GameState, PlayerInput, Side } from '../core/types';
import type { NetMsg, Transport } from './transport';

export const neutralInput = (): PlayerInput => ({
  left: false, right: false, up: false, down: false, light: false, heavy: false, special: false,
});

export interface NetConfig {
  seed: number;
  /**
   * side0 / side1 のキャラを指定すると即対戦開始（intro→play）。
   * 省略するとキャラ選択画面から開始し、両者の入力で選択を同期する（オンライン標準）。
   */
  chars?: [CharId, CharId];
  /** 自分が操作する側。 */
  localSide: Side;
  /** 入力ディレイ（フレーム。1以上）。 */
  delay: number;
  transport: Transport;
}

export interface TickResult {
  advanced: number;
  stalled: boolean;
}

export class NetSession {
  readonly game: GameState;
  readonly localSide: Side;
  private readonly delay: number;
  private readonly tx: Transport;
  /** 次に step するフレーム。 */
  private frame = 0;
  /** 次に自分の入力を割り当てるフレーム。 */
  private inputFrame: number;
  private readonly local: (PlayerInput | undefined)[] = [];
  private readonly remote: (PlayerInput | undefined)[] = [];
  /** 相手入力待ちで進めなかった回数（計測用）。 */
  stalls = 0;
  /** 1 tick で進める最大フレーム数（stall 復帰時の一気進みを抑える）。 */
  private readonly maxCatchUp = 10;

  constructor(cfg: NetConfig) {
    this.game = createGame(cfg.seed);
    if (cfg.chars) {
      startVsMatch(this.game, cfg.chars[0], cfg.chars[1]);
    } else {
      // キャラ選択から同期開始（両者が自分の側のカーソルを操作）
      this.game.mode = 'vs';
      this.game.status = 'select';
      this.game.sel = [0, Math.min(1, CHAR_LIST.length - 1)];
      this.game.selDone = [false, false];
    }
    this.localSide = cfg.localSide;
    this.delay = Math.max(1, cfg.delay);
    this.tx = cfg.transport;
    // 開始 D フレームは両者ニュートラル固定（合意済みなので送らない）
    for (let f = 0; f < this.delay; f++) { this.local[f] = neutralInput(); this.remote[f] = neutralInput(); }
    this.inputFrame = this.delay;
    this.tx.onMessage((m) => this.onMsg(m));
  }

  private onMsg(m: NetMsg): void {
    if (m.t === 'in') this.remote[m.f] = m.p;
  }

  private buildInput(f: number): GameInput {
    const l = this.local[f]!;
    const r = this.remote[f]!;
    const p1 = this.localSide === 0 ? l : r;
    const p2 = this.localSide === 0 ? r : l;
    return { p1, p2, start: false };
  }

  /** 60fps で毎フレーム1回呼ぶ。自分の入力を送り、揃った分だけ step。 */
  tick(input: PlayerInput): TickResult {
    // 自分の入力を D フレーム先へスケジュールして送信
    this.local[this.inputFrame] = input;
    this.tx.send({ t: 'in', f: this.inputFrame, p: input });
    this.inputFrame++;

    let advanced = 0;
    while (advanced < this.maxCatchUp && this.local[this.frame] && this.remote[this.frame]) {
      step(this.game, this.buildInput(this.frame));
      this.frame++;
      advanced++;
    }
    // 進めるべきフレーム（既に入力送信済みの範囲）があるのに1歩も進めなかった＝stall。
    // 「次フレームの相手入力がこれから届く」通常のパイプラインは stall に数えない。
    const wantMore = this.frame < this.inputFrame - this.delay;
    const stalled = advanced === 0 && wantMore;
    if (stalled) this.stalls++;
    return { advanced, stalled };
  }

  /** 現在の内部フレーム番号（＝step 済み数）。両者一致する。 */
  get simFrame(): number { return this.frame; }

  close(): void { this.tx.close(); }
}
