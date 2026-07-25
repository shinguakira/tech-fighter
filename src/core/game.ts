import { aiFor, emptyInput } from './ai';
import { bodyPush, resolveHits, updateProjectiles } from './combat';
import { CHAR_LIST, INTRO_FRAMES, ROUND_END_FRAMES, ROUND_FRAMES, START_OFFSET, W, WINS_NEED, charAt } from './constants';
import { createFighter, resetFighter, updateFighter } from './fighter';
import { centerX } from './physics';
import type { AiState, CharId, Facing, Fighter, GameInput, GameState, PlayerInput, Side, Winner } from './types';

const mkAi = (): AiState => ({ think: 0, hold: emptyInput(), tapped: false });

export function createGame(seed = 0x1234abcd): GameState {
  return {
    status: 'title',
    mode: 'cpu',
    fighters: [
      createFighter(0, 'gopher', W / 2 - START_OFFSET - 22, 1, false),
      createFighter(1, 'duke', W / 2 + START_OFFSET - 22, -1, false),
    ],
    projectiles: [],
    effects: [],
    timer: ROUND_FRAMES,
    round: 1,
    hitstop: 0,
    statusTimer: 0,
    roundMsg: '',
    winner: -1,
    rng: seed,
    aiSide: -1,
    ai: [mkAi(), mkAi()],
    sel: [0, 1],
    selDone: [false, false],
    prevIn: [emptyInput(), emptyInput()],
    frame: 0,
    shake: 0,
    modeSel: 0,
    demoPair: 0,
    enterOnline: false,
  };
}

/** 観戦モードの全マッチアップ（総当たり・非順序ペア）。 */
export function demoPairs(): [number, number][] {
  const n = CHAR_LIST.length;
  const pairs: [number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  return pairs;
}

/** 観戦モード: demoPair 番のカードを組んで対戦開始。 */
export function startDemoMatch(st: GameState): void {
  const pairs = demoPairs();
  const [i, j] = pairs[st.demoPair % pairs.length]!;
  st.mode = 'demo';
  st.sel = [i, j];
  startMatch(st);
}

/** ネット対戦: side0=c0 / side1=c1 を指定して 2P vs 対戦を開始（AI 無し）。 */
export function startVsMatch(st: GameState, c0: CharId, c1: CharId): void {
  st.mode = 'vs';
  st.sel = [CHAR_LIST.indexOf(c0), CHAR_LIST.indexOf(c1)];
  startMatch(st);
}

const press = (cur: PlayerInput, prev: PlayerInput, k: keyof PlayerInput): boolean => cur[k] && !prev[k];
const anyAttack = (cur: PlayerInput, prev: PlayerInput): boolean =>
  press(cur, prev, 'light') || press(cur, prev, 'heavy') || press(cur, prev, 'special');

/** キャラ選択確定 → 対戦開始。 */
export function startMatch(st: GameState): void {
  const c0 = charAt(st.sel[0]);
  const c1 = charAt(st.sel[1]);
  st.fighters = [
    createFighter(0, c0, W / 2 - START_OFFSET - 22, 1, false),
    createFighter(1, c1, W / 2 + START_OFFSET - 22, -1, c0 === c1),
  ];
  st.projectiles = [];
  st.effects = [];
  st.round = 1;
  st.timer = ROUND_FRAMES;
  st.hitstop = 0;
  st.winner = -1;
  st.roundMsg = '';
  st.aiSide = st.mode === 'cpu' ? 1 : -1;
  st.ai = [mkAi(), mkAi()];
  st.status = 'intro';
  st.statusTimer = INTRO_FRAMES;
}

/** 次ラウンドへ（wins/meter は保持）。 */
function resetRound(st: GameState): void {
  st.round++;
  resetFighter(st.fighters[0], W / 2 - START_OFFSET - 22, 1);
  resetFighter(st.fighters[1], W / 2 + START_OFFSET - 22, -1);
  st.projectiles = [];
  st.effects = [];
  st.timer = ROUND_FRAMES;
  st.hitstop = 0;
  st.roundMsg = '';
  st.status = 'intro';
  st.statusTimer = INTRO_FRAMES;
}

/** ラウンド終了処理。winner=-1 は引き分け（両者に加点しない）。 */
function endRound(st: GameState, winner: Winner, msg: string): void {
  if (winner !== -1) {
    const wf = st.fighters[winner];
    wf.wins++;
    // 無傷 KO のみ PERFECT 表記（TIME UP はそのまま）
    if (msg === 'K.O.' && wf.hp === wf.maxhp) msg = 'PERFECT K.O.';
  }
  st.roundMsg = msg;
  st.status = 'roundEnd';
  st.statusTimer = ROUND_END_FRAMES;
}

/** KO 演出: 敗者を吹き飛ばす。 */
function launchLoser(st: GameState, loser: Fighter): void {
  const winner = st.fighters[(1 - loser.side) as Side];
  const dir: Facing = centerX(loser) >= centerX(winner) ? 1 : -1;
  loser.hitstun = 90;
  loser.kdPending = true;
  loser.grounded = false;
  loser.vy = -7.5;
  loser.vx = dir * 6;
  loser.atk = 0;
  loser.move = null;
  st.effects.push({ kind: 'ko', x: centerX(loser), y: loser.y + 30, t: 0, total: 40, dir });
  st.shake = 16;
}

/**
 * 1フレーム進める。決定論: Math.random / Date 不使用（乱数は st.rng）。
 */
export function step(st: GameState, gi: GameInput): void {
  st.frame++;
  if (st.shake > 0) st.shake--;

  // エフェクトは常に進める（ヒットストップ中も）
  st.effects = st.effects.filter((e) => ++e.t < e.total);

  const rawIn: [PlayerInput, PlayerInput] = [{ ...gi.p1 }, { ...gi.p2 }];

  switch (st.status) {
    case 'title': {
      // 上下でモード選択（4択）、決定で次へ
      const p1 = rawIn[0], pv = st.prevIn[0];
      const MODES = 4;
      if (press(p1, pv, 'up') || press(p1, pv, 'left')) st.modeSel = (st.modeSel + MODES - 1) % MODES;
      if (press(p1, pv, 'down') || press(p1, pv, 'right')) st.modeSel = (st.modeSel + 1) % MODES;
      if (gi.start || anyAttack(p1, pv)) {
        if (st.modeSel === 3) {
          // オンライン: 配線層(main.ts)へ委譲（ロビーを開く）
          st.enterOnline = true;
        } else if (st.modeSel === 2) {
          // 観戦: キャラ選択を飛ばして総当たりを自動開始
          st.demoPair = 0;
          startDemoMatch(st);
        } else {
          st.mode = st.modeSel === 0 ? 'cpu' : 'vs';
          st.status = 'select';
          st.sel = [0, 1];
          st.selDone = [false, false];
        }
      }
      break;
    }
    case 'select': {
      for (const side of [0, 1] as const) {
        if (st.selDone[side]) continue;
        // CPU 側は選ばない（P1 確定時に自動で反対キャラ）
        if (st.mode === 'cpu' && side === 1) continue;
        const cur = rawIn[side], prev = st.prevIn[side];
        if (press(cur, prev, 'left')) st.sel[side] = (st.sel[side] + CHAR_LIST.length - 1) % CHAR_LIST.length;
        if (press(cur, prev, 'right')) st.sel[side] = (st.sel[side] + 1) % CHAR_LIST.length;
        if (anyAttack(cur, prev)) {
          st.selDone[side] = true;
          if (st.mode === 'cpu') {
            st.sel[1] = (st.sel[0] + 1) % CHAR_LIST.length;
            st.selDone[1] = true;
          }
        }
      }
      if (st.selDone[0] && st.selDone[1]) startMatch(st);
      break;
    }
    case 'intro': {
      st.statusTimer--;
      if (st.statusTimer <= 0) st.status = 'play';
      break;
    }
    case 'play': {
      // 観戦は両側 AI、CPU 戦は片側 AI（キャラ専用 AI があれば自動で使われる）
      if (st.mode === 'demo') {
        // 観戦中に Enter でタイトルへ復帰
        if (gi.start) { Object.assign(st, createGame(st.rng)); break; }
        rawIn[0] = aiFor(st, 0);
        rawIn[1] = aiFor(st, 1);
      } else if (st.aiSide === 0) rawIn[0] = aiFor(st, 0);
      else if (st.aiSide === 1) rawIn[1] = aiFor(st, 1);

      if (st.hitstop > 0) {
        st.hitstop--;
        break; // 全体停止（エフェクトのみ進行）
      }

      st.timer--;

      const [a, b] = st.fighters;
      // 向き直し（行動可能な地上時のみ）
      for (const [f, o] of [[a, b], [b, a]] as const) {
        if (f.grounded && f.atk <= 0 && f.hitstun <= 0 && f.blockstun <= 0 && f.kd <= 0) {
          f.facing = centerX(o) >= centerX(f) ? 1 : -1;
        }
      }

      updateFighter(st, a, rawIn[0], st.prevIn[0], b);
      updateFighter(st, b, rawIn[1], st.prevIn[1], a);
      updateProjectiles(st);
      resolveHits(st, rawIn);
      bodyPush(st);

      // KO 判定
      const aDead = a.hp <= 0;
      const bDead = b.hp <= 0;
      if (aDead || bDead) {
        if (aDead && bDead) {
          // ダブル KO: 両者に加点
          a.wins++;
          b.wins++;
          launchLoser(st, a);
          launchLoser(st, b);
          st.roundMsg = 'DOUBLE K.O.';
          st.status = 'roundEnd';
          st.statusTimer = ROUND_END_FRAMES;
        } else {
          const loser = aDead ? a : b;
          launchLoser(st, loser);
          endRound(st, aDead ? 1 : 0, 'K.O.');
        }
      } else if (st.timer <= 0) {
        // タイムアップ: 体力の多い方
        const winner: Winner = a.hp > b.hp ? 0 : b.hp > a.hp ? 1 : -1;
        endRound(st, winner, winner === -1 ? 'DRAW' : 'TIME UP');
      }
      break;
    }
    case 'roundEnd': {
      st.statusTimer--;
      // スローモーションで敗者の吹き飛びを見せる
      if (st.statusTimer % 2 === 0) {
        const [a, b] = st.fighters;
        updateFighter(st, a, emptyInput(), emptyInput(), b);
        updateFighter(st, b, emptyInput(), emptyInput(), a);
        updateProjectiles(st);
      }
      if (st.statusTimer <= 0) {
        const [a, b] = st.fighters;
        // ダブル KO で両者が規定数に達したら最終ラウンドをやり直し
        if (a.wins >= WINS_NEED && b.wins >= WINS_NEED) {
          a.wins = WINS_NEED - 1;
          b.wins = WINS_NEED - 1;
          resetRound(st);
        } else if (a.wins >= WINS_NEED || b.wins >= WINS_NEED) {
          st.winner = a.wins >= WINS_NEED ? 0 : 1;
          st.status = 'matchEnd';
          st.statusTimer = 0;
        } else {
          resetRound(st);
        }
      }
      break;
    }
    case 'matchEnd': {
      st.statusTimer++;
      const p1 = rawIn[0], pv = st.prevIn[0];
      // 観戦: Enter でタイトル復帰。一定時間後に次のカードへ自動で進む。
      if (st.mode === 'demo') {
        if (st.statusTimer > 20 && gi.start) { Object.assign(st, createGame(st.rng)); break; }
        if (st.statusTimer > 150) {
          st.demoPair++;
          startDemoMatch(st);
        }
        break;
      }
      // 少し待ってから入力受付（誤爆防止）
      if (st.statusTimer > 40) {
        if (gi.start) {
          // タイトルへ（モード選択から）
          const seed = st.rng;
          const fresh = createGame(seed);
          Object.assign(st, fresh);
        } else if (anyAttack(p1, pv) || anyAttack(rawIn[1], st.prevIn[1])) {
          // 同キャラで即リマッチ
          st.fighters[0].wins = 0;
          st.fighters[1].wins = 0;
          st.fighters[0].meter = 0;
          st.fighters[1].meter = 0;
          st.round = 0;
          resetRound(st);
        }
      }
      break;
    }
  }

  st.prevIn = rawIn;
}

/** 残り秒数（HUD 表示用）。 */
export function timerSec(st: GameState): number {
  return Math.max(0, Math.ceil(st.timer / 60));
}
