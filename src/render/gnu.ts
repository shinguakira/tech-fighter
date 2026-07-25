// GNU（GNU プロジェクトのヌー）の格闘描画。
// GNU head by Aurélio A. Heckert — Free Art License / GFDL / CC BY-SA (gnu.org)。
// 公式ロゴは正面顔の黒白ライン画: 大きく湾曲した角・長いあごひげ・もじゃもじゃのたてがみ。
// 横向きファイターとして、その特徴（大角・長ひげ・たてがみ・グレー）を強調して描く。
import { CHARS } from '../core/constants';
import type { Fighter } from '../core/types';
import { computePose, type FighterAnim } from './pose';

type Ctx = CanvasRenderingContext2D;

const BODY = '#4b4f57';       // グレー（ヌー）
const BODY_ALT = '#45557a';   // 2P カラー（スチールブルー）
const MANE = '#2c2f35';
const MANE_ALT = '#28324a';
const BEARD = '#e6e2d6';
const BEARD_ALT = '#dce6f2';
const HORN = '#d8d2c2';
const HORN_ALT = '#cdd6e4';
const OUTLINE = '#13161b';
const OUTLINE_ALT = '#131d2c';
const INK = '#0b0d11';

/** ネイティブ描画高（足元 0 → 角の先端 -62）。 */
const NATIVE_H = 62;

function limb(ctx: Ctx, body: string, outline: string, sx: number, sy: number, ex: number, ey: number, wide: number): void {
  ctx.beginPath();
  ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
  ctx.lineWidth = wide + 2.4; ctx.strokeStyle = outline; ctx.lineCap = 'round'; ctx.stroke();
  ctx.lineWidth = wide; ctx.strokeStyle = body; ctx.stroke();
  ctx.beginPath(); ctx.arc(ex, ey, wide * 0.5 + 0.5, 0, Math.PI * 2); ctx.fillStyle = outline; ctx.fill();
}

/**
 * 大きく湾曲した2本の角。頭ローカル座標（頭頂 y≈-12）で、外へ張り出して先が内へ巻く。
 */
function horns(ctx: Ctx, horn: string, outline: string): void {
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 3, -8);
    ctx.quadraticCurveTo(s * 20, -12, s * 24, -24);   // 上外へ大きく
    ctx.quadraticCurveTo(s * 25, -32, s * 18, -33);   // 先が内へ巻く
    ctx.lineWidth = 6.5; ctx.strokeStyle = outline; ctx.stroke();
    ctx.lineWidth = 3.8; ctx.strokeStyle = horn; ctx.stroke();
    // 先端の点
    ctx.beginPath(); ctx.arc(s * 18, -33, 1.6, 0, Math.PI * 2); ctx.fillStyle = horn; ctx.fill();
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
  const mane = f.alt ? MANE_ALT : MANE;
  const beard = flash ? '#ffffff' : f.alt ? BEARD_ALT : BEARD;
  const horn = f.alt ? HORN_ALT : HORN;
  const outline = f.alt ? OUTLINE_ALT : OUTLINE;

  ctx.save();
  ctx.translate(cx, feetY);
  ctx.scale(f.facing, 1);

  // ダウン: 横倒れ
  if (pose.lying) {
    ctx.scale(k, k);
    ctx.beginPath(); ctx.ellipse(0, -10, 25, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = body; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = outline; ctx.stroke();
    ctx.beginPath(); ctx.arc(17, -13, 8, 0, Math.PI * 2); ctx.fillStyle = body; ctx.fill(); ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = horn;
    ctx.beginPath(); ctx.moveTo(14, -18); ctx.quadraticCurveTo(22, -28, 30, -22); ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    for (const [ex, ey] of [[15, -14], [20, -13]] as const) {
      ctx.beginPath(); ctx.moveTo(ex - 1.5, ey - 1.5); ctx.lineTo(ex + 1.5, ey + 1.5);
      ctx.moveTo(ex + 1.5, ey - 1.5); ctx.lineTo(ex - 1.5, ey + 1.5); ctx.stroke();
    }
    ctx.restore(); return;
  }

  if (pose.tumble !== 0) { ctx.translate(0, -f.h / 2); ctx.rotate(pose.tumble); ctx.translate(0, f.h / 2); }

  const crouchSy = pose.crouch ? def.crouchH / def.h : 1;
  const crouchSx = pose.crouch ? 1.12 : 1;
  ctx.scale(k * pose.sx * crouchSx, k * pose.sy * crouchSy);
  ctx.rotate(pose.lean);

  // 後脚
  for (const [lx, st] of [[-8, pose.strideB], [8, pose.strideF]] as const) {
    limb(ctx, body, outline, lx, -20, lx + st * 0.7, -2 - (st > 0 ? pose.lift : 0), 5.5);
  }

  ctx.save();
  ctx.translate(0, pose.bob);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  // 後ろ前脚
  if (pose.bothArms || pose.guard) {
    const r2 = pose.armRot + 0.5;
    limb(ctx, body, outline, -10, -30, -10 + Math.cos(r2) * 18, -30 + Math.sin(r2) * 18, 5);
  } else {
    limb(ctx, body, outline, -10, -30, -16, -20, 5);
  }

  // 胴（がっしり）
  ctx.beginPath(); ctx.ellipse(-3, -28, 18, 20, 0, 0, Math.PI * 2);
  ctx.fillStyle = body; ctx.fill(); ctx.lineWidth = 2.6; ctx.strokeStyle = outline; ctx.stroke();

  // たてがみ（背〜首のもじゃもじゃ）
  ctx.beginPath();
  ctx.moveTo(-18, -46);
  for (let i = 0; i < 6; i++) {
    ctx.lineTo(-20 - (i % 2) * 4, -42 + i * 7);
    ctx.lineTo(-13, -39 + i * 7);
  }
  ctx.closePath();
  ctx.fillStyle = mane; ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = outline; ctx.stroke();

  // ---- 頭（前方・長い顔＋大角＋長ひげ） ----
  ctx.save();
  ctx.translate(9, -46);
  // 角（頭の後ろに先に描く）
  horns(ctx, horn, outline);
  // 額のもじゃ（角の間）
  ctx.beginPath(); ctx.ellipse(2, -7, 7, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = mane; ctx.fill();
  // 顔（縦長・鼻先が前へ）
  ctx.beginPath();
  ctx.moveTo(-5, -4);
  ctx.quadraticCurveTo(10, -6, 13, 6);
  ctx.quadraticCurveTo(14, 16, 8, 22);
  ctx.quadraticCurveTo(0, 24, -3, 16);
  ctx.quadraticCurveTo(-6, 6, -5, -4);
  ctx.closePath();
  ctx.fillStyle = body; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = outline; ctx.stroke();
  // 鼻先
  ctx.beginPath(); ctx.ellipse(9, 20, 5, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = body; ctx.fill(); ctx.stroke();
  ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(11, 20, 1.3, 0, Math.PI * 2); ctx.fill();
  // 長いあごひげ（顔の下から長く垂れる・毛束）
  ctx.beginPath();
  ctx.moveTo(-3, 14);
  ctx.quadraticCurveTo(-12, 26, -8, 40);
  ctx.quadraticCurveTo(-4, 30, -1, 34);
  ctx.quadraticCurveTo(0, 26, 3, 30);
  ctx.quadraticCurveTo(5, 22, 7, 24);
  ctx.quadraticCurveTo(7, 18, 4, 16);
  ctx.closePath();
  ctx.fillStyle = beard; ctx.fill(); ctx.lineWidth = 1.8; ctx.strokeStyle = outline; ctx.stroke();
  // ひげの筋
  ctx.strokeStyle = 'rgba(120,120,120,0.5)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(-4, 20); ctx.lineTo(-6, 34); ctx.moveTo(0, 20); ctx.lineTo(-1, 32); ctx.stroke();
  // 目
  if (pose.hurt) {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(1, 2); ctx.lineTo(6, 6); ctx.moveTo(6, 2); ctx.lineTo(1, 6); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(3.5, 4, 3.8, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = outline; ctx.stroke();
    ctx.beginPath(); ctx.arc(4.6, 4, 1.9, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
  }
  ctx.restore();

  // 前脚（肩 8,-30 から回転・突き出し）
  const sh = { x: 8, y: -30 };
  const reach = 11 + pose.armExt;
  const hx = sh.x + Math.cos(pose.armRot) * reach;
  const hy = sh.y + Math.sin(pose.armRot) * reach;
  limb(ctx, body, outline, sh.x, sh.y, hx, hy, 5);

  if (pose.armExt > 10) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.4;
    for (const dy of [-4, 0, 4]) {
      ctx.beginPath(); ctx.moveTo(hx - 14, hy + dy); ctx.lineTo(hx - 4, hy + dy); ctx.stroke();
    }
  }

  ctx.restore(); // bob
  ctx.restore();
}
