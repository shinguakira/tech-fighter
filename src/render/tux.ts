// Tux（Linux のペンギン）の格闘描画。
// Tux by Larry Ewing (lewing@isc.tamu.edu) and The GIMP — 使用・改変自由（クレジット表記）。
// 黒い卵型の体・白い腹・オレンジのくちばしと水かき足・満足げな目つきが特徴。
import { CHARS } from '../core/constants';
import type { Fighter } from '../core/types';
import { computePose, type FighterAnim } from './pose';

type Ctx = CanvasRenderingContext2D;

const BODY = '#16161c';
const BODY_ALT = '#3a2a5e';   // 2P カラー（ナイトパープル）
const BELLY = '#f2f2f4';
const ORANGE = '#f7a41d';
const ORANGE_ALT = '#ffd24a';
const OUTLINE = '#08080c';
const INK = '#101014';

/** ネイティブ描画高（足元 0 → 頭頂 -58）。 */
const NATIVE_H = 58;

function foot(ctx: Ctx, x: number, y: number, rot: number, orange: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.ellipse(0, 0, 7.4, 3.6, 0, 0, Math.PI * 2);
  ctx.fillStyle = orange;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  // 水かきの切れ込み
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(2, -3); ctx.lineTo(2, 2.6);
  ctx.moveTo(5, -2.4); ctx.lineTo(5, 2);
  ctx.stroke();
  ctx.restore();
}

function flipper(ctx: Ctx, body: string, sx: number, sy: number, ex: number, ey: number): void {
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.lineWidth = 7;
  ctx.strokeStyle = OUTLINE;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineWidth = 4.6;
  ctx.strokeStyle = body;
  ctx.stroke();
}

export function drawTux(ctx: Ctx, f: Fighter, anim: FighterAnim): void {
  const pose = computePose(f, anim);
  const flash = f.invul > 0 && f.kd <= 0 && Math.floor(f.invul / 3) % 2 === 1;
  const def = CHARS.tux;
  const k = def.h / NATIVE_H;
  const cx = f.x + f.w / 2;
  const feetY = f.y + f.h;
  const body = flash ? '#9a9aa6' : f.alt ? BODY_ALT : BODY;
  const belly = flash ? '#ffffff' : BELLY;
  const orange = flash ? '#ffffff' : f.alt ? ORANGE_ALT : ORANGE;

  ctx.save();
  ctx.translate(cx, feetY);
  ctx.scale(f.facing, 1);

  // ダウン: 仰向け（腹が上）
  if (pose.lying) {
    ctx.scale(k, k);
    ctx.beginPath();
    ctx.ellipse(0, -10, 24, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(-2, -12, 15, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = belly;
    ctx.fill();
    // くちばしが上を向く
    ctx.beginPath();
    ctx.moveTo(17, -16); ctx.lineTo(24, -13); ctx.lineTo(17, -11);
    ctx.closePath();
    ctx.fillStyle = orange;
    ctx.fill();
    ctx.stroke();
    foot(ctx, -18, -14, -0.5, orange);
    ctx.restore();
    return;
  }

  if (pose.tumble !== 0) {
    ctx.translate(0, -f.h / 2);
    ctx.rotate(pose.tumble);
    ctx.translate(0, f.h / 2);
  }

  const crouchSy = pose.crouch ? def.crouchH / def.h : 1;
  const crouchSx = pose.crouch ? 1.14 : 1;
  ctx.scale(k * pose.sx * crouchSx, k * pose.sy * crouchSy);
  ctx.rotate(pose.lean);

  // 足（オレンジの水かき・外開き）
  for (const [fx, st] of [[-8, pose.strideB], [8, pose.strideF]] as const) {
    foot(ctx, fx + st, -2.5 - (st > 0 ? pose.lift : 0), fx < 0 ? -0.24 : 0.24, orange);
  }

  ctx.save();
  ctx.translate(0, pose.bob);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 後ろフリッパー
  if (pose.bothArms || pose.guard) {
    const r2 = pose.armRot + 0.5;
    flipper(ctx, body, -11, -27, -11 + Math.cos(r2) * 24, -27 + Math.sin(r2) * 24);
  } else {
    flipper(ctx, body, -13, -27, -20, -17);
  }

  // 体（卵型: 下ぶくれ・頭はやや細い）
  ctx.beginPath();
  ctx.ellipse(0, -22, 19, 21, 0, 0, Math.PI);            // 下半分（広い）
  ctx.ellipse(0, -34, 14, 22, 0, Math.PI, Math.PI * 2);  // 上半分（細い）
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();

  // 白い腹（前寄り）
  ctx.beginPath();
  ctx.ellipse(3, -17, 12.5, 14.5, 0.08, 0, Math.PI * 2);
  ctx.fillStyle = belly;
  ctx.fill();

  // 目（頭頂寄り・白目に黒瞳。Tux らしい半目は被弾時以外は普通目）
  if (pose.hurt) {
    ctx.strokeStyle = '#e8e8ee';
    ctx.lineWidth = 1.6;
    for (const ex of [1, 9]) {
      ctx.beginPath();
      ctx.moveTo(ex - 2, -49); ctx.lineTo(ex + 2, -45);
      ctx.moveTo(ex + 2, -49); ctx.lineTo(ex - 2, -45);
      ctx.stroke();
    }
  } else {
    for (const ex of [1.5, 9]) {
      ctx.beginPath();
      ctx.ellipse(ex, -47, 3.8, 4.6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = OUTLINE;
      ctx.stroke();
    }
    for (const ex of [1.5, 9]) {
      ctx.beginPath();
      ctx.arc(ex + 1.2, -46, 1.9, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    }
  }

  // くちばし（オレンジ・上下嘴）
  ctx.beginPath();
  ctx.moveTo(4, -43.5);
  ctx.quadraticCurveTo(12, -45, 16.5, -41.5);
  ctx.quadraticCurveTo(11, -38.5, 4, -39.5);
  ctx.closePath();
  ctx.fillStyle = orange;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(6, -39.2);
  ctx.quadraticCurveTo(11, -36.6, 15, -40);
  ctx.stroke();

  // 前フリッパー（肩 12,-27 から回転・突き出し）
  const sh = { x: 12, y: -27 };
  const reach = 12 + pose.armExt;
  const hx = sh.x + Math.cos(pose.armRot) * reach;
  const hy = sh.y + Math.sin(pose.armRot) * reach;
  flipper(ctx, body, sh.x, sh.y, hx, hy);

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
