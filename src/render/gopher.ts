// Go gopher の格闘描画（2d-action の実測ベース描画を移植・ポーズ拡張）
// The Go gopher was designed by Renée French. (CC BY 4.0)
import { CHARS } from '../core/constants';
import type { Fighter } from '../core/types';
import { computePose, type FighterAnim } from './pose';

type Ctx = CanvasRenderingContext2D;

// 本物の Go gopher からピクセル実測した配色
const CYAN = '#6ad7e5';
const ALT = '#c9a0f5';     // 2P カラー（ラベンダー）
const TAN = '#f6d2a2';
const OUTLINE = '#17151c';
const INK = '#111318';

/** ネイティブ描画高（足元 0 → 頭 -62）。 */
const NATIVE_H = 62;

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function paw(ctx: Ctx, x: number, y: number, flash: boolean): void {
  ctx.beginPath();
  ctx.arc(x, y, 3.8, 0, Math.PI * 2);
  ctx.fillStyle = flash ? '#ffffff' : TAN;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function arm(ctx: Ctx, sx: number, sy: number, ex: number, ey: number, flash: boolean): void {
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.lineWidth = 6.5;
  ctx.strokeStyle = OUTLINE;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = flash ? '#ffffff' : TAN;
  ctx.stroke();
  paw(ctx, ex, ey, flash);
}

export function drawGopher(ctx: Ctx, f: Fighter, anim: FighterAnim): void {
  const pose = computePose(f, anim);
  const flash = f.invul > 0 && f.kd <= 0 && Math.floor(f.invul / 3) % 2 === 1;
  const def = CHARS.gopher;
  const k = def.h / NATIVE_H;
  const cx = f.x + f.w / 2;
  const feetY = f.y + f.h;
  const body = flash ? '#ffffff' : f.alt ? ALT : CYAN;
  const tan = flash ? '#ffffff' : TAN;

  ctx.save();
  ctx.translate(cx, feetY);
  ctx.scale(f.facing, 1);

  // ダウン: 仰向けに寝転がる
  if (pose.lying) {
    ctx.scale(k, k);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, -10, 24, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    // 顔（横倒し・バツ目）
    ctx.beginPath();
    ctx.arc(16, -14, 7, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    for (const [ex0, ey0] of [[13, -16], [18, -16]] as const) {
      ctx.beginPath();
      ctx.moveTo(ex0 - 1.5, ey0 - 1.5); ctx.lineTo(ex0 + 1.5, ey0 + 1.5);
      ctx.moveTo(ex0 + 1.5, ey0 - 1.5); ctx.lineTo(ex0 - 1.5, ey0 + 1.5);
      ctx.stroke();
    }
    paw(ctx, -20, -16, false);
    paw(ctx, 6, -20, false);
    ctx.restore();
    return;
  }

  // 空中被弾: きりもみ回転
  if (pose.tumble !== 0) {
    ctx.translate(0, -f.h / 2);
    ctx.rotate(pose.tumble);
    ctx.translate(0, f.h / 2);
  }

  // しゃがみ: つぶして広げる
  const crouchSy = pose.crouch ? def.crouchH / def.h : 1;
  const crouchSx = pose.crouch ? 1.16 : 1;
  ctx.scale(k * pose.sx * crouchSx, k * pose.sy * crouchSy);
  ctx.rotate(pose.lean);

  // 足
  for (const [fx, st] of [[-9, pose.strideB], [9, pose.strideF]] as const) {
    ctx.save();
    ctx.translate(fx + st, -3 - (st > 0 ? pose.lift : 0));
    ctx.rotate(fx < 0 ? -0.28 : 0.28);
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.9, 4.4, 0, 0, Math.PI * 2);
    ctx.fillStyle = tan;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(0, pose.bob);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 耳
  for (const ex of [-15.5, 15.5]) {
    ctx.beginPath();
    ctx.arc(ex, -52, 7, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }

  // 後ろ手（超必は両腕を前へ）
  if (pose.bothArms || pose.guard) {
    const r2 = pose.armRot + 0.5;
    arm(ctx, -14, -26, -14 + Math.cos(r2) * 26, -26 + Math.sin(r2) * 26, flash);
  } else {
    arm(ctx, -16, -26, -23, -17, flash);
  }

  // 体
  rr(ctx, -17.5, -58, 35, 52, 14);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // 耳の内点
  ctx.fillStyle = OUTLINE;
  for (const ex of [-13.5, 13.5]) {
    ctx.beginPath();
    ctx.arc(ex, -50, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // 目（被弾中は ><）
  if (pose.hurt) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    for (const ex of [-5.5, 5.5]) {
      ctx.beginPath();
      ctx.moveTo(ex - 2.4, -49.5); ctx.lineTo(ex + 2.4, -45.5);
      ctx.moveTo(ex + 2.4, -49.5); ctx.lineTo(ex - 2.4, -45.5);
      ctx.stroke();
    }
  } else {
    for (const ex of [-5.5, 5.5]) {
      ctx.beginPath();
      ctx.arc(ex, -47.5, 4.9, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
    for (const ex of [-5.5, 5.5]) {
      ctx.beginPath();
      ctx.arc(ex + 1.4, -47, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + 0.5, -48.4, 0.9, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
  }

  // 鼻・口吻・出っ歯
  ctx.beginPath();
  ctx.ellipse(0, -45.5, 2.4, 1.9, 0, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -43.6, 3.3, 1.8, 0, 0, Math.PI * 2);
  ctx.fillStyle = tan;
  ctx.fill();
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  for (const tx of [-1.4, 1.4]) {
    rr(ctx, tx - 1.1, -43.5, 2.2, 3.6, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
  }

  // 前手（肩 15,-26 を軸に回転・突き出し）
  const sh = { x: 15, y: -26 };
  const reach = 11 + pose.armExt;
  const hx = sh.x + Math.cos(pose.armRot) * reach;
  const hy = sh.y + Math.sin(pose.armRot) * reach;
  arm(ctx, sh.x, sh.y, hx, hy, flash);

  // 攻撃 active 中のスピード線
  if (pose.armExt > 10) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.4;
    for (const dy of [-4, 0, 4]) {
      ctx.beginPath();
      ctx.moveTo(hx - 14, hy + dy);
      ctx.lineTo(hx - 4, hy + dy);
      ctx.stroke();
    }
  }

  ctx.restore(); // bob
  ctx.restore();
}
