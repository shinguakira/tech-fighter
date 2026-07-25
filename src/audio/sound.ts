// サウンド: Web Audio によるチップチューン合成（非 core・DOM 層）。
// core は決定論を保つため音を出さない。ここで GameState の差分を観測して鳴らす。
import { SUPER_COST } from '../core/constants';
import { timerSec } from '../core/game';
import type { GameState, ProjKind, Status } from '../core/types';

type Wave = OscillatorType;

interface FPrev {
  hp: number;
  atkId: number;
  move: string | null;
  grounded: boolean;
  hitstun: number;
  meter: number;
}

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private muted = false;
  private masterVol = 0.5;

  // BGM スケジューラ
  private nextNote = 0;
  private step = 0;

  // 差分観測用の前フレーム値
  private prevF: [FPrev, FPrev] = [blankF(), blankF()];
  private prevStatus: Status = 'title';
  private prevProj = 0;
  private prevModeSel = 0;
  private prevSel: [number, number] = [0, 1];
  private prevSelDone: [boolean, boolean] = [false, false];
  private prevSec = 99;
  private hitCd: [number, number] = [0, 0];

  /** ユーザー操作後に一度だけ初期化（autoplay 制約）。 */
  ensure(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.masterVol;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.connect(this.master);
    this.startBgm();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.masterVol;
    return this.muted;
  }
  isMuted(): boolean { return this.muted; }
  /** デバッグ用: AudioContext の状態（none/suspended/running）。 */
  ctxState(): string { return this.ctx ? this.ctx.state : 'none'; }
  /** デバッグ用: 明示的に resume（自動再生制約の確認）。 */
  resume(): void { void this.ctx?.resume(); }
  setVolume(v: number): void {
    this.masterVol = Math.max(0, Math.min(1, v));
    if (this.master && !this.muted) this.master.gain.value = this.masterVol;
  }

  // ---- 合成プリミティブ ----
  private blip(freq: number, dur: number, type: Wave, vol: number, slideTo?: number, delay = 0): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, delay = 0): void {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + delay;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let seed = 22695477;
    for (let i = 0; i < n; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x3fffffff - 1) * (1 - i / n); }
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.buffer = buf; src.connect(g); g.connect(this.master);
    src.start(t);
  }

  // ---- 個別 SFX ----
  private hit(weight: number): void {
    // 打撃: 重いほど低く・ノイズ多め
    this.blip(320 - weight * 90, 0.06, 'square', 0.2, 150 - weight * 40);
    this.noise(0.04 + weight * 0.03, 0.06 + weight * 0.05);
  }
  private block(): void { this.blip(760, 0.05, 'square', 0.14, 520); this.noise(0.05, 0.05); }
  private swing(heavy: boolean): void { this.noise(heavy ? 0.09 : 0.05, heavy ? 0.06 : 0.035); this.blip(heavy ? 180 : 300, heavy ? 0.08 : 0.05, 'sawtooth', 0.06, heavy ? 90 : 200); }
  private special(): void { this.blip(220, 0.1, 'sawtooth', 0.14, 620); }
  private superCast(): void {
    [0, 0.08, 0.16].forEach((d, i) => this.blip(330 + i * 220, 0.16, 'square', 0.16, 660 + i * 260, d));
    this.noise(0.2, 0.1);
  }
  private fire(kind: ProjKind): void {
    if (kind === 'beam' || kind === 'oom' || kind === 'gpl') { this.blip(140, 0.3, 'sawtooth', 0.18, 220); this.noise(0.16, 0.1); }
    else if (kind === 'rain') { this.blip(520, 0.12, 'triangle', 0.1, 260); }
    else if (kind === 'crate' || kind === 'null') { this.blip(200, 0.12, 'square', 0.12, 120); }
    else { this.blip(440, 0.08, 'square', 0.12, 900); } // gofunc/pipe/fetch/boomerang/swarm
  }
  private jump(): void { this.blip(300, 0.11, 'square', 0.12, 600); }
  private meterReady(): void { [660, 990, 1320].forEach((f, i) => this.blip(f, 0.1, 'square', 0.12, undefined, i * 0.05)); }
  private ko(): void { this.blip(160, 0.35, 'sawtooth', 0.24, 55); this.noise(0.28, 0.18); }
  private timeUp(): void { [520, 520, 400].forEach((f, i) => this.blip(f, 0.16, 'square', 0.14, undefined, i * 0.14)); }
  private roundStart(): void { this.blip(440, 0.14, 'triangle', 0.14, 660); }
  private fightGo(): void { this.blip(523, 0.1, 'square', 0.18); this.blip(784, 0.22, 'square', 0.18, undefined, 0.09); }
  private menuMove(): void { this.blip(600, 0.04, 'square', 0.1, 760); }
  private menuConfirm(): void { this.blip(660, 0.06, 'square', 0.14); this.blip(990, 0.1, 'square', 0.12, undefined, 0.05); }
  private matchWin(): void { [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.18, 'square', 0.16, undefined, i * 0.12)); }
  private timerBeep(): void { this.blip(880, 0.06, 'square', 0.12); }

  // ---- BGM: ベース＋リードの 16 ステップループ ----
  private startBgm(): void {
    if (!this.ctx) return;
    const lead = [0, 7, 12, 7, 3, 10, 7, 3, 5, 12, 8, 5, 2, 7, 10, 12];
    const bass = [0, 0, -5, -5, -3, -3, 2, 2, 0, 0, -5, -5, 3, 3, -2, -2];
    const interval = 0.135;
    const schedule = (): void => {
      if (!this.ctx) return;
      while (this.nextNote < this.ctx.currentTime + 0.2) {
        const t = this.nextNote;
        if (!this.muted && this.musicGain.gain.value > 0.001) {
          const i = this.step % 16;
          // リード（square）
          const lf = 261.63 * Math.pow(2, lead[i]! / 12);
          const lo = this.ctx.createOscillator();
          const lg = this.ctx.createGain();
          lo.type = 'square'; lo.frequency.value = lf;
          lg.gain.setValueAtTime(0.0001, t);
          lg.gain.exponentialRampToValueAtTime(0.1, t + 0.01);
          lg.gain.exponentialRampToValueAtTime(0.0001, t + interval * 0.9);
          lo.connect(lg); lg.connect(this.musicGain);
          lo.start(t); lo.stop(t + 0.2);
          // ベース（triangle・2 ステップに 1 回）
          if (i % 2 === 0) {
            const bf = 130.81 * Math.pow(2, bass[i]! / 12);
            const bo = this.ctx.createOscillator();
            const bg = this.ctx.createGain();
            bo.type = 'triangle'; bo.frequency.value = bf;
            bg.gain.setValueAtTime(0.0001, t);
            bg.gain.exponentialRampToValueAtTime(0.14, t + 0.01);
            bg.gain.exponentialRampToValueAtTime(0.0001, t + interval * 1.8);
            bo.connect(bg); bg.connect(this.musicGain);
            bo.start(t); bo.stop(t + 0.35);
          }
        }
        this.nextNote += interval;
        this.step++;
      }
    };
    this.nextNote = this.ctx.currentTime + 0.1;
    window.setInterval(schedule, 60);
  }

  /** 毎フレーム: GameState の差分から効果音を鳴らし、BGM 音量を調整。 */
  update(s: GameState): void {
    if (!this.ctx) { this.snapshot(s); return; }
    if (this.hitCd[0] > 0) this.hitCd[0]--;
    if (this.hitCd[1] > 0) this.hitCd[1]--;

    // 画面遷移
    if (s.status !== this.prevStatus) {
      if (s.status === 'intro') this.roundStart();
      else if (s.status === 'play' && this.prevStatus === 'intro') this.fightGo();
      else if (s.status === 'roundEnd') { if (s.roundMsg.includes('K.O.')) this.ko(); else this.timeUp(); }
      else if (s.status === 'matchEnd') this.matchWin();
      else if (s.status === 'select') this.menuConfirm();
    }

    if (s.status === 'title' && s.modeSel !== this.prevModeSel) this.menuMove();
    if (s.status === 'select') {
      if (s.sel[0] !== this.prevSel[0] || s.sel[1] !== this.prevSel[1]) this.menuMove();
      if ((s.selDone[0] && !this.prevSelDone[0]) || (s.selDone[1] && !this.prevSelDone[1])) this.menuConfirm();
    }

    if (s.status === 'play') {
      for (const i of [0, 1] as const) {
        const f = s.fighters[i];
        const p = this.prevF[i];
        // 被弾／ガード（hp が減ったフレームで分類）
        if (f.hp < p.hp && this.hitCd[i] === 0) {
          const dmg = p.hp - f.hp;
          if (f.hitstun > 0) { this.hit(Math.min(1, dmg / 14)); this.hitCd[i] = 3; }
          else { this.block(); this.hitCd[i] = 3; } // 削り＝ガード
        }
        // 技の発生（atkId 増加）
        if (f.atkId !== p.atkId && f.move) {
          if (f.move === 'super') this.superCast();
          else if (f.move === 'spN' || f.move === 'spF' || f.move === 'spU') this.special();
          else this.swing(f.move === 'heavy' || f.move === 'cheavy');
        }
        // ジャンプ（被弾でない離陸）
        if (p.grounded && !f.grounded && f.hitstun === 0 && f.kd === 0) this.jump();
        // ゲージ MAX 到達
        if (f.meter >= SUPER_COST && p.meter < SUPER_COST) this.meterReady();
      }
      // 飛び道具の発生（本数が増えた）
      const projLive = s.projectiles.filter((q) => !q.dead);
      if (projLive.length > this.prevProj && projLive.length > 0) this.fire(projLive[projLive.length - 1]!.kind);
      this.prevProj = projLive.length;
      // 残り時間 10 秒以下は毎秒ビープ
      const sec = timerSec(s);
      if (sec !== this.prevSec && sec <= 10 && sec > 0) this.timerBeep();
      this.prevSec = sec;
    } else {
      this.prevProj = s.projectiles.filter((q) => !q.dead).length;
    }

    // BGM 音量ターゲット
    const target = s.status === 'play' || s.status === 'intro' ? 0.16
      : s.status === 'title' || s.status === 'select' ? 0.09
      : 0.05;
    this.musicGain.gain.value += (target - this.musicGain.gain.value) * 0.08;

    this.snapshot(s);
  }

  private snapshot(s: GameState): void {
    for (const i of [0, 1] as const) {
      const f = s.fighters[i];
      this.prevF[i] = { hp: f.hp, atkId: f.atkId, move: f.move, grounded: f.grounded, hitstun: f.hitstun, meter: f.meter };
    }
    this.prevStatus = s.status;
    this.prevModeSel = s.modeSel;
    this.prevSel = [s.sel[0], s.sel[1]];
    this.prevSelDone = [s.selDone[0], s.selDone[1]];
  }
}

function blankF(): FPrev {
  return { hp: 100, atkId: 0, move: null, grounded: true, hitstun: 0, meter: 0 };
}
