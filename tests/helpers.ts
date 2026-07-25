import { startMatch, step } from '../src/core/game';
import type { GameInput, GameState, PlayerInput } from '../src/core/types';

export const P = (o: Partial<PlayerInput> = {}): PlayerInput => ({
  left: false, right: false, up: false, down: false,
  light: false, heavy: false, special: false, ...o,
});

export const GI = (p1: Partial<PlayerInput> = {}, p2: Partial<PlayerInput> = {}, start = false): GameInput => ({
  p1: P(p1), p2: P(p2), start,
});

export function frames(st: GameState, n: number, gi: GameInput = GI()): void {
  for (let i = 0; i < n; i++) step(st, gi);
}

/** 2P 対戦・両者操作可能な play 状態まで持っていく（intro スキップ）。 */
export function toPlay(st: GameState, sel1 = 0, sel2 = 1): void {
  st.mode = 'vs';
  st.sel = [sel1, sel2];
  startMatch(st);
  st.aiSide = -1;
  st.status = 'play';
  st.statusTimer = 0;
}

/** 近接戦の定位置: P1 の目の前に P2。 */
export function faceOff(st: GameState): void {
  st.fighters[0].x = 300;
  st.fighters[1].x = 352;
  st.fighters[0].facing = 1;
  st.fighters[1].facing = -1;
}
