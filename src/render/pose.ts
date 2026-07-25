// Fighter の状態 → 描画ポーズ（cosmetic。core には影響しない）
import { moveDef } from '../core/constants';
import type { Fighter } from '../core/types';

export interface FighterAnim {
  tick: number;
  walk: number;
}
export const createFighterAnim = (): FighterAnim => ({ tick: 0, walk: 0 });

export interface FightPose {
  sx: number;
  sy: number;
  lean: number;
  bob: number;
  /** 前腕の角度（0=前水平、負=上） */
  armRot: number;
  /** 突き出し量 */
  armExt: number;
  strideF: number;
  strideB: number;
  lift: number;
  crouch: boolean;
  lying: boolean;
  /** 空中被弾の回転角 */
  tumble: number;
  guard: boolean;
  hurt: boolean;
  /** 両腕を上げる（超必などの詠唱） */
  bothArms: boolean;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);
export const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

export function computePose(f: Fighter, anim: FighterAnim): FightPose {
  anim.tick++;
  const rest = 0.45;
  const p: FightPose = {
    sx: 1, sy: 1, lean: 0, bob: 0,
    armRot: rest + Math.sin(anim.tick * 0.08) * 0.05, armExt: 0,
    strideF: 0, strideB: 0, lift: 0,
    crouch: f.crouch,
    lying: f.kd > 0,
    tumble: 0,
    guard: f.blocking || f.blockstun > 0,
    hurt: f.hitstun > 0,
    bothArms: false,
  };

  if (p.lying) return p;

  // 被弾
  if (f.hitstun > 0) {
    if (!f.grounded) {
      p.tumble = anim.tick * 0.33;
    } else {
      p.lean = -0.22 * f.facing * 1; // のけぞり（facing 逆方向へは描画側で座標系反転済みなので負角）
      p.armRot = -0.9;
      p.armExt = -4;
    }
    return p;
  }

  // ガード
  if (p.guard) {
    p.armRot = -0.55;
    p.armExt = 2;
    p.lean = -0.06;
    return p;
  }

  const grounded = f.grounded;
  const moving = grounded && Math.abs(f.vx) > 0.4 && f.atk <= 0;
  if (moving) anim.walk += 0.11;
  p.bob = moving ? -Math.abs(Math.sin(anim.walk)) * 1.6 : -Math.sin(anim.tick * 0.055) * 0.9 - 0.5;
  p.strideF = moving ? Math.sin(anim.walk) * 2.8 : grounded ? 0 : 2.4;
  p.strideB = moving ? Math.sin(anim.walk + Math.PI) * 2.8 : grounded ? 0 : 2.4;
  p.lift = moving ? Math.max(0, Math.cos(anim.walk)) * 1.6 : 0;

  if (!grounded && f.atk <= 0) {
    p.armRot = -0.4;
    p.sy = Math.max(0.92, Math.min(1.1, 1 - f.vy * 0.008));
    p.sx = 1 - (p.sy - 1) * 0.7;
    return p;
  }

  if (f.atk > 0 && f.move) {
    const d = moveDef(f.char, f.move);
    const el = f.atkTotal - f.atk;
    const wu = clamp01(el / d.startup);
    const ac = clamp01((el - d.startup) / d.active);
    const rc = clamp01((el - d.startup - d.active) / d.recovery);
    const inWu = el < d.startup;
    const inAc = el >= d.startup && el < d.startup + d.active;

    switch (f.move) {
      case 'light':
        p.armRot = 0.08;
        p.armExt = inWu ? lerp(0, -5, wu) : inAc ? lerp(-5, 16, easeOut(ac)) : lerp(16, 0, rc);
        p.lean = p.armExt * 0.004;
        break;
      case 'clight':
        p.crouch = true;
        p.armRot = 0.6;
        p.armExt = inWu ? lerp(0, -4, wu) : inAc ? lerp(-4, 15, easeOut(ac)) : lerp(15, 0, rc);
        break;
      case 'heavy':
        p.armRot = inWu ? lerp(rest, -2.3, easeOut(wu)) : inAc ? lerp(-2.3, 1.0, ac * ac) : lerp(1.0, rest, rc);
        p.lean = Math.sin(p.armRot) * 0.07;
        break;
      case 'cheavy':
        p.crouch = true;
        p.armRot = inWu ? lerp(rest, 0.5, wu) : inAc ? lerp(0.5, 1.9, easeOut(ac)) : lerp(1.9, rest, rc);
        p.lean = 0.1;
        p.armExt = inAc ? 10 : 0;
        break;
      case 'air':
        p.armRot = inWu ? lerp(-0.4, 0.4, wu) : 0.95;
        p.armExt = inAc ? 10 : 4;
        p.lean = 0.18;
        break;
      case 'spN':
        p.armRot = inWu ? lerp(rest, -2.6, easeOut(wu)) : inAc ? lerp(-2.6, -0.05, easeOut(ac)) : lerp(-0.05, rest, rc);
        p.armExt = inAc || (!inWu && !inAc) ? 8 : 0;
        p.lean = inWu ? -0.08 : 0.06;
        break;
      case 'spF':
        p.armRot = 0.02;
        p.armExt = inWu ? lerp(0, -6, wu) : inAc ? 18 : lerp(18, 0, rc);
        p.lean = inWu ? -0.12 : inAc ? 0.24 : lerp(0.24, 0, rc);
        break;
      case 'spU':
        p.armRot = inWu ? lerp(rest, 0.8, wu) : inAc ? lerp(0.8, -2.0, easeOut(ac)) : -2.0;
        p.sy = inAc ? 1.08 : 1;
        p.sx = inAc ? 0.96 : 1;
        p.lean = inAc ? -0.1 : 0;
        p.armExt = inAc ? 10 : 0;
        break;
      case 'super':
        p.bothArms = true;
        p.armRot = inWu ? lerp(rest, -2.8, easeOut(wu)) : inAc ? lerp(-2.8, -0.2, easeOut(ac)) : -0.2;
        p.armExt = inAc ? 12 : 4;
        p.lean = inWu ? -0.1 : 0.08;
        break;
    }
    return p;
  }

  return p;
}
