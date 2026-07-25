// Deno（Deno ランタイムの恐竜 "DeeDee"）の格闘描画。
// Deno's dinosaur mascot — original artwork by ry, MIT License (deno.com/artwork)。
// 公式は「丸い胴＋長い首＋小さな頭」のブロントサウルス（首長竜）型・モノクロ（黒白）＋雨が象徴。
// 攻撃は長い首を突き出して噛む動きに割り当てる。
import { CHARS } from '../core/constants';
import type { Fighter } from '../core/types';
import { computePose, type FighterAnim } from './pose';

type Ctx = CanvasRenderingContext2D;

const BODY = '#3a434e';       // ダークスレート（モノクロ寄り）
const BODY_ALT = '#3f5c86';   // 2P カラー（スレートブルー）
const BELLY = '#c6d0da';
const BELLY_ALT = '#cfe0f2';
const OUTLINE = '#0d1219';
const OUTLINE_ALT = '#0e1a2c';
const INK = '#0a0d12';

/** ネイティブ描画高（足元 0 → 頭 -60 付近）。 */
const NATIVE_H = 66;

function leg(ctx: Ctx, body: string, outline: string, x: number, y: number, w: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, w, 3.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = outline;
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

  // ダウン: 横倒れ（脚を上に）
  if (pose.lying) {
    ctx.scale(k, k);
    ctx.beginPath();
    ctx.ellipse(0, -10, 25, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = body; ctx.fill();
    ctx.lineWidth = 2.4; ctx.strokeStyle = outline; ctx.stroke();
    // 上に伸びる首＋バツ目の頭
    ctx.beginPath();
    ctx.moveTo(16, -12); ctx.quadraticCurveTo(26, -22, 24, -30);
    ctx.lineWidth = 6; ctx.strokeStyle = body; ctx.stroke();
    ctx.beginPath(); ctx.arc(24, -32, 6, 0, Math.PI * 2); ctx.fillStyle = body; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = outline; ctx.stroke();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    for (const [ex, ey] of [[22, -33], [26, -32]] as const) {
      ctx.beginPath(); ctx.moveTo(ex - 1.4, ey - 1.4); ctx.lineTo(ex + 1.4, ey + 1.4);
      ctx.moveTo(ex + 1.4, ey - 1.4); ctx.lineTo(ex - 1.4, ey + 1.4); ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (pose.tumble !== 0) {
    ctx.translate(0, -f.h / 2); ctx.rotate(pose.tumble); ctx.translate(0, f.h / 2);
  }

  const crouchSy = pose.crouch ? def.crouchH / def.h : 1;
  const crouchSx = pose.crouch ? 1.14 : 1;
  ctx.scale(k * pose.sx * crouchSx, k * pose.sy * crouchSy);
  ctx.rotate(pose.lean);

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // しっぽ（後方へ伸びて上へ反る）
  ctx.beginPath();
  ctx.moveTo(-16, -16);
  ctx.quadraticCurveTo(-34, -14, -40, -22);
  ctx.quadraticCurveTo(-30, -10, -14, -8);
  ctx.closePath();
  ctx.fillStyle = body; ctx.fill();
  ctx.lineWidth = 2.4; ctx.strokeStyle = outline; ctx.stroke();

  // 4本の短い脚（奥2本は暗め・手前2本は歩行ストライド）
  leg(ctx, outline, outline, -8, -3, 5.5);
  leg(ctx, outline, outline, 8, -3, 5.5);
  leg(ctx, body, outline, -8 + pose.strideB, -3 - (pose.strideB > 0 ? pose.lift : 0), 6);
  leg(ctx, body, outline, 8 + pose.strideF, -3 - (pose.strideF > 0 ? pose.lift : 0), 6);

  ctx.save();
  ctx.translate(0, pose.bob);

  // 胴（丸くずんぐり）
  ctx.beginPath();
  ctx.ellipse(-1, -22, 21, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = body; ctx.fill();
  ctx.lineWidth = 2.6; ctx.strokeStyle = outline; ctx.stroke();
  // 腹（明色）
  ctx.beginPath();
  ctx.ellipse(1, -16, 15, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = belly; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;

  // ---- 首＋頭（＝攻撃の「腕」。首を突き出して噛む） ----
  const baseX = 13, baseY = -30;
  // idle は首を上へ、攻撃(armExt/armRot)で前へ突き出す
  const angle = -1.15 + (pose.armRot - 0.45) * 0.72;
  const reach = 24 + pose.armExt;
  const hx = baseX + Math.cos(angle) * reach;
  const hy = baseY + Math.sin(angle) * reach;
  // 首（太→細へテーパー。二次曲線で弧）
  const midX = baseX + Math.cos(angle) * reach * 0.5 + 3;
  const midY = baseY + Math.sin(angle) * reach * 0.5;
  ctx.beginPath();
  ctx.moveTo(baseX - 7, baseY + 2);
  ctx.quadraticCurveTo(midX - 5, midY, hx - 5, hy + 1);
  ctx.lineTo(hx + 4, hy - 2);
  ctx.quadraticCurveTo(midX + 6, midY - 2, baseX + 7, baseY - 2);
  ctx.closePath();
  ctx.fillStyle = body; ctx.fill();
  ctx.lineWidth = 2.4; ctx.strokeStyle = outline; ctx.stroke();

  // 頭（小さく丸い・短い口吻）
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(angle + Math.PI / 2);
  ctx.beginPath();
  ctx.ellipse(0, 0, 8, 7, 0, 0, Math.PI * 2);
  ctx.fillStyle = body; ctx.fill();
  ctx.lineWidth = 2.2; ctx.strokeStyle = outline; ctx.stroke();
  // 口吻（前方へ）
  ctx.beginPath();
  ctx.ellipse(6, 1, 4.5, 3.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = body; ctx.fill(); ctx.stroke();
  // 鼻の穴
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(9, 0.5, 0.9, 0, Math.PI * 2); ctx.fill();
  // 目（被弾で ><）
  if (pose.hurt) {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-2, -3); ctx.lineTo(2, 1); ctx.moveTo(2, -3); ctx.lineTo(-2, 1); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(0, -1.5, 3, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = outline; ctx.stroke();
    ctx.beginPath(); ctx.arc(1, -1.5, 1.5, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
  }
  ctx.restore();

  // 噛み付き active のスピード線
  if (pose.armExt > 10) {
    ctx.strokeStyle = 'rgba(200,220,240,0.5)';
    ctx.lineWidth = 1.4;
    for (const dy of [-4, 0, 4]) {
      ctx.beginPath(); ctx.moveTo(hx - Math.cos(angle) * 16, hy - Math.sin(angle) * 16 + dy);
      ctx.lineTo(hx - Math.cos(angle) * 6, hy - Math.sin(angle) * 6 + dy); ctx.stroke();
    }
  }
  // 待機中の雨のしずく（Deno の象徴）
  if (f.atk <= 0 && f.grounded) {
    ctx.strokeStyle = 'rgba(150,190,230,0.35)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const rx = -18 + ((anim.tick * 0.6 + i * 40) % 60) * 0.6 + i * 12;
      const ry = -58 + ((anim.tick * 1.3 + i * 20) % 40);
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 1.5, ry + 5); ctx.stroke();
    }
  }

  ctx.restore(); // bob
  ctx.restore();
}
