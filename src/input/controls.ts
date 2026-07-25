// キーボード＋タッチ → GameInput（DOM 入力はここだけ）
// 1P: WASD + J/K/L　2P: 矢印 + テンキー1/2/3（または B/N/M）　スタート: Enter
// タッチ: オンスクリーンの十字＋弱/強/必殺＋START（1P 入力にマージ）。

import type { GameInput, PlayerInput } from '../core/types';

const emptyP = (): PlayerInput => ({ left: false, right: false, up: false, down: false, light: false, heavy: false, special: false });

type TouchKey = 'up' | 'down' | 'left' | 'right' | 'light' | 'heavy' | 'special';

export interface Controls {
  /** 現在の入力スナップショットを返す（start はエッジで一度だけ true）。 */
  consume: () => GameInput;
  /** タップ確定（メニュー用）: 次の consume で start を1回 true にする。 */
  pressStart: () => void;
}

export function createControls(): Controls {
  const held = new Set<string>();
  const touch = new Set<TouchKey>();
  let startEdge = false;

  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === 'Enter') startEdge = true;
    held.add(e.code);
  });
  window.addEventListener('keyup', (e) => { held.delete(e.code); });
  window.addEventListener('blur', () => { held.clear(); touch.clear(); });

  // ---- タッチ操作のバインド（オンスクリーンボタン） ----
  const bindTouch = (): void => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-hold]'))) {
      const key = el.dataset.hold as TouchKey;
      const on = (e: Event): void => { e.preventDefault(); touch.add(key); el.classList.add('on'); };
      const off = (e: Event): void => { e.preventDefault(); touch.delete(key); el.classList.remove('on'); };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    }
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-press="start"]'))) {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); startEdge = true; el.classList.add('on'); });
      const clear = (): void => el.classList.remove('on');
      el.addEventListener('pointerup', clear);
      el.addEventListener('pointercancel', clear);
      el.addEventListener('pointerleave', clear);
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindTouch);
  else bindTouch();

  const has = (...codes: string[]): boolean => codes.some((c) => held.has(c));

  return {
    consume: () => {
      const p1: PlayerInput = {
        left: has('KeyA') || touch.has('left'),
        right: has('KeyD') || touch.has('right'),
        up: has('KeyW') || touch.has('up'),
        down: has('KeyS') || touch.has('down'),
        light: has('KeyJ') || touch.has('light'),
        heavy: has('KeyK') || touch.has('heavy'),
        special: has('KeyL') || touch.has('special'),
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
    pressStart: () => { startEdge = true; },
  };
}

export const emptyPlayerInput = emptyP;
