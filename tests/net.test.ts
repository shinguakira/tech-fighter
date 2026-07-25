import { describe, expect, it } from 'vitest';
import { xorshift32 } from '../src/core/rng';
import { NetSession, neutralInput } from '../src/net/session';
import { createLoopback } from '../src/net/transport';
import type { CharId, PlayerInput } from '../src/core/types';

/** シード列から擬似ランダムな入力列を作る（両側で別パターン）。 */
function inputStream(seed: number, n: number): PlayerInput[] {
  let s = seed;
  const out: PlayerInput[] = [];
  for (let i = 0; i < n; i++) {
    s = xorshift32(s);
    const b = (k: number) => ((s >>> k) & 1) === 1;
    out.push({
      left: b(0) && !b(1), right: b(1), up: b(2) && b(6), down: b(3) && !b(2),
      light: b(4) && b(7), heavy: b(5) && b(8), special: b(9) && b(10),
    });
  }
  return out;
}

/** 2つのセッションを loopback で繋ぎ、N フレーム対戦させる。 */
function runNet(delay: number, latency: number, chars: [CharId, CharId], frames: number) {
  const loop = createLoopback(latency);
  const seed = 0x1234abcd;
  const a = new NetSession({ seed, chars, localSide: 0, delay, transport: loop.a });
  const b = new NetSession({ seed, chars, localSide: 1, delay, transport: loop.b });
  const sa = inputStream(0xaaaa, frames);
  const sb = inputStream(0x5555, frames);
  for (let i = 0; i < frames; i++) {
    a.tick(sa[i]!);
    b.tick(sb[i]!);
    loop.tick(); // クロックを1進め、届いた入力を配送
  }
  // 遅延分の入力がまだ配送中なので、追加で空 tick して両者を追いつかせる
  for (let i = 0; i < latency + delay + 5; i++) {
    a.tick(neutralInput());
    b.tick(neutralInput());
    loop.tick();
  }
  return { a, b };
}

describe('ネット対戦 ロックステップ', () => {
  it('遅延ゼロ: 2クライアントの GameState が完全一致', () => {
    const { a, b } = runNet(3, 0, ['gopher', 'duke'], 600);
    expect(a.simFrame).toBe(b.simFrame);
    expect(a.simFrame).toBeGreaterThan(500);
    expect(JSON.stringify(a.game)).toBe(JSON.stringify(b.game));
    expect(a.stalls).toBe(0); // 遅延ゼロなら待ちは発生しない
  });

  it('遅延あり(3フレーム)でも最終的に完全一致', () => {
    const { a, b } = runNet(4, 3, ['ferris', 'tux'], 600);
    expect(a.simFrame).toBe(b.simFrame);
    expect(a.simFrame).toBeGreaterThan(500);
    expect(JSON.stringify(a.game)).toBe(JSON.stringify(b.game));
  });

  it('大きめ遅延(8)＜ディレイ(6)不足でも同期は保たれる（stall しつつ一致）', () => {
    const { a, b } = runNet(6, 8, ['deno', 'gnu'], 400);
    // 遅延 > ディレイ なので stall は起きるが、状態は必ず一致する
    expect(a.simFrame).toBe(b.simFrame);
    expect(JSON.stringify(a.game)).toBe(JSON.stringify(b.game));
  });

  it('決定論: 同条件のネット対戦を2回流すと最終状態が一致', () => {
    const r1 = runNet(3, 2, ['gopher', 'gnu'], 500);
    const r2 = runNet(3, 2, ['gopher', 'gnu'], 500);
    expect(JSON.stringify(r1.a.game)).toBe(JSON.stringify(r2.a.game));
  });

  it('ネット対戦の結果はローカル2P対戦と一致（入力ディレイ込みで検証）', async () => {
    // 参照: 同じ入力列を「D フレーム遅らせて」ローカルで直接 step した結果と比べる
    const { createGame, startVsMatch, step } = await import('../src/core/game');
    const delay = 3, frames = 400;
    const seed = 0x1234abcd;
    const chars: [CharId, CharId] = ['duke', 'ferris'];
    const sa = inputStream(0xaaaa, frames);
    const sb = inputStream(0x5555, frames);

    const net = runNet(delay, 0, chars, frames);

    const ref = createGame(seed);
    startVsMatch(ref, chars[0], chars[1]);
    const totalFrames = net.a.simFrame;
    for (let f = 0; f < totalFrames; f++) {
      const ai = f < delay ? neutralInput() : (sa[f - delay] ?? neutralInput());
      const bi = f < delay ? neutralInput() : (sb[f - delay] ?? neutralInput());
      step(ref, { p1: ai, p2: bi, start: false });
    }
    expect(JSON.stringify(net.a.game)).toBe(JSON.stringify(ref));
  });
});
