// GNU（GNU プロジェクトのヌー）の格闘描画。
// GNU head by Aurélio A. Heckert — Free Art License / GFDL / CC BY-SA (gnu.org)。
// ヌー(ウィルドビースト): 湾曲した角・長いあごひげ・たてがみが特徴。
import { CHARS } from '../core/constants';
import type { Fighter } from '../core/types';
import { computePose, type FighterAnim } from './pose';

type Ctx = CanvasRenderingContext2D;

const BODY = '#7c5a3a';       // ヌーのブラウン
const BODY_ALT = '#4a5a86';   // 2P カラー（スチールブルー）
const BEARD = '#e8e0d2';
const BEARD_ALT = '#d0dcf0';
const HORN = '#d8cbb0';
const HORN_ALT = '#c8d2e6';
const OUTLINE = '#2a1a0e';
const OUTLINE_ALT = '#14203a';
const INK = '#140c06';

/** ネイティブ描画高（足元 0 → 角の先端 -60）。 */
const NATIVE_H = 60;

function limb(ctx: Ctx, body: string, outline: string, sx: number, sy: number, ex: number, ey: number, wide: number): void {
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.lineWidth = wide + 2.4;
  ctx.strokeStyle = outline;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineWidth = wide;
  ctx.strokeStyle = body;
  ctx.stroke();
  // ひづめ
  ctx.beginPath();
  ctx.arc(ex, ey, wide * 0.5 + 0.5, 0, Math.PI * 2);
  ctx.fillStyle = outline;
  ctx.fill();
}

/**
 * 湾曲した2本の角。頭ローカル座標（頭中心は約 (2,2)、頭頂は y≈-11）で、
 * 頭頂の左右から生えて外→上→内へ巻く。
 */
function horns(ctx: Ctx, horn: string, outline: string): void {
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 4, -7);
    ctx.quadraticCurveTo(s * 15, -13, s * 19, -8);
    ctx.quadraticCurveTo(s * 22, -3, s * 16, -1);
    ctx.lineWidth = 5.5;
    ctx.strokeStyle = outline;
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = horn;
    ctx.stroke();
  }
}

export function drawGnu(ctx: Ctx, f: Fighter, anim: FighterAnim): void {
  const pose = computePose(f, anim);
  const flash = f.invul > 0 && f.kd <= 0 && Math.floor(f.invul / 3) % 2 === 1;
  const def = CHARS.gnu;
  const k = def.h / NATIVE_H;
  const cx = f.x + f.w / 2;
  const feetY = f.y + f.h;
  const body = flash ? '#ffffff' : f.alt ? BODY_ALT : BODY;
  const beard = flash ? '#ffffff' : f.alt ? BEARD_ALT : BEARD;
  const horn = f.alt ? HORN_ALT : HORN;
  const outline = f.alt ? OUTLINE_ALT : OUTLINE;

  ctx.save();
  ctx.translate(cx, feetY);
  ctx.scale(f.facing, 1);

  // ダウン: 横倒れ
  if (pose.lying) {
    ctx.scale(k, k);
    ctx.beginPath();
    ctx.ellipse(0, -10, 25, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = outline;
    ctx.stroke();
    // 頭＋角＋バツ目
    ctx.beginPath();
    ctx.arc(17, -13, 8, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = horn;
    ctx.beginPath();
    ctx.moveTo(14, -18); ctx.quadraticCurveTo(20, -26, 26, -20);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    for (const [ex0, ey0] of [[15, -14], [20, -13]] as const) {
      ctx.beginPath();
      ctx.moveTo(ex0 - 1.5, ey0 - 1.5); ctx.lineTo(ex0 + 1.5, ey0 + 1.5);
      ctx.moveTo(ex0 + 1.5, ey0 - 1.5); ctx.lineTo(ex0 - 1.5, ey0 + 1.5);
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

  // 後脚2本
  for (const [lx, st] of [[-8, pose.strideB], [8, pose.strideF]] as const) {
    limb(ctx, body, outline, lx, -20, lx + st * 0.7, -2 - (st > 0 ? pose.lift : 0), 5.5);
  }

  ctx.save();
  ctx.translate(0, pose.bob);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 後ろ前脚
  if (pose.bothArms || pose.guard) {
    const r2 = pose.armRot + 0.5;
    limb(ctx, body, outline, -10, -30, -10 + Math.cos(r2) * 18, -30 + Math.sin(r2) * 18, 5);
  } else {
    limb(ctx, body, outline, -10, -30, -16, -20, 5);
  }

  // 胴（がっしり）
  ctx.beginPath();
  ctx.ellipse(-2, -28, 18, 20, 0, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = outline;
  ctx.stroke();
  // たてがみ（背中の縦ギザ）
  ctx.beginPath();
  ctx.moveTo(-14, -44);
  for (let i = 0; i < 5; i++) {
    ctx.lineTo(-16 - (i % 2) * 3, -40 + i * 7);
    ctx.lineTo(-12, -37 + i * 7);
  }
  ctx.strokeStyle = outline;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 頭（前方・長い顔）
  ctx.save();
  ctx.translate(8, -44);
  // 角（頭の後ろに先に描く）
  horns(ctx, horn, outline);
  // 顔の輪郭（縦長）
  ctx.beginPath();
  ctx.ellipse(2, 2, 11, 13, 0.08, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = outline;
  ctx.stroke();
  // 鼻先
  ctx.beginPath();
  ctx.ellipse(6, 12, 6, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(9, 12, 1.3, 0, Math.PI * 2);
  ctx.fill();
  // あごひげ（顔の下に長く垂れる）
  ctx.beginPath();
  ctx.moveTo(-4, 8);
  ctx.quadraticCurveTo(-10, 20, -5, 30);
  ctx.quadraticCurveTo(-1, 22, 3, 24);
  ctx.quadraticCurveTo(2, 16, 0, 12);
  ctx.closePath();
  ctx.fillStyle = beard;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = outline;
  ctx.stroke();
  // 目
  if (pose.hurt) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(-1, -1); ctx.lineTo(4, 3);
    ctx.moveTo(4, -1); ctx.lineTo(-1, 3);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(2.5, 1, 3.8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = outline;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(3.6, 1, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
  }
  ctx.restore();

  // 前脚（肩 8,-30 から回転・突き出し）
  const sh = { x: 8, y: -30 };
  const reach = 11 + pose.armExt;
  const hx = sh.x + Math.cos(pose.armRot) * reach;
  const hy = sh.y + Math.sin(pose.armRot) * reach;
  limb(ctx, body, outline, sh.x, sh.y, hx, hy, 5);

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
