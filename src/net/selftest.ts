// 全スタック自己テスト（デバッグ用）。
// 同一ページ内に host/guest 2接続を張り、実際の /api/net シグナリング経由で
// WebRTC を確立 → NetSession で対戦させ、両者の GameState 一致を確認する。
import { xorshift32 } from '../core/rng';
import type { CharId, PlayerInput } from '../core/types';
import { connectOnline } from './online';
import { NetSession, neutralInput } from './session';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function stream(seed: number, n: number): PlayerInput[] {
  let s = seed;
  const out: PlayerInput[] = [];
  for (let i = 0; i < n; i++) {
    s = xorshift32(s);
    const b = (k: number) => ((s >>> k) & 1) === 1;
    out.push({ left: b(0) && !b(1), right: b(1), up: b(2) && b(6), down: b(3) && !b(2), light: b(4) && b(7), heavy: b(5) && b(8), special: b(9) });
  }
  return out;
}

export async function netSelfTest(frames = 300): Promise<Record<string, unknown>> {
  const chars: [CharId, CharId] = ['gopher', 'duke'];
  let code = '';
  const hostP = connectOnline('create', undefined, () => {}, (r) => { code = r; });
  for (let i = 0; i < 200 && !code; i++) await sleep(10);
  if (!code) throw new Error('ルームコードが取得できませんでした');
  const guestP = connectOnline('join', code, () => {}, () => {});
  const [h, g] = await Promise.all([hostP, guestP]);

  const a = new NetSession({ seed: h.seed, chars, localSide: h.localSide, delay: 3, transport: h.transport });
  const b = new NetSession({ seed: g.seed, chars, localSide: g.localSide, delay: 3, transport: g.transport });

  const sa = stream(0xaaaa, frames);
  const sb = stream(0x5555, frames);
  for (let i = 0; i < frames; i++) {
    a.tick(sa[i]!);
    b.tick(sb[i]!);
    await sleep(3); // DataChannel の非同期配送を待つ
  }
  for (let i = 0; i < 80; i++) { a.tick(neutralInput()); b.tick(neutralInput()); await sleep(3); }

  const match = JSON.stringify(a.game) === JSON.stringify(b.game);
  const result = {
    seedMatch: h.seed === g.seed,
    hostSide: h.localSide, guestSide: g.localSide,
    aFrame: a.simFrame, bFrame: b.simFrame,
    aStalls: a.stalls, bStalls: b.stalls,
    aHp: [a.game.fighters[0].hp, a.game.fighters[1].hp],
    bHp: [b.game.fighters[0].hp, b.game.fighters[1].hp],
    statesEqual: match,
  };
  h.close(); g.close();
  return result;
}
