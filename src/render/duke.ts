// Duke（Java マスコット）の格闘描画。
// Duke was open-sourced by Sun Microsystems under the New BSD License (2006).
// 黒いしずく型の体・赤い丸鼻・白いミトンの手が特徴。目は無いのが正統。
import { CHARS } from '../core/constants';
import type { Fighter } from '../core/types';
import { computePose, type FighterAnim } from './pose';

type Ctx = CanvasRenderingContext2D;

const BODY = '#1c1c22';
const BODY_ALT = '#22386a';   // 2P カラー（ネイビー）
const EDGE = '#3c3c48';
const EDGE_ALT = '#3d5a9e';
const NOSE = '#e23a2e';
const NOSE_ALT = '#ff8a3a';
const MITT = '#f4f4f6';
const OUTLINE = '#0a0a0e';

const NATIVE_H = 62;

function mitt(ctx: Ctx, x: number, y: number, flash: boolean): void {
  ctx.beginPath();
  ctx.arc(x, y, 4.6, 0, Math.PI * 2);
  ctx.fillStyle = flash ? '#ffffff' : MITT;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
}

function dukeArm(ctx: Ctx, body: string, sx: number, sy: number, ex: number, ey: number, flash: boolean): void {
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.lineWidth = 6;
  ctx.strokeStyle = OUTLINE;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineWidth = 3.6;
  ctx.strokeStyle = body;
  ctx.stroke();
  mitt(ctx, ex, ey, flash);
}

/**
 * 本物準拠のスウッシュ型ボディ。facing +x 前提のローカル座標。
 * 頭の先端が前へ大きく倒れ込み、前面はえぐれ（凹）、背中は膨らみ、裾は広がる。
 */
function dukeBody(ctx: Ctx, body: string, edge: string): void {
  ctx.beginPath();
  // 前傾した頭の先端 → 背中の大きな膨らみ → 広い裾 → 前面のえぐれ → 先端へ戻る
  ctx.moveTo(13, -55);
  ctx.bezierCurveTo(0, -64, -19, -54, -21, -32);   // 後頭部〜背中の膨らみ
  ctx.bezierCurveTo(-22.5, -18, -23, -8, -20, -2); // 背中側の裾へ
  ctx.lineTo(17, -2);                              // 広い底辺
  ctx.bezierCurveTo(18, -8, 13, -14, 8, -22);      // 前面下部（裾の張り出し）
  ctx.bezierCurveTo(3, -30, 2, -42, 6, -48);       // 前面のえぐれ（凹カーブ）
  ctx.bezierCurveTo(7.5, -51, 10, -53.5, 13, -55); // 顎〜先端
  ctx.closePath();
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  // 背のハイライト（読みやすさ用の稜線）
  ctx.beginPath();
  ctx.moveTo(4, -58);
  ctx.bezierCurveTo(-8, -60, -16, -48, -16.5, -32);
  ctx.lineWidth = 2;
  ctx.strokeStyle = edge;
  ctx.stroke();
}

export function drawDuke(ctx: Ctx, f: Fighter, anim: FighterAnim): void {
  const pose = computePose(f, anim);
  const flash = f.invul > 0 && f.kd <= 0 && Math.floor(f.invul / 3) % 2 === 1;
  const def = CHARS.duke;
  const k = def.h / NATIVE_H;
  const cx = f.x + f.w / 2;
  const feetY = f.y + f.h;
  const body = flash ? '#8a8a96' : f.alt ? BODY_ALT : BODY;
  const edge = f.alt ? EDGE_ALT : EDGE;
  const nose = flash ? '#ffffff' : f.alt ? NOSE_ALT : NOSE;

  ctx.save();
  ctx.translate(cx, feetY);
  ctx.scale(f.facing, 1);

  // ダウン: 横倒れ
  if (pose.lying) {
    ctx.scale(k, k);
    ctx.beginPath();
    ctx.ellipse(0, -9, 25, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = OUTLINE;
    ctx.stroke();
    // 鼻が上を向く
    ctx.beginPath();
    ctx.arc(18, -14, 4.6, 0, Math.PI * 2);
    ctx.fillStyle = nose;
    ctx.fill();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    mitt(ctx, -18, -14, false);
    mitt(ctx, 4, -18, false);
    ctx.restore();
    return;
  }

  if (pose.tumble !== 0) {
    ctx.translate(0, -f.h / 2);
    ctx.rotate(pose.tumble);
    ctx.translate(0, f.h / 2);
  }

  const crouchSy = pose.crouch ? def.crouchH / def.h : 1;
  const crouchSx = pose.crouch ? 1.15 : 1;
  ctx.scale(k * pose.sx * crouchSx, k * pose.sy * crouchSy);
  ctx.rotate(pose.lean);

  // 足（黒い短足・体の下から覗く）
  for (const [fx, st] of [[-8, pose.strideB], [8, pose.strideF]] as const) {
    ctx.save();
    ctx.translate(fx + st, -2.5 - (st > 0 ? pose.lift : 0));
    ctx.beginPath();
    ctx.ellipse(0, 0, 6.2, 3.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = body;
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

  // 後ろ手
  if (pose.bothArms || pose.guard) {
    const r2 = pose.armRot + 0.5;
    dukeArm(ctx, body, -12, -28, -12 + Math.cos(r2) * 26, -28 + Math.sin(r2) * 26, flash);
  } else {
    dukeArm(ctx, body, -13, -28, -21, -19, flash);
  }

  // 体
  dukeBody(ctx, body, edge);

  // 赤鼻（本物はかなり大きい。頭の先端に重ねる）
  ctx.beginPath();
  ctx.arc(14, -52, 6.6, 0, Math.PI * 2);
  ctx.fillStyle = nose;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = OUTLINE;
  ctx.stroke();
  // 鼻のハイライト
  ctx.beginPath();
  ctx.arc(12.2, -54.4, 2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();

  // 被弾中は口（への字）を描いて痛みを見せる（目は正統に無し）
  if (pose.hurt) {
    ctx.beginPath();
    ctx.arc(4, -44, 3.4, Math.PI * 0.15, Math.PI * 0.85, true);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = '#c9c9d2';
    ctx.stroke();
  }

  // 前手
  const sh = { x: 12, y: -28 };
  const reach = 12 + pose.armExt;
  const hx = sh.x + Math.cos(pose.armRot) * reach;
  const hy = sh.y + Math.sin(pose.armRot) * reach;
  dukeArm(ctx, body, sh.x, sh.y, hx, hy, flash);

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
