import { SUPER_COST } from './constants';
import { centerX } from './physics';
import { rand01, xorshift32 } from './rng';
import type { CharId, GameState, PlayerInput, Side } from './types';

const empty = (): PlayerInput => ({ left: false, right: false, up: false, down: false, light: false, heavy: false, special: false });

/** rng を1歩進めて 0..1 を返す（決定論）。 */
function roll(st: GameState): number {
  st.rng = xorshift32(st.rng);
  return rand01(st.rng);
}

/**
 * CPU の入力生成。数フレームごとに意思決定し、その間は入力を保持する。
 * 攻撃ボタンは押した次フレームで離す（エッジ検出のため）。
 */
export function aiInput(st: GameState, side: Side): PlayerInput {
  const me = st.fighters[side];
  const op = st.fighters[(1 - side) as Side];
  const ai = st.ai[side];

  // 押しっぱなし防止: 攻撃ボタンは1フレームで離す
  if (ai.tapped) {
    ai.hold.light = false;
    ai.hold.heavy = false;
    ai.hold.special = false;
    ai.hold.up = false;
    ai.tapped = false;
  }

  if (ai.think > 0) {
    ai.think--;
    return { ...ai.hold };
  }

  const meC = centerX(me);
  const opC = centerX(op);
  const dist = Math.abs(opC - meC);
  const dir = opC >= meC ? 1 : -1; // 相手の方向
  const h = empty();
  const fwd = (): void => { if (dir > 0) h.right = true; else h.left = true; };
  const back = (): void => { if (dir > 0) h.left = true; else h.right = true; };

  // 行動不能中は考えるだけ
  if (me.hitstun > 0 || me.kd > 0 || me.atk > 0 || me.blockstun > 0) {
    ai.hold = h;
    ai.think = 4;
    return { ...h };
  }

  // 飛んでくる弾: 自分へ向かう弾が近い → ジャンプかガード
  const incoming = st.projectiles.some((p) => {
    if (p.owner === side || p.dead || p.delay > 0 || p.kind === 'oom') return false;
    const pc = centerX(p);
    const toward = (p.vx > 0 && pc < meC) || (p.vx < 0 && pc > meC);
    return toward && Math.abs(pc - meC) < 170;
  });
  if (incoming) {
    const r = roll(st);
    if (r < 0.35) { h.up = true; fwd(); ai.tapped = true; }
    else if (r < 0.8) back();
    ai.hold = h;
    ai.think = 10;
    return { ...h };
  }

  // 相手の攻撃発生中 → ガード（確率）
  if (op.atk > 0 && dist < 160) {
    if (roll(st) < 0.55) {
      back();
      if (roll(st) < 0.5) h.down = true; // 下段対応の 50/50
      ai.hold = h;
      ai.think = 8;
      return { ...h };
    }
  }

  // 対空: 相手がジャンプで接近
  if (!op.grounded && dist < 130) {
    if (roll(st) < 0.6) {
      h.special = true;
      h.up = true;
      ai.tapped = true;
      ai.hold = h;
      ai.think = 12;
      return { ...h };
    }
  }

  // 超必殺: ゲージ MAX で近距離
  if (me.meter >= SUPER_COST && dist < 190 && roll(st) < 0.25) {
    h.special = true;
    h.heavy = true;
    ai.tapped = true;
    ai.hold = h;
    ai.think = 14;
    return { ...h };
  }

  const r = roll(st);
  if (dist > 280) {
    // 遠距離: 弾か接近
    if (r < 0.4) { h.special = true; ai.tapped = true; }
    else if (r < 0.75) fwd();
    else if (r < 0.87) { h.up = true; fwd(); ai.tapped = true; }
    ai.think = 12;
  } else if (dist > 130) {
    // 中距離: 差し込み
    if (r < 0.42) fwd();
    else if (r < 0.57) { h.special = true; fwd(); ai.tapped = true; } // 突進
    else if (r < 0.7) { h.up = true; fwd(); ai.tapped = true; }      // 飛び込み
    else if (r < 0.8) { h.special = true; ai.tapped = true; }        // 弾
    else if (r < 0.9) back();
    ai.think = 10;
  } else {
    // 近距離: 攻める
    if (r < 0.34) { h.light = true; ai.tapped = true; }
    else if (r < 0.52) { h.heavy = true; ai.tapped = true; }
    else if (r < 0.62) { h.down = true; h.heavy = true; ai.tapped = true; } // 足払い
    else if (r < 0.72) { h.down = true; h.light = true; ai.tapped = true; }
    else if (r < 0.84) back();
    else fwd();
    ai.think = 9;
  }
  ai.hold = h;
  return { ...h };
}

// ============================================================================
// キャラ専用 AI — 各キャラの強みを最大化する行動ロジック。
// 汎用 aiInput() はそのまま残し、CUSTOM_AI に登録されたキャラだけ差し替える。
// ============================================================================

/**
 * GOPHER 専用 AI — 軽量ラッシュ＋弱ヒット確認キャンセルを主軸にする。
 *   ・最速の足回りでとにかく密着し、弱で固める。
 *   ・弱がヒットした瞬間（me.cancel>0）だけ必殺／超必へキャンセルして火力を取る
 *     ＝ヒット確認なのでガードされた弱には必殺を漏らさない（無駄撃ちしない）。
 *   ・接近手段に Channel Rush（前+必殺）と前ジャンプ、割り込みに panic()（無敵対空）。
 */
export function gopherAI(st: GameState, side: Side): PlayerInput {
  const me = st.fighters[side];
  const op = st.fighters[(1 - side) as Side];
  const ai = st.ai[side];

  if (ai.tapped) {
    ai.hold.light = false; ai.hold.heavy = false; ai.hold.special = false; ai.hold.up = false;
    ai.tapped = false;
  }

  const meC = centerX(me);
  const opC = centerX(op);
  const dist = Math.abs(opC - meC);
  const dir = opC >= meC ? 1 : -1;
  const h = empty();
  const fwd = (): void => { if (dir > 0) h.right = true; else h.left = true; };
  const back = (): void => { if (dir > 0) h.left = true; else h.right = true; };
  const commit = (think: number): PlayerInput => { ai.hold = h; ai.think = think; return { ...h }; };

  // ① 弱ヒット確認キャンセル（最優先・think を無視）。cancel 窓は弱が当たった時だけ開く。
  if (me.atk > 0 && me.cancel > 0) {
    h.special = true;
    const r = roll(st);
    if (me.meter >= SUPER_COST && r < 0.5) h.heavy = true; // 超必殺キャンセル（special+heavy）
    else if (r < 0.75) fwd();                               // Channel Rush（前・ダウン奪取・最良）
    else h.up = true;                                       // panic（打ち上げ）
    ai.tapped = true;
    return commit(4);
  }

  if (ai.think > 0) { ai.think--; return { ...ai.hold }; }

  // 行動不能中（キャンセル局面は①で処理済）は待つ
  if (me.hitstun > 0 || me.kd > 0 || me.atk > 0 || me.blockstun > 0) return commit(3);

  // ② 対空 panic()（無敵対空を信頼して振る＝Gopher 自身の迎撃）
  if (!op.grounded && dist < 155 && roll(st) < 0.8) {
    h.special = true; h.up = true; ai.tapped = true; return commit(12);
  }

  // ③ 相手の攻撃を近〜中距離ではガードで受ける（軽量ゆえ被弾を最小化）
  if (op.atk > 0 && dist < 150 && roll(st) < 0.66) {
    back(); if (roll(st) < 0.5) h.down = true; return commit(6);
  }

  // ④ 飛び道具は跳ばずに処理（飛び込みは対空で狩られるので封印）:
  //    遠ければ Channel Rush で地を這って潜り込み、近ければガード。
  const incoming = st.projectiles.some((p) => {
    if (p.owner === side || p.dead || p.delay > 0 || p.kind === 'oom' || p.kind === 'beam') return false;
    const pc = centerX(p);
    const toward = (p.vx > 0 && pc < meC) || (p.vx < 0 && pc > meC);
    return toward && Math.abs(pc - meC) < 210;
  });
  if (incoming) {
    if (dist > 150 && roll(st) < 0.5) { h.special = true; fwd(); ai.tapped = true; } // Channel Rush 突進
    else back();                                                                     // ガード
    return commit(8);
  }

  const r = roll(st);
  if (dist < 80) {
    // 近距離: 弱主体のラッシュ＝キャンセル起点を量産（飛び込みは一切しない）
    if (r < 0.52) { h.light = true; ai.tapped = true; }                       // 立ち弱（最頻・cancel 起点）
    else if (r < 0.74) { h.down = true; h.light = true; ai.tapped = true; }   // しゃがみ弱（下段・起点）
    else if (r < 0.85) { h.heavy = true; ai.tapped = true; }                  // 立ち強
    else if (r < 0.93) { h.down = true; h.heavy = true; ai.tapped = true; }   // 足払い（ダウン）
    else fwd();                                                                // 密着維持
    return commit(5);
  }
  if (dist < 200) {
    // 中距離: 地上で密着を作る。Channel Rush で一気に間合いを潰す（飛ばない）
    if (r < 0.5) fwd();
    else if (r < 0.82) { h.special = true; fwd(); ai.tapped = true; } // Channel Rush 突進
    else fwd();
    return commit(6);
  }
  // 遠距離: 歩いて詰めつつ、Channel Rush と go routine で択をかける
  if (r < 0.5) fwd();
  else if (r < 0.78) { h.special = true; fwd(); ai.tapped = true; } // Channel Rush で距離詰め
  else { h.special = true; ai.tapped = true; }                       // go routine 牽制
  return commit(8);
}

/** キャラ専用 AI の登録表。未登録キャラは汎用 aiInput() を使う。 */
const CUSTOM_AI: Partial<Record<CharId, (st: GameState, side: Side) => PlayerInput>> = {
  gopher: gopherAI,
};

/** そのキャラに専用 AI があるか（HUD 表示・観戦の可視化用）。 */
export function hasCustomAI(char: CharId): boolean {
  return char in CUSTOM_AI;
}

/** キャラに応じた AI を呼ぶディスパッチャ（専用があれば専用、無ければ汎用）。 */
export function aiFor(st: GameState, side: Side): PlayerInput {
  const fn = CUSTOM_AI[st.fighters[side].char];
  return fn ? fn(st, side) : aiInput(st, side);
}

export const emptyInput = empty;
