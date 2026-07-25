import { BUFFER_WINDOW, CHARS, FLOOR_Y, FRICTION, GRAV, KD_FRAMES, SUPER_COST, WAKEUP_INVUL, WALL_L, WALL_R, moveDef } from './constants';
import { centerX, clamp } from './physics';
import type { CharId, Facing, Fighter, GameState, MoveId, PlayerInput, Side } from './types';

export function createFighter(side: Side, char: CharId, x: number, facing: Facing, alt: boolean): Fighter {
  const d = CHARS[char];
  return {
    side, char,
    x, y: FLOOR_Y - d.h, w: d.w, h: d.h,
    vx: 0, vy: 0, grounded: true, facing,
    hp: d.hp, maxhp: d.hp, meter: 0,
    crouch: false,
    atk: 0, atkTotal: 0, move: null, atkId: 0, atkHit: false,
    hitstun: 0, blockstun: 0, blocking: false,
    kd: 0, kdPending: false, invul: 0, juggle: 0,
    airAtk: false, airVx: 0,
    buf: null, cancel: 0,
    wins: 0, alt,
  };
}

/** ラウンド開始時のリセット（wins/meter/char は保持）。 */
export function resetFighter(f: Fighter, x: number, facing: Facing): void {
  const d = CHARS[f.char];
  f.x = x; f.y = FLOOR_Y - d.h; f.w = d.w; f.h = d.h;
  f.vx = 0; f.vy = 0; f.grounded = true; f.facing = facing;
  f.hp = f.maxhp;
  f.crouch = false;
  f.atk = 0; f.atkTotal = 0; f.move = null; f.atkHit = false;
  f.hitstun = 0; f.blockstun = 0; f.blocking = false;
  f.kd = 0; f.kdPending = false; f.invul = 0; f.juggle = 0;
  f.airAtk = false; f.airVx = 0; f.buf = null; f.cancel = 0;
}

const press = (cur: PlayerInput, prev: PlayerInput, k: 'left' | 'right' | 'up' | 'down' | 'light' | 'heavy' | 'special'): boolean =>
  cur[k] && !prev[k];

/** 技を開始する。ゲージ消費・無敵付与もここで。 */
export function startMove(f: Fighter, id: MoveId): void {
  const d = moveDef(f.char, id);
  f.move = id;
  f.atkTotal = d.startup + d.active + d.recovery;
  f.atk = f.atkTotal;
  f.atkId++;
  f.atkHit = false;
  f.buf = null;
  f.cancel = 0;
  if (f.grounded) f.vx = 0;
  if (d.invul) f.invul = Math.max(f.invul, d.invul);
  if (id === 'super') f.meter = Math.max(0, f.meter - SUPER_COST);
}

/** 攻撃の経過フレーム（0=開始直後）。 */
export const attackElapsed = (f: Fighter): number => f.atkTotal - f.atk;

/** 現在 active フレーム中か。 */
export function inActive(f: Fighter): boolean {
  if (f.atk <= 0 || !f.move) return false;
  const d = moveDef(f.char, f.move);
  const el = attackElapsed(f);
  return el >= d.startup && el < d.startup + d.active;
}

/** 入力から出す技を決める（優先: 超必 > 必殺 > 強 > 弱）。null=技なし。 */
export function chooseMove(f: Fighter, inp: PlayerInput, prev: PlayerInput, opp: Fighter): MoveId | null {
  const dir: Facing = centerX(opp) >= centerX(f) ? 1 : -1;
  const fwd = dir > 0 ? inp.right : inp.left;
  const spEdge = press(inp, prev, 'special');
  const hvEdge = press(inp, prev, 'heavy');
  const ltEdge = press(inp, prev, 'light');
  // 超必殺: 必殺＋強の同時系（片方エッジ＋もう片方押下）
  if (f.meter >= SUPER_COST && ((spEdge && inp.heavy) || (hvEdge && inp.special))) return 'super';
  if (spEdge) {
    if (inp.up) return 'spU';
    if (fwd && !inp.down) return 'spF';
    return 'spN';
  }
  if (hvEdge) return inp.down ? 'cheavy' : 'heavy';
  if (ltEdge) return inp.down ? 'clight' : 'light';
  return null;
}

/** 飛び道具の発射（active 先頭フレームに game 側から呼ばれる）。 */
function spawnProjectiles(st: GameState, f: Fighter): void {
  if (!f.move) return;
  const d = moveDef(f.char, f.move);
  if (!d.projectile) return;
  const dir = f.facing;
  const feet = f.y + f.h;
  const base = {
    owner: f.side,
    dmg: d.dmg, chip: d.chip,
    hitstun: d.hitstun, blockstun: d.blockstun,
    kbx: d.kbx, kby: d.kby, level: d.level, knockdown: d.knockdown,
    dead: false, hitstop: d.hitstop, meterGain: d.meterGain,
  };
  const pid = (i = 0): number => f.side * 1_000_000 + f.atkId * 100 + i;
  const P0 = { vy: 0, delay: 0, grav: 0, ax: 0 }; // 直進弾の既定（振動なし）
  if (f.move === 'spN') {
    if (f.char === 'gopher') {
      // go routine(): 速い小型弾
      st.projectiles.push({
        ...base, ...P0, kind: 'gofunc',
        x: dir > 0 ? f.x + f.w : f.x - 26, y: feet - 62, w: 26, h: 18,
        vx: 6.2 * dir, life: 180, id: pid(),
      });
    } else if (f.char === 'duke') {
      // NullPointerException: 遅い巨弾
      st.projectiles.push({
        ...base, ...P0, kind: 'null',
        x: dir > 0 ? f.x + f.w : f.x - 34, y: feet - 72, w: 34, h: 26,
        vx: 4.2 * dir, life: 220, id: pid(),
      });
    } else if (f.char === 'ferris') {
      // cargo throw: 放物線で落ちるクレート
      st.projectiles.push({
        ...base, ...P0, kind: 'crate',
        x: dir > 0 ? f.x + f.w : f.x - 24, y: feet - 80, w: 24, h: 22,
        vx: 4.6 * dir, vy: -7.2, life: 240, grav: 0.38, id: pid(),
      });
    } else if (f.char === 'tux') {
      // Pipe | Stream: 地を這う下段弾（しゃがみガード必須）
      st.projectiles.push({
        ...base, ...P0, kind: 'pipe',
        x: dir > 0 ? f.x + f.w : f.x - 30, y: feet - 14, w: 30, h: 14,
        vx: 5.5 * dir, life: 200, id: pid(),
      });
    } else if (f.char === 'deno') {
      // fetch(): 速い web リクエスト弾
      st.projectiles.push({
        ...base, ...P0, kind: 'fetch',
        x: dir > 0 ? f.x + f.w : f.x - 30, y: feet - 60, w: 30, h: 18,
        vx: 6.6 * dir, life: 190, id: pid(),
      });
    } else if (f.char === 'gnu') {
      // Recursive GNU: 往復するブーメラン弾（ax で戻ってくる）
      st.projectiles.push({
        ...base, ...P0, kind: 'boomerang',
        x: dir > 0 ? f.x + f.w : f.x - 24, y: feet - 58, w: 24, h: 24,
        vx: 7.2 * dir, life: 150, ax: -0.28 * dir, id: pid(),
      });
    } else {
      // bun install: 速い荷物（パッケージ箱）弾
      st.projectiles.push({
        ...base, ...P0, kind: 'pkg',
        x: dir > 0 ? f.x + f.w : f.x - 24, y: feet - 58, w: 24, h: 22,
        vx: 6.4 * dir, life: 190, id: pid(),
      });
    }
  } else if (f.move === 'super') {
    if (f.char === 'gopher') {
      // GOROUTINE SWARM: 時間差5連弾（上下に散る）
      const spread = [0, -0.7, 0.7, -1.3, 1.3];
      for (let i = 0; i < 5; i++) {
        st.projectiles.push({
          ...base, ...P0, kind: 'swarm',
          x: dir > 0 ? f.x + f.w : f.x - 22, y: feet - 58 - i * 4, w: 22, h: 14,
          vx: 7 * dir, vy: spread[i]!, life: 160, delay: i * 7, id: pid(i),
        });
      }
    } else if (f.char === 'duke') {
      // OutOfMemoryError: 自分中心の拡大ブラスト
      const cx = centerX(f);
      st.projectiles.push({
        ...base, ...P0, kind: 'oom',
        x: cx - 30, y: feet - 90 - 30, w: 60, h: 60,
        vx: 0, life: 42, id: pid(),
      });
      st.shake = Math.max(st.shake, 14);
    } else if (f.char === 'tux') {
      // KERNEL PANIC: 画面を横断する巨大ビーム
      st.projectiles.push({
        ...base, ...P0, kind: 'beam',
        x: dir > 0 ? f.x + f.w : f.x - 96, y: feet - 96, w: 96, h: 78,
        vx: 9 * dir, life: 140, id: pid(),
      });
      st.shake = Math.max(st.shake, 12);
    } else if (f.char === 'deno') {
      // DENO DEPLOY: 画面上から時間差で降る TS の雨（発生源に無敵は無いが自分には当たらない）
      for (let i = 0; i < 6; i++) {
        const rx = 90 + i * 110;
        st.projectiles.push({
          ...base, ...P0, kind: 'rain',
          x: rx - 12, y: -30 - i * 10, w: 24, h: 30,
          vx: 0, vy: 2.5, life: 200, delay: i * 6, grav: 0.34, id: pid(i),
        });
      }
      st.shake = Math.max(st.shake, 8);
    } else if (f.char === 'gnu') {
      // GPL CASCADE: 回転する巨大コピーレフト弾
      st.projectiles.push({
        ...base, ...P0, kind: 'gpl',
        x: dir > 0 ? f.x + f.w : f.x - 52, y: feet - 84, w: 52, h: 52,
        vx: 4.4 * dir, life: 200, id: pid(),
      });
      st.shake = Math.max(st.shake, 12);
    } else if (f.char === 'bun') {
      // ALL-IN-ONE: 荷物(pkg)の時間差5連射
      const spread = [-6, -2, 2, 6, 0];
      for (let i = 0; i < 5; i++) {
        st.projectiles.push({
          ...base, ...P0, kind: 'pkg',
          x: dir > 0 ? f.x + f.w : f.x - 22, y: feet - 60 + spread[i]!, w: 22, h: 20,
          vx: 8 * dir, life: 150, delay: i * 6, id: pid(i),
        });
      }
      st.shake = Math.max(st.shake, 8);
    }
    // ferris の super（unsafe { }）は近接掴みなので弾は出ない
  }
}

/**
 * 1体分のフレーム更新（play 中のみ呼ぶ）。
 * 移動・ジャンプ・技の開始と進行・ダウン/硬直の消化。ヒット解決は combat 側。
 */
export function updateFighter(st: GameState, f: Fighter, inp: PlayerInput, prev: PlayerInput, opp: Fighter): void {
  const def = CHARS[f.char];
  if (f.invul > 0) f.invul--;

  // ---- ダウン中: 寝て起きるだけ（無敵） ----
  if (f.kd > 0) {
    f.kd--;
    f.crouch = false;
    f.vx *= FRICTION;
    f.x += f.vx;
    if (f.kd === 0) f.invul = WAKEUP_INVUL;
    clampToStage(f);
    return;
  }

  // ---- のけぞり中 ----
  if (f.hitstun > 0) {
    f.hitstun--;
    airborneOrSlide(f);
    // 打ち上げ着地 → ダウンへ
    if (f.grounded && f.kdPending) {
      f.kdPending = false;
      f.hitstun = 0;
      f.kd = KD_FRAMES;
      f.juggle = 0;
    }
    if (f.hitstun === 0 && f.grounded) f.juggle = 0;
    clampToStage(f);
    return;
  }

  // ---- ガード硬直中 ----
  if (f.blockstun > 0) {
    f.blockstun--;
    f.blocking = true;
    f.vx *= FRICTION;
    f.x += f.vx;
    clampToStage(f);
    return;
  }
  f.blocking = false;

  // ---- 攻撃中 ----
  if (f.atk > 0 && f.move) {
    const d = moveDef(f.char, f.move);
    const el = attackElapsed(f);
    // active 先頭で飛び道具発射
    if (el === d.startup) spawnProjectiles(st, f);
    // 突進技は active 中に前進
    if (d.lunge && el >= d.startup && el < d.startup + d.active) {
      f.x += d.lunge * f.facing;
    }
    // 空中攻撃は落下継続・着地で技終了
    if (f.move === 'air') {
      applyAirPhysics(f);
      if (f.grounded) { f.atk = 0; f.move = null; }
    }
    if (f.atk > 0) {
      f.atk--;
      // 先行入力（硬直終盤）
      if (f.atk <= BUFFER_WINDOW && f.atk > 0) {
        const m = chooseMove(f, inp, prev, opp);
        if (m && (m !== 'super' || f.meter >= SUPER_COST)) f.buf = m;
      }
      // 弱ヒット後の必殺キャンセル
      if (f.cancel > 0) {
        f.cancel--;
        const m = chooseMove(f, inp, prev, opp);
        if (m === 'spN' || m === 'spF' || m === 'spU' || m === 'super') {
          startMove(f, m);
          clampToStage(f);
          return;
        }
      }
      if (f.atk === 0) {
        f.move = null;
        if (f.buf && f.grounded) {
          const b = f.buf;
          f.buf = null;
          startMove(f, b);
        }
      }
    }
    clampToStage(f);
    return;
  }

  // ---- 行動可能 ----
  const dir: Facing = centerX(opp) >= centerX(f) ? 1 : -1;

  if (!f.grounded) {
    // 空中: ジャンプ攻撃のみ可能
    if (!f.airAtk && (press(inp, prev, 'light') || press(inp, prev, 'heavy'))) {
      f.airAtk = true;
      startMove(f, 'air');
    }
    applyAirPhysics(f);
    clampToStage(f);
    return;
  }

  // 地上
  f.crouch = inp.down;
  const wantMove = chooseMove(f, inp, prev, opp);
  if (wantMove) {
    f.crouch = inp.down;
    startMove(f, wantMove);
    updateHeight(f, def.h, def.crouchH);
    clampToStage(f);
    return;
  }

  if (press(inp, prev, 'up') && !f.crouch) {
    f.grounded = false;
    f.vy = def.jumpVy;
    f.airVx = inp.left ? -def.jumpVx : inp.right ? def.jumpVx : 0;
    f.airAtk = false;
    applyAirPhysics(f);
    clampToStage(f);
    return;
  }

  if (f.crouch) {
    f.vx = 0;
  } else if (inp.left || inp.right) {
    const toward = (dir > 0 && inp.right) || (dir < 0 && inp.left);
    const speed = toward ? def.walkF : def.walkB;
    f.vx = (inp.right ? 1 : -1) * speed;
  } else {
    f.vx = 0;
  }
  f.x += f.vx;

  // 相手が攻撃中に後ろ入力ならガードポーズ（描画用。実判定は combat 側）
  f.blocking = (opp.atk > 0 || st.projectiles.some((p) => p.owner !== f.side && !p.dead && p.delay <= 0)) &&
    ((dir > 0 && inp.left) || (dir < 0 && inp.right));

  updateHeight(f, def.h, def.crouchH);
  clampToStage(f);
}

/** しゃがみ切替で足元を維持したまま高さを変える。 */
function updateHeight(f: Fighter, standH: number, crouchH: number): void {
  const feet = f.y + f.h;
  f.h = f.crouch && f.grounded ? crouchH : standH;
  f.y = feet - f.h;
}

function applyAirPhysics(f: Fighter): void {
  f.vy += GRAV;
  f.y += f.vy;
  f.x += f.airVx;
  if (f.y + f.h >= FLOOR_Y) {
    f.y = FLOOR_Y - f.h;
    f.vy = 0;
    f.grounded = true;
    f.airVx = 0;
    f.airAtk = false;
  }
}

/** のけぞり中の物理（空中なら落下、地上なら滑り）。 */
function airborneOrSlide(f: Fighter): void {
  if (!f.grounded) {
    f.vy += GRAV;
    f.y += f.vy;
    f.x += f.vx;
    if (f.y + f.h >= FLOOR_Y) {
      f.y = FLOOR_Y - f.h;
      f.vy = 0;
      f.grounded = true;
    }
  } else {
    f.vx *= FRICTION;
    f.x += f.vx;
  }
}

export function clampToStage(f: Fighter): void {
  f.x = clamp(f.x, WALL_L, WALL_R - f.w);
}
