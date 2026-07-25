// ネット対戦のトランスポート抽象。
// ロックステップ中核はこのインターフェースにだけ依存し、実体は
// WebRTC DataChannel でも、テスト用ループバックでも差し替えられる。
import type { PlayerInput } from '../core/types';

/** 1フレーム分の入力メッセージ（f=フレーム番号 / p=入力）。 */
export interface InputMsg { t: 'in'; f: number; p: PlayerInput }
/** 接続維持・遅延計測用の ping（任意）。 */
export interface PingMsg { t: 'ping'; ts: number }
export type NetMsg = InputMsg | PingMsg;

export interface Transport {
  send(m: NetMsg): void;
  onMessage(cb: (m: NetMsg) => void): void;
  close(): void;
}

/**
 * テスト用のループバック対（2つの Transport が互いに繋がる）。
 * delay=遅延ティック数。send した内容は clock が due に達したとき相手へ届く。
 * clock は tick()/pump() で進める（決定論・実時間非依存）。
 */
export function createLoopback(delay = 0): {
  a: Transport;
  b: Transport;
  tick: () => void;
  pump: (now: number) => void;
  clock: () => number;
} {
  let clock = 0;
  interface Q { to: 0 | 1; m: NetMsg; due: number }
  const queue: Q[] = [];
  const cbs: [(m: NetMsg) => void | undefined, (m: NetMsg) => void | undefined] = [() => {}, () => {}];

  const drain = (): void => {
    for (let i = queue.length - 1; i >= 0; i--) {
      if (queue[i]!.due <= clock) {
        const q = queue.splice(i, 1)[0]!;
        cbs[q.to]?.(q.m);
      }
    }
  };
  // 配送は必ず tick()/pump() のクロック進行時に行う（送信順に依存しない対称配送）。
  // due=clock+delay。delay=0 でも最短1ティック遅れて届く（両者対称）。
  const mk = (self: 0 | 1): Transport => ({
    send: (m) => { queue.push({ to: (1 - self) as 0 | 1, m, due: clock + delay }); },
    onMessage: (cb) => { cbs[self] = cb; },
    close: () => {},
  });
  return {
    a: mk(0),
    b: mk(1),
    tick: () => { clock++; drain(); },
    pump: (now: number) => { clock = now; drain(); },
    clock: () => clock,
  };
}
