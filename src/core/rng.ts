// 決定論的な擬似乱数（xorshift32）。core は Math.random を使わない。

/** state を1歩進めて新しい state を返す（0 は避ける）。 */
export function xorshift32(state: number): number {
  let x = state | 0;
  if (x === 0) x = 0x9e3779b9;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x | 0;
}

/** state から 0..1 の一様乱数を取り出す。 */
export function rand01(state: number): number {
  return ((state >>> 8) & 0xffffff) / 0x1000000;
}
