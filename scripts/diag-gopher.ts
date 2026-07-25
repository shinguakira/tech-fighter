// Gopher(custom) vs 各キャラ(generic) の敗因診断。
//   npx vite-node scripts/diag-gopher.ts
import { CHAR_LIST, CHARS } from '../src/core/constants';
import { aiFor } from '../src/core/ai';
import { createGame, startMatch, step } from '../src/core/game';
import type { CharId, GameInput, GameState } from '../src/core/types';

const EMPTY = { left: false, right: false, up: false, down: false, light: false, heavy: false, special: false };
const GI = (): GameInput => ({ p1: { ...EMPTY }, p2: { ...EMPTY }, start: false });

function diag(opp: CharId, seed: number) {
  const st: GameState = createGame(seed);
  st.mode = 'demo';
  st.sel = [CHAR_LIST.indexOf('gopher'), CHAR_LIST.indexOf(opp)];
  startMatch(st);
  st.status = 'play'; st.statusTimer = 0;
  const g = st.fighters[0], o = st.fighters[1];
  let prevGopherHp = g.hp, prevOppHp = o.hp;
  const hitWhile = { attacking: 0, airborne: 0, neutral: 0 };
  let dealt = 0, taken = 0, cancels = 0, prevMove = g.move;
  let guard = 0;
  while (st.status !== 'matchEnd' && guard++ < 60 * 60 * 6) {
    if (st.status === 'intro') { st.status = 'play'; st.statusTimer = 0; }
    const gi = GI();
    if (st.status === 'play') { gi.p1 = aiFor(st, 0); gi.p2 = aiFor(st, 1); }
    step(st, gi);
    // gopher が被弾した瞬間の状態
    if (g.hp < prevGopherHp) {
      taken += prevGopherHp - g.hp;
      if (g.atk > 0) hitWhile.attacking++;
      else if (!g.grounded) hitWhile.airborne++;
      else hitWhile.neutral++;
    }
    if (o.hp < prevOppHp) dealt += prevOppHp - o.hp;
    // 弱→必殺キャンセル検出（light/clight の直後に必殺が始動）
    if ((prevMove === 'light' || prevMove === 'clight') && (g.move === 'spN' || g.move === 'spF' || g.move === 'spU' || g.move === 'super')) cancels++;
    prevMove = g.move; prevGopherHp = g.hp; prevOppHp = o.hp;
  }
  const win = g.wins > o.wins;
  return { win, dealt, taken, hitWhile, cancels, gWins: g.wins, oWins: o.wins };
}

const SEEDS = [0x1111, 0x2f2f, 0x3abc, 0x51d5, 0x6c0d, 0x7e11, 0x9a3f, 0xbeef];
for (const opp of CHAR_LIST) {
  if (opp === 'gopher') continue;
  let wins = 0, dealt = 0, taken = 0, cancels = 0;
  const hw = { attacking: 0, airborne: 0, neutral: 0 };
  for (const s of SEEDS) {
    const r = diag(opp, s);
    if (r.win) wins++;
    dealt += r.dealt; taken += r.taken; cancels += r.cancels;
    hw.attacking += r.hitWhile.attacking; hw.airborne += r.hitWhile.airborne; hw.neutral += r.hitWhile.neutral;
  }
  const n = SEEDS.length;
  console.log(
    `vs ${CHARS[opp].name.padEnd(7)} 勝${wins}/${n}  ` +
    `与ダメ${(dealt / n).toFixed(0)} 被ダメ${(taken / n).toFixed(0)}  ` +
    `被弾時[攻撃中${hw.attacking} 空中${hw.airborne} 地上素${hw.neutral}]  ` +
    `キャンセル成功${(cancels / n).toFixed(1)}/試合`,
  );
}
