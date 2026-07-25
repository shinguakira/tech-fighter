// Bun（Bun ランタイムのマスコット）の格闘描画。
// Bun code is MIT; ロゴ/マスコットは press-kit(bun.sh/press-kit) 提供・明示的な制限ポリシー無し。
// 原案スタイルの手続き描画＋クレジット表記で使用。
// クリーム色の丸パン＋点目＋ピンクのほっぺ＋小さな笑み。
import { CHARS } from '../core/constants';
import type { Fighter } from '../core/types';
import { computePose, type FighterAnim } from './pose';

type Ctx = CanvasRenderingContext2D;

const BODY = '#f0d7a0';       // クリーム（焼きたてパン）
const BODY_ALT = '#f0aac2';   // 2P カラー（いちごパン）
const TOP = '#f8e8c4';
const TOP_ALT = '#ffd0e0';
const CHEEK = '#f29a9a';
const CHEEK_ALT = '#e86a86';
const OUTLINE = '#8a5a2e';
const OUTLINE_ALT = '#9a4a68';
const INK = '#3a2410';

/** ネイティブ描画高（足元 0 → 頭頂 -50 付近）。 */
const NATIVE_H = 56;

function foot(ctx: Ctx, body: string, outline: string, x: number, y: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, 5.5, 3.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = body; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = outline; ctx.stroke();
}

function arm(ctx: Ctx, body: string, outline: string, sx: number, sy: number, ex: number, ey: number): void {
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey);
  ctx.lineWidth = 6; ctx.strokeStyle = outline; ctx.lineCap = 'round'; ctx.stroke();
  ctx.lineWidth = 3.6; ctx.strokeStyle = body; ctx.stroke();
  ctx.beginPath(); ctx.arc(ex, ey, 3.4, 0, Math.PI * 2); ctx.fillStyle = body; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = outline; ctx.stroke();
}

export function drawBun(ctx: Ctx, f: Fighter, anim: FighterAnim): void {
  const pose = computePose(f, anim);
  const flash = f.invul > 0 && f.kd <= 0 && Math.floor(f.invul / 3) % 2 === 1;
  const def = CHARS.bun;
  const k = def.h / NATIVE_H;
  const cx = f.x + f.w / 2;
  const feetY = f.y + f.h;
  const body = flash ? '#ffffff' : f.alt ? BODY_ALT : BODY;
  const top = flash ? '#ffffff' : f.alt ? TOP_ALT : TOP;
  const cheek = f.alt ? CHEEK_ALT : CHEEK;
  const outline = f.alt ? OUTLINE_ALT : OUTLINE;

  ctx.save();
  ctx.translate(cx, feetY);
  ctx.scale(f.facing, 1);

  // ダウン: 横倒れ（ぺしゃんこ気味）
  if (pose.lying) {
    ctx.scale(k, k);
    ctx.beginPath(); ctx.ellipse(0, -9, 24, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = body; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = outline; ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    for (const ex of [-4, 6]) {
      ctx.beginPath(); ctx.moveTo(ex - 2, -12); ctx.lineTo(ex + 2, -8);
      ctx.moveTo(ex + 2, -12); ctx.lineTo(ex - 2, -8); ctx.stroke();
    }
    ctx.restore(); return;
  }

  if (pose.tumble !== 0) { ctx.translate(0, -f.h / 2); ctx.rotate(pose.tumble); ctx.translate(0, f.h / 2); }

  const crouchSy = pose.crouch ? def.crouchH / def.h : 1;
  const crouchSx = pose.crouch ? 1.16 : 1;
  ctx.scale(k * pose.sx * crouchSx, k * pose.sy * crouchSy);
  ctx.rotate(pose.lean);

  // 足（小さい2本）
  foot(ctx, body, outline, -8 + pose.strideB, -2.5 - (pose.strideB > 0 ? pose.lift : 0));
  foot(ctx, body, outline, 8 + pose.strideF, -2.5 - (pose.strideF > 0 ? pose.lift : 0));

  ctx.save();
  ctx.translate(0, pose.bob);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';

  // 後ろ手
  if (pose.bothArms || pose.guard) {
    const r2 = pose.armRot + 0.5;
    arm(ctx, body, outline, -14, -26, -14 + Math.cos(r2) * 18, -26 + Math.sin(r2) * 18);
  } else {
    arm(ctx, body, outline, -15, -26, -21, -18);
  }

  // 体（丸いパン: ドーム型の上・少し平たい底）
  ctx.beginPath();
  ctx.moveTo(-21, -20);
  ctx.bezierCurveTo(-22, -40, -12, -50, 0, -50);
  ctx.bezierCurveTo(12, -50, 22, -40, 21, -20);
  ctx.bezierCurveTo(21, -10, 14, -6, 0, -6);
  ctx.bezierCurveTo(-14, -6, -21, -10, -21, -20);
  ctx.closePath();
  ctx.fillStyle = body; ctx.fill();
  ctx.lineWidth = 2.6; ctx.strokeStyle = outline; ctx.stroke();
  // 上面のツヤ
  ctx.beginPath();
  ctx.ellipse(-2, -42, 12, 5, -0.15, 0, Math.PI * 2);
  ctx.fillStyle = top; ctx.globalAlpha = 0.7; ctx.fill(); ctx.globalAlpha = 1;

  // ほっぺ（ピンク）
  ctx.fillStyle = cheek; ctx.globalAlpha = 0.75;
  ctx.beginPath(); ctx.ellipse(-12, -26, 4, 2.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(11, -26, 4, 2.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // 目・口
  if (pose.hurt) {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    for (const ex of [-6, 6]) {
      ctx.beginPath(); ctx.moveTo(ex - 2.4, -34); ctx.lineTo(ex + 2.4, -30);
      ctx.moveTo(ex + 2.4, -34); ctx.lineTo(ex - 2.4, -30); ctx.stroke();
    }
  } else {
    for (const ex of [-6, 6]) {
      ctx.beginPath(); ctx.ellipse(ex, -32, 2.4, 3.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = INK; ctx.fill();
      ctx.beginPath(); ctx.arc(ex - 0.8, -33.2, 1, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
    }
    // 小さな笑み
    ctx.beginPath(); ctx.arc(0, -27, 3.4, Math.PI * 0.15, Math.PI * 0.85);
    ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
  }

  // 前手（肩 15,-26 から回転・突き出し）
  const sh = { x: 15, y: -26 };
  const reach = 10 + pose.armExt;
  const hx = sh.x + Math.cos(pose.armRot) * reach;
  const hy = sh.y + Math.sin(pose.armRot) * reach;
  arm(ctx, body, outline, sh.x, sh.y, hx, hy);

  if (pose.armExt > 10) {
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.4;
    for (const dy of [-4, 0, 4]) {
      ctx.beginPath(); ctx.moveTo(hx - 14, hy + dy); ctx.lineTo(hx - 4, hy + dy); ctx.stroke();
    }
  }

  ctx.restore(); // bob
  ctx.restore();
}
