// Ferris（Rust の蟹）の格闘描画。
// Ferris the Rustacean by Karen Rustad Tölva — CC0 / public domain (rustacean.net)
// 横に広い甲羅・上縁のトゲ・大きなハサミ・つぶらな目が特徴。
import { CHARS } from '../core/constants';
import type { Fighter } from '../core/types';
import { computePose, type FighterAnim } from './pose';

type Ctx = CanvasRenderingContext2D;

const BODY = '#f74c00';
const BODY_ALT = '#3fa7d6';   // 2P カラー（ブルークラブ）
const BELLY = '#ff7a3c';
const BELLY_ALT = '#6ec4ea';
const OUTLINE = '#571a00';
const OUTLINE_ALT = '#123a52';
const INK = '#2b1608';

/** ネイティブ描画高（足元 0 → トゲ先端 -52）。 */
const NATIVE_H = 52;

function pincer(ctx: Ctx, x: number, y: number, rot: number, open: number, body: string, outline: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  // ハサミ本体（前方 +x に口を開く）
  ctx.beginPath();
  ctx.arc(0, 0, 7.2, Math.PI * (0.22 + open), Math.PI * (1.78 - open), false);
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline;
  ctx.stroke();
  ctx.restore();
}

export function drawFerris(ctx: Ctx, f: Fighter, anim: FighterAnim): void {
  const pose = computePose(f, anim);
  const flash = f.invul > 0 && f.kd <= 0 && Math.floor(f.invul / 3) % 2 === 1;
  const def = CHARS.ferris;
  const k = def.h / NATIVE_H;
  const cx = f.x + f.w / 2;
  const feetY = f.y + f.h;
  const body = flash ? '#ffffff' : f.alt ? BODY_ALT : BODY;
  const belly = flash ? '#ffffff' : f.alt ? BELLY_ALT : BELLY;
  const outline = f.alt ? OUTLINE_ALT : OUTLINE;

  ctx.save();
  ctx.translate(cx, feetY);
  ctx.scale(f.facing, 1);

  // ダウン: ひっくり返る（脚を上に）
  if (pose.lying) {
    ctx.scale(k, k);
    ctx.beginPath();
    ctx.ellipse(0, -10, 24, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = outline;
    ctx.stroke();
    // 上を向いた脚
    ctx.lineWidth = 2.2;
    for (const lx of [-14, -6, 2, 10]) {
      ctx.beginPath();
      ctx.moveTo(lx, -18);
      ctx.lineTo(lx + 2, -25);
      ctx.stroke();
    }
    // バツ目
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    for (const ex of [8, 15]) {
      ctx.beginPath();
      ctx.moveTo(ex - 1.6, -12.6); ctx.lineTo(ex + 1.6, -9.4);
      ctx.moveTo(ex + 1.6, -12.6); ctx.lineTo(ex - 1.6, -9.4);
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

  // 脚（左右3本ずつの小さなトゲ脚・歩行でせわしなく動く）
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = outline;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const wob = Math.sin(anim.walk * 1.6 + i * 2.1) * (Math.abs(f.vx) > 0.4 ? 2.2 : 0.4);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * (8 + i * 6), -10);
      ctx.lineTo(s * (13 + i * 6) + (s > 0 ? wob : -wob), -1);
      ctx.stroke();
    }
  }

  ctx.save();
  ctx.translate(0, pose.bob);

  // 後ろのハサミ（超必/ガードは前へ構える）
  const backRot = pose.bothArms || pose.guard ? pose.armRot + 0.55 : 0.35;
  const bx = pose.bothArms || pose.guard ? -8 + Math.cos(backRot) * 20 : -22;
  const by = pose.bothArms || pose.guard ? -22 + Math.sin(backRot) * 20 : -18;
  ctx.beginPath();
  ctx.moveTo(-14, -22);
  ctx.lineTo(bx + 3, by);
  ctx.lineWidth = 4.2;
  ctx.strokeStyle = outline;
  ctx.stroke();
  pincer(ctx, bx, by, Math.PI + 0.3, 0.06, body, outline);

  // 甲羅（横広の楕円）＋上縁のトゲ
  ctx.beginPath();
  ctx.ellipse(0, -24, 24, 17.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = outline;
  ctx.stroke();
  // トゲ（甲羅上縁に5本・短めで炎に見えないように）
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.72 - i * 0.11); // 上弧に沿って
    const x0 = Math.cos(a) * 22, y0 = -24 + Math.sin(a) * -15;
    const x1 = Math.cos(a) * 26.5, y1 = -24 + Math.sin(a) * -20;
    ctx.moveTo(x0 - 3.4, y0 + 2);
    ctx.lineTo(x1 * 0.86, y1 * 0.97 - 1);
    ctx.lineTo(x0 + 3.4, y0);
  }
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline;
  ctx.stroke();
  // 腹側の淡い帯
  ctx.beginPath();
  ctx.ellipse(1, -17, 16, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = belly;
  ctx.globalAlpha = 0.55;
  ctx.fill();
  ctx.globalAlpha = 1;

  // 目（前方寄りに2つ・被弾で><）
  if (pose.hurt) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    for (const ex of [4, 12]) {
      ctx.beginPath();
      ctx.moveTo(ex - 2, -32); ctx.lineTo(ex + 2, -28);
      ctx.moveTo(ex + 2, -32); ctx.lineTo(ex - 2, -28);
      ctx.stroke();
    }
  } else {
    for (const ex of [4, 12]) {
      ctx.beginPath();
      ctx.arc(ex, -30, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = outline;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex + 1.2, -29.6, 1.7, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    }
    // 口（にっこり）
    ctx.beginPath();
    ctx.arc(9, -24.5, 3.4, Math.PI * 0.12, Math.PI * 0.82);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  // 前のハサミ（肩 14,-22 から回転・突き出し。攻撃 active で口が開く）
  const sh = { x: 14, y: -22 };
  const reach = 12 + pose.armExt;
  const hx = sh.x + Math.cos(pose.armRot) * reach;
  const hy = sh.y + Math.sin(pose.armRot) * reach;
  ctx.beginPath();
  ctx.moveTo(sh.x, sh.y);
  ctx.lineTo(hx - 3, hy);
  ctx.lineWidth = 4.2;
  ctx.strokeStyle = outline;
  ctx.stroke();
  const open = pose.armExt > 8 ? 0.2 : 0.06;
  pincer(ctx, hx, hy, pose.armRot, open, body, outline);

  if (pose.armExt > 10) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.4;
    for (const dy of [-4, 0, 4]) {
      ctx.beginPath();
      ctx.moveTo(hx - 16, hy + dy);
      ctx.lineTo(hx - 6, hy + dy);
      ctx.stroke();
    }
  }

  ctx.restore(); // bob
  ctx.restore();
}
