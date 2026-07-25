// AI vs AI 総当たりトーナメント（決定論・ヘッドレス）。
// 各カードを複数シードで両サイド入れ替えて対戦し、勝率で強さをランク付けする。
//   npx vite-node scripts/tournament.ts
import { CHARS, CHAR_LIST, WINS_NEED } from '../src/core/constants';
import { aiFor } from '../src/core/ai';
import { createGame, startMatch, step } from '../src/core/game';
import type { CharId, GameInput, GameState } from '../src/core/types';

const EMPTY = { left: false, right: false, up: false, down: false, light: false, heavy: false, special: false };
const GI = (): GameInput => ({ p1: { ...EMPTY }, p2: { ...EMPTY }, start: false });

/** 両サイド AI で1試合を最後まで回し、勝者 side（-1=引き分け）を返す。 */
function playMatch(a: CharId, b: CharId, seed: number): number {
  const st: GameState = createGame(seed);
  st.mode = 'demo';
  st.sel = [CHAR_LIST.indexOf(a), CHAR_LIST.indexOf(b)];
  startMatch(st);
  st.status = 'play';
  st.statusTimer = 0;

  let guard = 0;
  while (st.status !== 'matchEnd' && guard++ < 60 * 60 * 6) {
    // roundEnd を最後まで消化して次ラウンドへ進める（intro はスキップ）
    if (st.status === 'intro') { st.status = 'play'; st.statusTimer = 0; }
    const gi = GI();
    if (st.status === 'play') {
      gi.p1 = aiFor(st, 0);
      gi.p2 = aiFor(st, 1);
    }
    step(st, gi);
  }
  if (st.fighters[0].wins > st.fighters[1].wins) return 0;
  if (st.fighters[1].wins > st.fighters[0].wins) return 1;
  return -1;
}

const SEEDS = [0x1111, 0x2f2f, 0x3abc, 0x51d5, 0x6c0d, 0x7e11, 0x9a3f, 0xbeef, 0xc0de, 0xd00d];

interface Rec { w: number; l: number; d: number; }
const rec: Record<string, Rec> = {};
for (const c of CHAR_LIST) rec[c] = { w: 0, l: 0, d: 0 };
const head: Record<string, Record<string, number>> = {};
for (const c of CHAR_LIST) { head[c] = {}; for (const d of CHAR_LIST) head[c]![d] = 0; }

let games = 0;
for (let i = 0; i < CHAR_LIST.length; i++) {
  for (let j = i + 1; j < CHAR_LIST.length; j++) {
    const a = CHAR_LIST[i]!, b = CHAR_LIST[j]!;
    for (const seed of SEEDS) {
      // 両サイド入れ替えて位置バイアスを打ち消す
      for (const [x, y, flip] of [[a, b, false], [b, a, true]] as const) {
        const r = playMatch(x, y, seed + (flip ? 0x777 : 0));
        games++;
        const winner = r === -1 ? null : (r === 0 ? x : y);
        const loser = r === -1 ? null : (r === 0 ? y : x);
        if (winner && loser) {
          rec[winner]!.w++; rec[loser]!.l++;
          head[winner]![loser]!++;
        } else {
          rec[a]!.d++; rec[b]!.d++;
        }
      }
    }
  }
}

const rows = CHAR_LIST.map((c) => {
  const r = rec[c]!;
  const total = r.w + r.l + r.d;
  const winPct = total ? (r.w / total) * 100 : 0;
  return { c, ...r, total, winPct };
}).sort((p, q) => q.winPct - p.winPct);

const pad = (s: string, n: number): string => s + ' '.repeat(Math.max(0, n - s.length));
console.log(`\n=== TECH FIGHTER  AI vs AI 総当たり  (${games} 試合 / ${SEEDS.length} seeds × 両サイド) ===\n`);
console.log(pad('RANK  CHAR', 16) + pad('W', 5) + pad('L', 5) + pad('D', 5) + 'WIN%');
rows.forEach((r, idx) => {
  console.log(pad(`${idx + 1}.   ${CHARS[r.c as CharId].name}`, 16) + pad(String(r.w), 5) + pad(String(r.l), 5) + pad(String(r.d), 5) + r.winPct.toFixed(1) + '%');
});

console.log('\n--- 相性表（行が列に勝った回数 / 全' + (SEEDS.length * 2) + '戦）---');
console.log(pad('', 9) + CHAR_LIST.map((c) => pad(CHARS[c].name.slice(0, 6), 8)).join(''));
for (const a of CHAR_LIST) {
  let line = pad(CHARS[a].name, 9);
  for (const b of CHAR_LIST) {
    line += pad(a === b ? '-' : `${head[a]![b]}`, 8);
  }
  console.log(line);
}
console.log(`\n（各カードは ${SEEDS.length} seeds × 両サイド = ${SEEDS.length * 2} 戦、${WINS_NEED}本先取）\n`);
