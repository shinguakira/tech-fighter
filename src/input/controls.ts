// キーボード → GameInput（DOM 入力はここだけ）
// 1P: WASD + J/K/L　2P: 矢印 + テンキー1/2/3（または B/N/M）　スタート: Enter

import type { GameInput, PlayerInput } from '../core/types';

const emptyP = (): PlayerInput => ({ left: false, right: false, up: false, down: false, light: false, heavy: false, special: false });

export interface Controls {
  /** 現在の入力スナップショットを返す（start はエッジで一度だけ true）。 */
  consume: () => GameInput;
}

export function createControls(): Controls {
  const held = new Set<string>();
  let startEdge = false;

  window.addEventListener('keydown', (e) => {
    // 矢印・スペースのスクロールを止める
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Enter') startEdge = true;
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => {
    held.delete(e.code);
  });
  window.addEventListener('blur', () => held.clear());

  const has = (...codes: string[]): boolean => codes.some((c) => held.has(c));

  return {
    consume: () => {
      const p1: PlayerInput = {
        left: has('KeyA'),
        right: has('KeyD'),
        up: has('KeyW'),
        down: has('KeyS'),
        light: has('KeyJ'),
        heavy: has('KeyK'),
        special: has('KeyL'),
      };
      const p2: PlayerInput = {
        left: has('ArrowLeft'),
        right: has('ArrowRight'),
        up: has('ArrowUp'),
        down: has('ArrowDown'),
        light: has('Numpad1', 'KeyB'),
        heavy: has('Numpad2', 'KeyN'),
        special: has('Numpad3', 'KeyM'),
      };
      const start = startEdge;
      startEdge = false;
      return { p1, p2, start };
    },
  };
}

export const emptyPlayerInput = emptyP;
