// なぜ Duke が強いか — フレームデータ比較＋実戦の与ダメ効率を数値化。
//   npx vite-node scripts/why-duke.ts
import { CHAR_LIST, CHARS } from '../src/core/constants';
import { aiFor } from '../src/core/ai';
import { createGame, startMatch, step } from '../src/core/game';
import type { CharId, GameInput, GameState, Side } from '../src/core/types';

const EMPTY = { left: false, right: false, up: false, down: false, light: false, heavy: false, special: false };
const GI = (): GameInput => ({ p1: { ...EMPTY }, p2: { ...EMPTY }, start: false });
const pad = (s: string, n: number) => s + ' '.repeat(Math.max(0, n - s.length));

// ---- 1) フレームデータ比較 ----
console.log('\n=== フレームデータ比較 ===\n');
console.log(pad('CHAR', 8) + pad('HP', 5) + pad('歩速', 6) + pad('弱発生', 7) + pad('強Dmg', 7) + pad('強Reach', 8) + pad('最長Reach', 10) + pad('超必Dmg', 8));
for (const c of CHAR_LIST) {
  const d = CHARS[c];
  const reaches = Object.values(d.moves).map((m) => m.range);
  const maxReach = Math.max(...reaches);
  console.log(
    pad(d.name, 8) + pad(String(d.hp), 5) + pad(d.walkF.toFixed(1), 6) +
    pad(String(d.moves.light.startup), 7) + pad(String(d.moves.heavy.dmg), 7) +
    pad(String(d.moves.heavy.range), 8) + pad(String(maxReach), 10) + pad(String(d.moves.super.dmg), 8),
  );
}

// ---- 2) 実戦の与ダメ効率（全員 generic 同士 & 現行 AI） ----
function playCounting(a: CharId, b: CharId, seed: number) {
  const st: GameState = createGame(seed);
  st.mode = 'demo';
  st.sel = [CHAR_LIST.indexOf(a), CHAR_LIST.indexOf(b)];
  startMatch(st);
  st.status = 'play'; st.statusTimer = 0;
  const stat = [
    { dealt: 0, hits: 0 },
    { dealt: 0, hits: 0 },
  ];
  const prevHp = [st.fighters[0].hp, st.fighters[1].hp];
  let guard = 0;
  while (st.status !== 'matchEnd' && guard++ < 60 * 60 * 6) {
    if (st.status === 'intro') { st.status = 'play'; st.statusTimer = 0; }
    const gi = GI();
    if (st.status === 'play') { gi.p1 = aiFor(st, 0); gi.p2 = aiFor(st, 1); }
    step(st, gi);
    for (const s of [0, 1] as Side[]) {
      const cur = st.fighters[s].hp;
      if (cur < prevHp[s]!) {
        const dmg = prevHp[s]! - cur;
        const attacker = (1 - s) as Side;
        stat[attacker]!.dealt += dmg;
        stat[attacker]!.hits++;
      }
      prevHp[s] = cur;
    }
  }
  const winner = st.fighters[0].wins > st.fighters[1].wins ? 0 : st.fighters[1].wins > st.fighters[0].wins ? 1 : -1;
  const byTimeout = st.roundMsg === 'TIME UP' || st.roundMsg === 'DRAW';
  return { stat, winner, byTimeout };
}

const SEEDS = [0x1111, 0x2f2f, 0x3abc, 0x51d5, 0x6c0d, 0x7e11, 0x9a3f, 0xbeef];
const agg: Record<string, { dealt: number; hits: number; koWins: number; toWins: number; wins: number; games: number }> = {};
for (const c of CHAR_LIST) agg[c] = { dealt: 0, hits: 0, koWins: 0, toWins: 0, wins: 0, games: 0 };
for (let i = 0; i < CHAR_LIST.length; i++) {
  for (let j = i + 1; j < CHAR_LIST.length; j++) {
    const a = CHAR_LIST[i]!, b = CHAR_LIST[j]!;
    for (const s of SEEDS) {
      for (const [x, y] of [[a, b], [b, a]] as const) {
        const r = playCounting(x, y, s + (x === b ? 0x777 : 0));
        const chars = [x, y];
        for (const side of [0, 1] as Side[]) {
          const ch = chars[side]!;
          agg[ch]!.dealt += r.stat[side]!.dealt;
          agg[ch]!.hits += r.stat[side]!.hits;
          agg[ch]!.games++;
        }
        if (r.winner !== -1) {
          const wch = chars[r.winner]!;
          agg[wch]!.wins++;
          if (r.byTimeout) agg[wch]!.toWins++; else agg[wch]!.koWins++;
        }
      }
    }
  }
}

console.log('\n=== 実戦の与ダメ効率（現行 AI・各キャラ両サイド合計） ===\n');
console.log(pad('CHAR', 8) + pad('勝', 5) + pad('KO勝', 7) + pad('時間切勝', 10) + pad('1撃平均', 9) + pad('命中/試合', 10));
for (const c of CHAR_LIST) {
  const a = agg[c]!;
  const dph = a.hits ? a.dealt / a.hits : 0;
  console.log(
    pad(CHARS[c].name, 8) + pad(String(a.wins), 5) + pad(String(a.koWins), 7) +
    pad(String(a.toWins), 10) + pad(dph.toFixed(1), 9) + pad((a.hits / a.games).toFixed(1), 10),
  );
}
console.log('');
