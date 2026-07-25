import type { Facing, Rect } from './types';

export function aabb(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function centerX(r: Rect): number { return r.x + r.w / 2; }
export function centerY(r: Rect): number { return r.y + r.h / 2; }

/** 2矩形の重なりの中心座標（ヒットスパークの原点に使う）。 */
export function intersectCenter(a: Rect, b: Rect): { x: number; y: number } {
  return {
    x: Math.max(a.x, b.x) + (Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) / 2,
    y: Math.max(a.y, b.y) + (Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) / 2,
  };
}

/** Math.sign を Facing(1|-1) に丸める（0 は fallback）。 */
export function sign1(n: number, fallback: Facing): Facing {
  return n > 0 ? 1 : n < 0 ? -1 : fallback;
}
