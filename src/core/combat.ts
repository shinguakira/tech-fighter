import { CANCEL_WINDOW, FLOOR_Y, JUGGLE_DECAY, METER_BLOCK_RATE, METER_MAX, METER_TAKEN_RATE, W, WALL_L, WALL_R, moveDef } from './constants';
import { attackElapsed, inActive } from './fighter';
import { aabb, centerX, intersectCenter, sign1 } from './physics';
import type { Facing, Fighter, GameState, HitLevel, MoveDef, PlayerInput, Projectile, Rect, Side } from './types';

/** 近接技の現在のヒットボックス（active 中でなければ null）。 */
export function attackHitbox(f: Fighter): Rect | null {
  if (!f.move) return null;
  const d = moveDef(f.char, f.move);
  if (d.range <= 0 || !inActive(f)) return null;
  const feet = f.y + f.h;
  return {
    x: f.facing > 0 ? f.x + f.w : f.x - d.range,
    w: d.range,
    y: feet + d.hitY,
    h: d.hitH,
  };
}

/** 被弾可能か（ダウン・無敵・KO は不可）。 */
export function hittable(f: Fighter): boolean {
  return f.hp > 0 && f.kd <= 0 && f.invul <= 0;
}

/**
 * ガード成立判定。地上・非攻撃中・相手と反対へ入力・レベル一致（low=しゃがみ / high=立ち）。
 * grab はガード不能。
 */
export function isBlocking(def: Fighter, inp: PlayerInput, attackDir: Facing, level: HitLevel): boolean {
  if (level === 'grab') return false;
  if (!def.grounded || def.atk > 0 || def.hitstun > 0 || def.kd > 0) return false;
  // attackDir=攻撃の進行方向（攻撃者→防御者）。離れる入力＝進行方向と同じ向き。
  const away = attackDir > 0 ? inp.right : inp.left;
  if (!away) return false;
  if (level === 'low' && !inp.down) return false;
  if (level === 'high' && inp.down) return false;
  return true;
}

interface HitSpec {
  dmg: number;
  chip: number;
  hitstun: number;
  blockstun: number;
  kbx: number;
  kby: number;
  level: HitLevel;
  knockdown: boolean;
  hitstop: number;
  meterGain: number;
}

const specOf = (d: MoveDef | Projectile): HitSpec => ({
  dmg: d.dmg, chip: d.chip, hitstun: d.hitstun, blockstun: d.blockstun,
  kbx: d.kbx, kby: d.kby, level: d.level, knockdown: d.knockdown,
  hitstop: d.hitstop, meterGain: d.meterGain,
});

/** ヒット/ガードの適用。戻り値=ガードされたか。 */
export function applyHit(
  st: GameState,
  attacker: Fighter | null,
  def: Fighter,
  spec: HitSpec,
  dir: Facing,
  at: { x: number; y: number },
  defInp: PlayerInput,
): boolean {
  const blocked = isBlocking(def, defInp, dir, spec.level);
  const atkF = attacker;

  if (blocked) {
    def.hp = Math.max(0, def.hp - spec.chip);
    def.blockstun = spec.blockstun;
    def.blocking = true;
    def.vx = dir * spec.kbx * 0.7;
    def.meter = Math.min(METER_MAX, def.meter + spec.meterGain * METER_BLOCK_RATE);
    if (atkF) atkF.meter = Math.min(METER_MAX, atkF.meter + spec.meterGain * 0.5);
    st.effects.push({ kind: 'block', x: at.x, y: at.y, t: 0, total: 14, dir });
    st.hitstop = Math.max(st.hitstop, Math.max(2, spec.hitstop - 3));
  } else {
    def.hp = Math.max(0, def.hp - spec.dmg);
    def.hitstun = spec.hitstun;
    def.blockstun = 0;
    def.blocking = false;
    def.crouch = false;
    // 攻撃を潰す
    def.atk = 0; def.move = null; def.buf = null; def.cancel = 0;
    // ノックバック・打ち上げ（空中コンボは逓減）
    def.vx = dir * spec.kbx;
    if (spec.kby < 0 || !def.grounded) {
      const launch = spec.kby < 0 ? spec.kby : -3.5;
      def.vy = launch / (1 + def.juggle * JUGGLE_DECAY);
      def.grounded = false;
      def.juggle++;
      def.kdPending = true; // 空中で食らったら必ずダウンで着地
    } else if (spec.knockdown) {
      // 地上ノックダウン技（足払い）: 小さく浮かせて転ばせる
      def.vy = -3.5;
      def.grounded = false;
      def.kdPending = true;
    }
    def.meter = Math.min(METER_MAX, def.meter + spec.meterGain * METER_TAKEN_RATE);
    if (atkF) atkF.meter = Math.min(METER_MAX, atkF.meter + spec.meterGain);
    st.effects.push({ kind: 'spark', x: at.x, y: at.y, t: 0, total: 16, dir });
    st.hitstop = Math.max(st.hitstop, spec.hitstop);
    if (spec.dmg >= 10) st.shake = Math.max(st.shake, 8);
  }

  // 画面端: 押し込めない分は攻撃者が離れる（端攻めの圧を残しつつめり込み防止）
  const defC = centerX(def);
  if (atkF && ((dir > 0 && defC > WALL_R - 50) || (dir < 0 && defC < WALL_L + 50))) {
    atkF.vx = -dir * spec.kbx * 0.6;
  }
  return blocked;
}

/**
 * ヒット解決（play 中のみ）。近接 → 飛び道具 → 弾同士の相殺。
 */
export function resolveHits(st: GameState, inputs: [PlayerInput, PlayerInput]): void {
  const [a, b] = st.fighters;

  // 近接攻撃: 相打ちを公平にするため、両者の当たりを確定してから同時適用
  // （先の適用が相手の move を潰すので MoveDef はここで捕捉しておく）
  const pending: { atkF: Fighter; defF: Fighter; d: MoveDef; at: { x: number; y: number } }[] = [];
  for (const [atkF, defF] of [[a, b], [b, a]] as const) {
    if (atkF.atkHit || !atkF.move) continue;
    const hb = attackHitbox(atkF);
    if (!hb || !hittable(defF)) continue;
    if (!aabb(hb, defF)) continue;
    const d = moveDef(atkF.char, atkF.move);
    // 掴みは空中の相手には当たらない（対グラップラーの逃げ道）
    if (d.level === 'grab' && !defF.grounded) continue;
    pending.push({ atkF, defF, d, at: intersectCenter(hb, defF) });
  }
  for (const { atkF, defF, d, at } of pending) {
    const dir = sign1(centerX(defF) - centerX(atkF), atkF.facing);
    const cancelable = d.id === 'light' || d.id === 'clight';
    const blocked = applyHit(st, atkF, defF, specOf(d), dir, at, inputs[defF.side]);
    atkF.atkHit = true;
    // 弱のヒットは必殺へキャンセル可能（相打ちで自分も食らった場合は除く）
    if (!blocked && cancelable && atkF.hitstun <= 0) {
      atkF.cancel = CANCEL_WINDOW;
    }
  }

  // 飛び道具 vs 本体
  for (const p of st.projectiles) {
    if (p.dead || p.delay > 0) continue;
    const defF = st.fighters[(1 - p.owner) as Side];
    const owner = st.fighters[p.owner];
    if (!hittable(defF) || !aabb(p, defF)) continue;
    const dir = sign1(centerX(defF) - centerX(p), owner.facing);
    const at = intersectCenter(p, defF);
    applyHit(st, owner, defF, specOf(p), dir, at, inputs[defF.side]);
    p.dead = true;
  }

  // 弾同士の相殺（超必系 oom / beam / gpl / rain は打ち消されない）
  const solid = (k: string): boolean => k === 'oom' || k === 'beam' || k === 'gpl' || k === 'rain';
  for (const p of st.projectiles) {
    if (p.dead || solid(p.kind) || p.delay > 0) continue;
    for (const q of st.projectiles) {
      if (q === p || q.dead || solid(q.kind) || q.delay > 0) continue;
      if (q.owner !== p.owner && aabb(p, q)) {
        p.dead = true;
        q.dead = true;
        const c = intersectCenter(p, q);
        st.effects.push({ kind: 'spark', x: c.x, y: c.y, t: 0, total: 14, dir: 1 });
      }
    }
  }
}

/** 飛び道具の移動・寿命。oom は中心固定で拡大、crate は放物線で床に落ちて消える。 */
export function updateProjectiles(st: GameState): void {
  for (const p of st.projectiles) {
    if (p.dead) continue;
    if (p.delay > 0) { p.delay--; continue; }
    if (p.kind === 'oom') {
      // 拡大ブラスト: 中心を保ったまま成長
      const grow = 5.4;
      p.x -= grow / 2; p.y -= grow / 2;
      p.w += grow; p.h += grow;
    } else {
      if (p.grav) p.vy += p.grav;
      if (p.ax) p.vx += p.ax; // boomerang: 初速と逆向きに加速して戻る
      p.x += p.vx;
      p.y += p.vy;
      // 放物線弾（crate/rain）は床で砕けて消える
      if (p.grav && p.y + p.h >= FLOOR_Y) {
        p.dead = true;
        st.effects.push({ kind: 'dust', x: p.x + p.w / 2, y: FLOOR_Y - 4, t: 0, total: 14, dir: p.vx >= 0 ? 1 : -1 });
      }
    }
    p.life--;
    if (p.life <= 0 || p.x + p.w < -60 || p.x > W + 60) p.dead = true;
  }
  st.projectiles = st.projectiles.filter((p) => !p.dead || p.life > -20);
}

/** 本体同士の押し合い（重なったら左右に押し出す）。 */
export function bodyPush(st: GameState): void {
  const [a, b] = st.fighters;
  if (a.kd > 0 || b.kd > 0) return; // ダウン中はすり抜け（起き攻め位置調整のため）
  if (!aabb(a, b)) return;
  const overlap = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const half = overlap / 2 + 0.5;
  if (centerX(a) <= centerX(b)) { a.x -= half; b.x += half; }
  else { a.x += half; b.x -= half; }
}

/** 攻撃の進行段階（描画用）: windup / active / recovery / null。 */
export function attackPhase(f: Fighter): 'windup' | 'active' | 'recovery' | null {
  if (f.atk <= 0 || !f.move) return null;
  const d = moveDef(f.char, f.move);
  const el = attackElapsed(f);
  if (el < d.startup) return 'windup';
  if (el < d.startup + d.active) return 'active';
  return 'recovery';
}
