// Deno（Deno ランタイムの恐竜）の格闘描画。
// Deno's dinosaur mascot — original artwork by ry, MIT License (deno.com/artwork)。
// 丸っこい緑の恐竜。大きな頭・小さな前脚・太い後脚・しっぽが特徴。
import { CHARS } from '../core/constants';
import type { Fighter } from '../core/types';
import { computePose, type FighterAnim } from './pose';

type Ctx = CanvasRenderingContext2D;

const BODY = '#5aa544';       // Deno グリーン
const BODY_ALT = '#c98a3a';   // 2P カラー（サンドベージュ）
const BELLY = '#bfe6a2';
const BELLY_ALT = '#f0d29a';
const OUTLINE = '#173a12';
const OUTLINE_ALT = '#4a2f10';
const INK = '#0e1a0a';

/** ネイティブ描画高（足元 0 → 頭頂 -56）。 */
const NATIVE_H = 56;

function limb(ctx: Ctx, body: string, outline: string, sx: number, sy: number, ex: number, ey: number, wide: number): void {
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.lineWidth = wide + 2.5;
  ctx.strokeStyle = outline;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineWidth = wide;
  ctx.strokeStyle = body;
  ctx.stroke();
}

export function drawDeno(ctx: Ctx, f: Fighter, anim: FighterAnim): void {
  const pose = computePose(f, anim);
  const flash = f.invul > 0 && f.kd <= 0 && Math.floor(f.invul / 3) % 2 === 1;
  const def = CHARS.deno;
  const k = def.h / NATIVE_H;
  const cx = f.x + f.w / 2;
  const feetY = f.y + f.h;
  const body = flash ? '#ffffff' : f.alt ? BODY_ALT : BODY;
  const belly = flash ? '#ffffff' : f.alt ? BELLY_ALT : BELLY;
  const outline = f.alt ? OUTLINE_ALT : OUTLINE;

  ctx.save();
  ctx.translate(cx, feetY);
  ctx.scale(f.facing, 1);

  // ダウン: 仰向け（脚を上に）
  if (pose.lying) {
    ctx.scale(k, k);
    ctx.beginPath();
    ctx.ellipse(-2, -10, 24, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = outline;
    ctx.stroke();
    // 上を向いた頭＋バツ目
    ctx.beginPath();
    ctx.arc(16, -14, 9, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    for (const [ex0, ey0] of [[14, -16], [19, -15]] as const) {
      ctx.beginPath();
      ctx.moveTo(ex0 - 1.6, ey0 - 1.6); ctx.lineTo(ex0 + 1.6, ey0 + 1.6);
      ctx.moveTo(ex0 + 1.6, ey0 - 1.6); ctx.lineTo(ex0 - 1.6, ey0 + 1.6);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (pose.tumble !== 0) {
    ctx.translate(0, -f.h / 2);
    ctx.rotate(pose.tumble);
    ctx.translate(0, f.h / 2);
  }

  const crouchSy = pose.crouch ? def.crouchH / def.h : 1;
  const crouchSx = pose.crouch ? 1.12 : 1;
  ctx.scale(k * pose.sx * crouchSx, k * pose.sy * crouchSy);
  ctx.rotate(pose.lean);

  // しっぽ（体の後方・地面近く）
  ctx.beginPath();
  ctx.moveTo(-14, -12);
  ctx.quadraticCurveTo(-30, -10, -34, -2);
  ctx.quadraticCurveTo(-26, -6, -14, -6);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = outline;
  ctx.stroke();

  // 後脚（太い2本）
  for (const [lx, st] of [[-7, pose.strideB], [7, pose.strideF]] as const) {
    limb(ctx, body, outline, lx, -18, lx + st * 0.6, -2 - (st > 0 ? pose.lift : 0), 7);
    // 足
    ctx.beginPath();
    ctx.ellipse(lx + st * 0.6 + 3, -2 - (st > 0 ? pose.lift : 0), 6, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = outline;
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(0, pose.bob);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 後ろの小さな前脚
  if (pose.bothArms || pose.guard) {
    const r2 = pose.armRot + 0.5;
    limb(ctx, body, outline, -8, -30, -8 + Math.cos(r2) * 16, -30 + Math.sin(r2) * 16, 4);
  } else {
    limb(ctx, body, outline, -8, -30, -13, -24, 4);
  }

  // 体（ずんぐり卵型）
  ctx.beginPath();
  ctx.ellipse(0, -26, 16, 22, 0, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = outline;
  ctx.stroke();
  // 腹
  ctx.beginPath();
  ctx.ellipse(3, -20, 9, 14, 0.05, 0, Math.PI * 2);
  ctx.fillStyle = belly;
  ctx.fill();

  // 頭（大きめ・前方に突き出す）
  ctx.beginPath();
  ctx.ellipse(4, -46, 15, 13, 0, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = outline;
  ctx.stroke();
  // 鼻先（マズル）
  ctx.beginPath();
  ctx.ellipse(15, -44, 7, 6, 0, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.stroke();
  // 背びれ（頭上の小さなトゲ2枚）
  ctx.beginPath();
  ctx.moveTo(-6, -56); ctx.lineTo(-2, -63); ctx.lineTo(2, -56);
  ctx.moveTo(2, -57); ctx.lineTo(6, -62); ctx.lineTo(9, -56);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline;
  ctx.stroke();

  // 鼻の穴
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(19, -45, 1.2, 0, Math.PI * 2);
  ctx.fill();

  // 目（被弾で ><）
  if (pose.hurt) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(4, -50); ctx.lineTo(9, -46);
    ctx.moveTo(9, -50); ctx.lineTo(4, -46);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(7, -48, 4.4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = outline;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(8.4, -48, 2, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  }

  // 前脚（肩 8,-30 から回転・突き出し）
  const sh = { x: 8, y: -30 };
  const reach = 10 + pose.armExt;
  const hx = sh.x + Math.cos(pose.armRot) * reach;
  const hy = sh.y + Math.sin(pose.armRot) * reach;
  limb(ctx, body, outline, sh.x, sh.y, hx, hy, 4.4);
  // 爪
  ctx.beginPath();
  ctx.arc(hx, hy, 3, 0, Math.PI * 2);
  ctx.fillStyle = flash ? '#ffffff' : belly;
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = outline;
  ctx.stroke();

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
