// GameState → Canvas 描画のみ（ロジック無し）
import { CHARS, CHAR_LIST, FLOOR_Y, H, METER_MAX, ROUND_END_FRAMES, SUPER_COST, W, WINS_NEED, charAt } from '../core/constants';
import { hasCustomAI } from '../core/ai';
import { timerSec } from '../core/game';
import type { CharId, Effect, Fighter, GameState, Projectile } from '../core/types';
import { drawDeno } from './deno';
import { drawDuke } from './duke';
import { drawFerris } from './ferris';
import { drawGnu } from './gnu';
import { drawGopher } from './gopher';
import { drawTux } from './tux';
import { createFighterAnim, type FighterAnim } from './pose';

type Ctx2 = CanvasRenderingContext2D;
/** キャラ描画のディスパッチ。 */
const DRAW: Record<CharId, (c: Ctx2, f: Fighter, a: FighterAnim) => void> = {
  gopher: drawGopher,
  duke: drawDuke,
  ferris: drawFerris,
  tux: drawTux,
  deno: drawDeno,
  gnu: drawGnu,
};

type Ctx = CanvasRenderingContext2D;

const FONT = '"Chakra Petch"';

/** 描画側だけの持続状態（cosmetic）。 */
interface RenderState {
  anims: [FighterAnim, FighterAnim];
  /** 体力バーの遅れ演出 */
  hpLag: [number, number];
  tick: number;
}
const rs: RenderState = { anims: [createFighterAnim(), createFighterAnim()], hpLag: [1, 1], tick: 0 };

export function resetRenderState(): void {
  rs.anims = [createFighterAnim(), createFighterAnim()];
  rs.hpLag = [1, 1];
}

// ---- ステージ ---------------------------------------------------------------

function drawStage(c: Ctx, tick: number): void {
  // 空: 深いターミナルブルー
  const sky = c.createLinearGradient(0, 0, 0, FLOOR_Y);
  sky.addColorStop(0, '#0a1020');
  sky.addColorStop(0.7, '#0e1b2e');
  sky.addColorStop(1, '#12253a');
  c.fillStyle = sky;
  c.fillRect(0, 0, W, FLOOR_Y);

  // 遠景: サーバーラックのシルエット＋点滅 LED
  c.fillStyle = '#0c1626';
  for (let i = 0; i < 7; i++) {
    const x = 20 + i * 115;
    const h = 150 + ((i * 53) % 90);
    c.fillRect(x, FLOOR_Y - h, 78, h);
  }
  for (let i = 0; i < 7; i++) {
    const x = 20 + i * 115;
    const h = 150 + ((i * 53) % 90);
    for (let r = 0; r < 5; r++) {
      const on = Math.floor(tick / 24 + i * 3 + r * 7) % 5 !== 0;
      c.fillStyle = on ? (r % 2 === 0 ? 'rgba(90,220,140,0.5)' : 'rgba(80,170,255,0.45)') : 'rgba(50,60,80,0.4)';
      c.fillRect(x + 8, FLOOR_Y - h + 14 + r * 26, 4, 4);
      c.fillRect(x + 60, FLOOR_Y - h + 14 + r * 26, 4, 4);
    }
  }

  // 浮遊コード片
  c.font = `500 11px ${FONT}`;
  const glyphs = ['{ }', '</>', ';', '=>', '::', '()', '[]'];
  for (let i = 0; i < 7; i++) {
    const y = 60 + ((i * 97 + tick * 0.2) % 300);
    const x = 60 + ((i * 173) % 680);
    c.fillStyle = `rgba(90,150,190,${0.16 + (i % 3) * 0.05})`;
    c.fillText(glyphs[i % glyphs.length]!, x, y);
  }

  // 床: グリッド
  const fg = c.createLinearGradient(0, FLOOR_Y, 0, H);
  fg.addColorStop(0, '#101c2a');
  fg.addColorStop(1, '#070b12');
  c.fillStyle = fg;
  c.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  c.strokeStyle = 'rgba(80,200,170,0.5)';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(0, FLOOR_Y + 1);
  c.lineTo(W, FLOOR_Y + 1);
  c.stroke();
  c.strokeStyle = 'rgba(70,140,160,0.15)';
  c.lineWidth = 1;
  for (let i = 0; i <= 16; i++) {
    const x = i * 50;
    const vx = (x - W / 2) * 2.2 + W / 2;
    c.beginPath();
    c.moveTo(x, FLOOR_Y);
    c.lineTo(vx, H);
    c.stroke();
  }
  for (const yy of [FLOOR_Y + 14, FLOOR_Y + 34]) {
    c.beginPath();
    c.moveTo(0, yy);
    c.lineTo(W, yy);
    c.stroke();
  }
}

// ---- 飛び道具 ---------------------------------------------------------------

function drawProjectile(c: Ctx, p: Projectile, tick: number): void {
  if (p.dead || p.delay > 0) return;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const dir = Math.sign(p.vx) || 1;
  c.save();
  if (p.kind === 'gofunc' || p.kind === 'swarm') {
    // 小型 gopher 弾: シアンの弾丸型＋耳＋残像
    const r = p.kind === 'swarm' ? 8.5 : 9;
    c.fillStyle = 'rgba(106,215,229,0.25)';
    for (let i = 1; i <= 3; i++) {
      c.beginPath();
      c.ellipse(cx - dir * i * 8, cy, r * (1 - i * 0.2), r * 0.8 * (1 - i * 0.2), 0, 0, Math.PI * 2);
      c.fill();
    }
    c.beginPath();
    c.ellipse(cx, cy, r, r * 0.78, 0, 0, Math.PI * 2);
    c.fillStyle = '#6ad7e5';
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = '#17151c';
    c.stroke();
    // 耳
    for (const ey of [-r * 0.55, r * 0.55]) {
      c.beginPath();
      c.arc(cx + dir * r * 0.4, cy + ey, r * 0.3, 0, Math.PI * 2);
      c.fillStyle = '#6ad7e5';
      c.fill();
      c.stroke();
    }
    // 目
    c.fillStyle = '#111318';
    c.beginPath();
    c.arc(cx + dir * r * 0.5, cy - 1, 1.5, 0, Math.PI * 2);
    c.fill();
  } else if (p.kind === 'null') {
    // NullPointerException: 赤リングの "null"
    const wob = Math.sin(tick * 0.25) * 2;
    c.beginPath();
    c.arc(cx, cy + wob, 17, 0, Math.PI * 2);
    c.fillStyle = 'rgba(226,58,46,0.18)';
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = '#e23a2e';
    c.stroke();
    c.font = `700 12px Consolas, monospace`;
    c.textAlign = 'center';
    c.fillStyle = '#ffffff';
    c.fillText('null', cx, cy + wob + 4);
    // スパーク
    c.strokeStyle = 'rgba(255,170,80,0.7)';
    c.lineWidth = 1.4;
    const a0 = tick * 0.3;
    for (let i = 0; i < 3; i++) {
      const a = a0 + (i * Math.PI * 2) / 3;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * 19, cy + wob + Math.sin(a) * 19);
      c.lineTo(cx + Math.cos(a) * 24, cy + wob + Math.sin(a) * 24);
      c.stroke();
    }
  } else if (p.kind === 'fetch') {
    // fetch(): 青緑の高速データパケット＋"GET" ＋残像
    c.fillStyle = 'rgba(112,201,161,0.22)';
    for (let i = 1; i <= 3; i++) {
      c.fillRect(cx - dir * i * 9 - 12, cy - 7 + i, 24, 14 - i * 2);
    }
    c.fillStyle = '#122a20';
    c.fillRect(p.x, p.y, p.w, p.h);
    c.strokeStyle = '#70c9a1';
    c.lineWidth = 2;
    c.strokeRect(p.x, p.y, p.w, p.h);
    c.font = `700 10px Consolas, monospace`;
    c.textAlign = 'center';
    c.fillStyle = '#d6f5e6';
    c.fillText('GET', cx, cy + 3.5);
  } else if (p.kind === 'rain') {
    // DENO DEPLOY: 落ちてくる TS ブロック
    c.save();
    c.fillStyle = 'rgba(90,165,68,0.25)';
    for (let i = 1; i <= 2; i++) c.fillRect(p.x + 2, p.y - i * 10, p.w - 4, 6);
    c.fillStyle = '#2f6ea5';
    c.fillRect(p.x, p.y, p.w, p.h);
    c.strokeStyle = '#7adcf0';
    c.lineWidth = 2;
    c.strokeRect(p.x, p.y, p.w, p.h);
    c.font = `700 11px Consolas, monospace`;
    c.textAlign = 'center';
    c.fillStyle = '#e8f4ff';
    c.fillText('TS', cx, cy + 4);
    c.restore();
  } else if (p.kind === 'boomerang') {
    // Recursive GNU: 回転するブーメラン（"GNU" の弧）
    c.save();
    c.translate(cx, cy);
    c.rotate(tick * 0.4 * (p.vx >= 0 ? 1 : -1));
    c.strokeStyle = '#e8e0d2';
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(0, 0, 9, Math.PI * 0.15, Math.PI * 1.15);
    c.stroke();
    c.strokeStyle = '#7c5a3a';
    c.lineWidth = 2.4;
    c.stroke();
    c.restore();
  } else if (p.kind === 'gpl') {
    // GPL CASCADE: 回転する巨大コピーレフト記号 Ↄ
    const r = p.w / 2;
    c.save();
    const g = c.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
    g.addColorStop(0, 'rgba(255,210,74,0.20)');
    g.addColorStop(0.8, 'rgba(200,150,60,0.34)');
    g.addColorStop(1, 'rgba(160,110,40,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.translate(cx, cy);
    c.rotate(-tick * 0.14 * dir);
    // 反転 C（コピーレフト）
    c.beginPath();
    c.arc(0, 0, r * 0.62, Math.PI * 1.25, Math.PI * 0.75, false);
    c.lineWidth = 6;
    c.strokeStyle = '#ffd24a';
    c.lineCap = 'round';
    c.stroke();
    c.font = `700 12px Consolas, monospace`;
    c.textAlign = 'center';
    c.fillStyle = '#fff4d0';
    c.fillText('GPL', 0, r + 12);
    c.restore();
  } else if (p.kind === 'crate') {
    // cargo throw: 回転しながら飛ぶ木箱＋歯車マーク
    c.save();
    c.translate(cx, cy);
    c.rotate(tick * 0.12 * dir);
    c.fillStyle = '#c98a4b';
    c.fillRect(-11, -10, 22, 20);
    c.strokeStyle = '#6b4423';
    c.lineWidth = 2;
    c.strokeRect(-11, -10, 22, 20);
    c.beginPath();
    c.moveTo(-11, -3); c.lineTo(11, -3);
    c.moveTo(-11, 3); c.lineTo(11, 3);
    c.lineWidth = 1.2;
    c.stroke();
    // Rust の歯車風マーク
    c.beginPath();
    c.arc(0, 0, 4.5, 0, Math.PI * 2);
    c.strokeStyle = '#f74c00';
    c.lineWidth = 2;
    c.stroke();
    c.restore();
  } else if (p.kind === 'pipe') {
    // Pipe | Stream: 地を這う緑のターミナル流
    c.save();
    c.globalAlpha = 0.35;
    c.fillStyle = '#5fd08a';
    for (let i = 1; i <= 3; i++) {
      c.fillRect(cx - dir * i * 10 - 12, p.y + 2 + i, 24 - i * 5, p.h - 4 - i);
    }
    c.globalAlpha = 1;
    c.fillStyle = '#134a2a';
    c.fillRect(p.x, p.y, p.w, p.h);
    c.strokeStyle = '#5fd08a';
    c.lineWidth = 2;
    c.strokeRect(p.x, p.y, p.w, p.h);
    c.font = `700 11px Consolas, monospace`;
    c.textAlign = 'center';
    c.fillStyle = '#b8ffd6';
    c.fillText(dir > 0 ? '|>' : '<|', cx, cy + 4);
    c.restore();
  } else if (p.kind === 'beam') {
    // KERNEL PANIC: 白熱の横断ビーム
    c.save();
    const g = c.createLinearGradient(p.x, 0, p.x + p.w, 0);
    const head = dir > 0 ? 1 : 0;
    g.addColorStop(1 - head, 'rgba(255,240,200,0.15)');
    g.addColorStop(head, 'rgba(255,250,235,0.95)');
    c.fillStyle = g;
    c.fillRect(p.x, p.y, p.w, p.h);
    c.fillStyle = 'rgba(255,255,255,0.9)';
    c.fillRect(p.x, cy - 8, p.w, 16);
    c.strokeStyle = '#ffd24a';
    c.lineWidth = 2.5;
    c.strokeRect(p.x, p.y, p.w, p.h);
    c.font = `700 12px Consolas, monospace`;
    c.textAlign = 'center';
    c.fillStyle = '#ffedb8';
    c.fillText('KERNEL PANIC', cx, p.y - 6);
    // ノイズ走査線
    c.globalAlpha = 0.5;
    c.strokeStyle = '#ffaa3a';
    c.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const yy = p.y + 8 + ((i * 17 + tick * 3) % (p.h - 16));
      c.beginPath();
      c.moveTo(p.x + 4, yy);
      c.lineTo(p.x + p.w - 4, yy);
      c.stroke();
    }
    c.restore();
  } else if (p.kind === 'oom') {
    // OutOfMemoryError: 拡大する赤熱リング
    const r = p.w / 2;
    const g = c.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
    g.addColorStop(0, 'rgba(255,120,60,0.12)');
    g.addColorStop(0.8, 'rgba(255,80,40,0.34)');
    g.addColorStop(1, 'rgba(255,60,30,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 3.5;
    c.strokeStyle = `rgba(255,${140 - (tick % 10) * 6},60,0.85)`;
    c.beginPath();
    c.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
    c.stroke();
    c.font = `700 13px Consolas, monospace`;
    c.textAlign = 'center';
    c.fillStyle = '#ffd9a8';
    c.fillText('OutOfMemoryError', cx, cy - r * 0.92 - 6);
  }
  c.restore();
}

// ---- エフェクト -------------------------------------------------------------

function drawEffect(c: Ctx, e: Effect): void {
  const t = e.t / e.total;
  c.save();
  if (e.kind === 'spark') {
    const r = 4 + t * 22;
    c.globalAlpha = 1 - t;
    c.strokeStyle = '#ffe27a';
    c.lineWidth = 3 * (1 - t) + 1;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + 0.35;
      c.beginPath();
      c.moveTo(e.x + Math.cos(a) * r * 0.35, e.y + Math.sin(a) * r * 0.35);
      c.lineTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r);
      c.stroke();
    }
    c.fillStyle = '#ffffff';
    c.globalAlpha = (1 - t) * 0.9;
    c.beginPath();
    c.arc(e.x, e.y, 5 * (1 - t) + 1, 0, Math.PI * 2);
    c.fill();
  } else if (e.kind === 'block') {
    c.globalAlpha = 1 - t;
    c.strokeStyle = '#7ab0ff';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(e.x - e.dir * 6, e.y, 14 + t * 6, -Math.PI * 0.45 * -e.dir - (e.dir > 0 ? 0 : Math.PI), Math.PI * 0.45 * (e.dir > 0 ? 1 : 1) - (e.dir > 0 ? 0 : Math.PI));
    c.stroke();
    c.fillStyle = 'rgba(122,176,255,0.25)';
    c.beginPath();
    c.arc(e.x - e.dir * 6, e.y, 12 + t * 5, 0, Math.PI * 2);
    c.fill();
  } else if (e.kind === 'ko') {
    const r = 10 + t * 90;
    c.globalAlpha = (1 - t) * 0.85;
    c.strokeStyle = '#ff5f5f';
    c.lineWidth = 5 * (1 - t) + 1;
    c.beginPath();
    c.arc(e.x, e.y, r, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = '#ffffff';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(e.x, e.y, r * 0.7, 0, Math.PI * 2);
    c.stroke();
  } else if (e.kind === 'dust') {
    c.globalAlpha = (1 - t) * 0.5;
    c.fillStyle = '#9aa6b8';
    c.beginPath();
    c.arc(e.x - e.dir * t * 12, e.y - t * 6, 3 + t * 4, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

// ---- HUD --------------------------------------------------------------------

function drawHpBar(c: Ctx, f: Fighter, side: 0 | 1, lag: number, customAi: boolean): void {
  const bw = 320;
  const bh = 20;
  const y = 22;
  const x = side === 0 ? 30 : W - 30 - bw;
  const ratio = Math.max(0, f.hp / f.maxhp);

  c.save();
  // 枠
  c.fillStyle = 'rgba(8,12,20,0.8)';
  c.fillRect(x - 3, y - 3, bw + 6, bh + 6);
  c.strokeStyle = '#3a5468';
  c.lineWidth = 1.5;
  c.strokeRect(x - 3, y - 3, bw + 6, bh + 6);
  // 遅れバー（白）
  c.fillStyle = '#e8e4d8';
  const lagW = bw * lag;
  c.fillRect(side === 0 ? x + bw - lagW : x, y, lagW, bh);
  // 本体（緑→黄→赤）
  const col = ratio > 0.5 ? '#5fd08a' : ratio > 0.25 ? '#ffd24a' : '#ff5f5f';
  const g = c.createLinearGradient(0, y, 0, y + bh);
  g.addColorStop(0, col);
  g.addColorStop(1, ratio > 0.5 ? '#3da868' : ratio > 0.25 ? '#d8a828' : '#d03a3a');
  c.fillStyle = g;
  const hpW = bw * ratio;
  c.fillRect(side === 0 ? x + bw - hpW : x, y, hpW, bh);
  // 名前（専用 AI で動いているなら ★専用AI バッジ）
  c.font = `italic 700 14px ${FONT}`;
  c.textAlign = side === 0 ? 'left' : 'right';
  c.fillStyle = '#e8eef5';
  const name = CHARS[f.char].name + (f.alt ? ' (2P)' : '');
  const nameX = side === 0 ? x + 2 : x + bw - 2;
  c.fillText(name, nameX, y + bh + 16);
  if (customAi) {
    const nameW = c.measureText(name).width;
    c.font = `700 10px ${FONT}`;
    c.fillStyle = '#ffd24a';
    c.fillText('★専用AI', side === 0 ? nameX + nameW + 8 : nameX - nameW - 8, y + bh + 15);
  }
  // ラウンド取得ピップ
  for (let i = 0; i < WINS_NEED; i++) {
    const px = side === 0 ? x + bw - 12 - i * 18 : x + 12 + i * 18;
    c.beginPath();
    c.arc(px, y + bh + 12, 5.5, 0, Math.PI * 2);
    c.fillStyle = i < f.wins ? '#ffd24a' : 'rgba(60,80,100,0.6)';
    c.fill();
    c.strokeStyle = '#20303a';
    c.lineWidth = 1.4;
    c.stroke();
  }
  c.restore();
}

function drawMeter(c: Ctx, f: Fighter, side: 0 | 1, tick: number): void {
  const bw = 200;
  const bh = 12;
  const y = H - 30;
  const x = side === 0 ? 30 : W - 30 - bw;
  const ratio = f.meter / METER_MAX;
  const full = f.meter >= SUPER_COST;
  c.save();
  c.fillStyle = 'rgba(8,12,20,0.8)';
  c.fillRect(x - 2, y - 2, bw + 4, bh + 4);
  c.strokeStyle = full && tick % 20 < 10 ? '#ffd24a' : '#3a5468';
  c.lineWidth = 1.5;
  c.strokeRect(x - 2, y - 2, bw + 4, bh + 4);
  const g = c.createLinearGradient(x, 0, x + bw, 0);
  g.addColorStop(0, '#3a7ad0');
  g.addColorStop(1, '#8a5ae0');
  c.fillStyle = g;
  const mw = bw * ratio;
  c.fillRect(side === 0 ? x : x + bw - mw, y, mw, bh);
  c.font = `700 11px ${FONT}`;
  c.textAlign = side === 0 ? 'left' : 'right';
  c.fillStyle = full ? (tick % 20 < 10 ? '#ffd24a' : '#c9a0f5') : '#7a90a6';
  c.fillText(full ? 'STACK MAX — 必殺+強 で超必殺' : 'STACK', side === 0 ? x : x + bw, y - 6);
  c.restore();
}

function drawTimer(c: Ctx, st: GameState): void {
  const sec = timerSec(st);
  c.save();
  c.textAlign = 'center';
  c.font = `700 34px ${FONT}`;
  const danger = sec <= 10;
  c.fillStyle = danger && st.frame % 30 < 15 ? '#ff5f5f' : '#e8eef5';
  c.shadowColor = danger ? '#ff5f5f' : '#4a90c0';
  c.shadowBlur = 8;
  c.fillText(String(sec), W / 2, 52);
  c.restore();
}

// ---- 画面 -------------------------------------------------------------------

/** キャラの見本描画（select/タイトル用のダミー Fighter）。 */
function dummyFighter(char: CharId, x: number, facing: 1 | -1, alt = false): Fighter {
  const d = CHARS[char];
  return {
    side: 0, char, x, y: FLOOR_Y - d.h, w: d.w, h: d.h,
    vx: 0, vy: 0, grounded: true, facing,
    hp: d.hp, maxhp: d.hp, meter: 0, crouch: false,
    atk: 0, atkTotal: 0, move: null, atkId: 0, atkHit: false,
    hitstun: 0, blockstun: 0, blocking: false,
    kd: 0, kdPending: false, invul: 0, juggle: 0,
    airAtk: false, airVx: 0, buf: null, cancel: 0, wins: 0, alt,
  };
}
const titleAnims: FighterAnim[] = CHAR_LIST.map(() => createFighterAnim());

function drawCredit(c: Ctx): void {
  c.save();
  c.textAlign = 'center';
  c.font = `500 9.5px ${FONT}`;
  c.fillStyle = '#5a6a7a';
  c.fillText('Go gopher by Renée French (CC BY 4.0)　·　Duke © Sun Microsystems (New BSD)　·　Ferris by Karen Rustad Tölva (CC0)', W / 2, H - 25);
  c.fillText('Tux by Larry Ewing (lewing@isc.tamu.edu) and The GIMP　·　Deno dino by ry (MIT)　·　GNU head by Aurélio Heckert (Free Art / GFDL)', W / 2, H - 13);
  c.restore();
}

function drawTitle(c: Ctx, st: GameState): void {
  drawStage(c, rs.tick);
  // ロゴ
  c.save();
  c.textAlign = 'center';
  c.shadowColor = '#40c0e0';
  c.shadowBlur = 22;
  c.fillStyle = '#7adcf0';
  c.font = `italic 700 58px ${FONT}`;
  c.fillText('TECH FIGHTER', W / 2, 130);
  c.shadowBlur = 0;
  c.font = `600 14px ${FONT}`;
  c.fillStyle = '#8a9aaa';
  c.fillText('GOPHER · DUKE · FERRIS · TUX · DENO · GNU', W / 2, 160);
  c.restore();

  // 6キャラの見本（中央メニューを避けて左右に3体ずつ・中央へ向く）
  const left: [CharId, number][] = [['ferris', 22], ['gopher', 92], ['deno', 158]];
  const right: [CharId, number][] = [['duke', 588], ['tux', 654], ['gnu', 720]];
  for (const [ch, x] of left) DRAW[ch](c, dummyFighter(ch, x, 1), titleAnims[CHAR_LIST.indexOf(ch)]!);
  for (const [ch, x] of right) DRAW[ch](c, dummyFighter(ch, x, -1), titleAnims[CHAR_LIST.indexOf(ch)]!);

  // モード選択（4択）
  const modes = ['VS CPU', '2P 対戦', '観戦 (CPU vs CPU)', 'オンライン対戦'];
  c.save();
  c.textAlign = 'center';
  for (let i = 0; i < modes.length; i++) {
    const y = 212 + i * 38;
    const sel = st.modeSel === i;
    const online = i === 3;
    c.fillStyle = sel ? (online ? 'rgba(120,220,150,0.25)' : 'rgba(80,180,220,0.25)') : 'rgba(16,26,40,0.8)';
    c.fillRect(W / 2 - 120, y - 20, 240, 30);
    c.strokeStyle = sel ? (online ? '#7ef0a8' : '#7adcf0') : '#2a4050';
    c.lineWidth = sel ? 2 : 1.2;
    c.strokeRect(W / 2 - 120, y - 20, 240, 30);
    c.font = `700 15px ${FONT}`;
    c.fillStyle = sel ? (online ? '#c8f5d8' : '#d6f2fa') : '#6a8090';
    c.fillText(modes[i]!, W / 2, y);
    if (sel && rs.tick % 40 < 25) {
      c.fillStyle = online ? '#7ef0a8' : '#7adcf0';
      c.fillText('▶', W / 2 - 138, y);
    }
  }
  c.font = `600 12px ${FONT}`;
  c.fillStyle = '#8a9aaa';
  c.fillText('W/S で選択 — Enter か 攻撃ボタンで決定', W / 2, 372);
  c.restore();
  drawCredit(c);
}

function drawSelect(c: Ctx, st: GameState, net: NetInfo | null = null): void {
  drawStage(c, rs.tick);
  c.save();
  c.textAlign = 'center';
  c.font = `italic 700 30px ${FONT}`;
  c.fillStyle = '#e8eef5';
  c.shadowColor = '#40c0e0';
  c.shadowBlur = 12;
  c.fillText('CHOOSE YOUR FIGHTER', W / 2, 70);
  c.restore();

  // n 枚のキャラカード（幅は枚数に合わせて自動）
  const SUBS: Record<CharId, string> = {
    gopher: 'Go 速い手数',
    duke: 'Java 重い一撃',
    ferris: 'Rust 掴み装甲',
    tux: 'Linux 下段弾幕',
    deno: 'Deno 万能突進',
    gnu: 'GNU 曲射搦め手',
  };
  const n = CHAR_LIST.length;
  const sideM = 12, gutter = 6, cardY = 96, cardH = 246;
  const cardW = (W - 2 * sideM - (n - 1) * gutter) / n;
  for (let i = 0; i < n; i++) {
    const char = charAt(i);
    const x0 = sideM + i * (cardW + gutter);
    const mid = x0 + cardW / 2;
    c.save();
    c.fillStyle = 'rgba(14,24,38,0.85)';
    c.fillRect(x0, cardY, cardW, cardH);
    // カーソル: P1=シアン（外）/ P2=オレンジ（内）。確定で緑。
    const p1Here = st.sel[0] === i;
    const p2Here = st.sel[1] === i && (st.mode === 'vs' || st.selDone[1]);
    c.lineWidth = 3;
    if (p1Here) {
      c.strokeStyle = st.selDone[0] ? '#5fd08a' : '#6ad7e5';
      c.strokeRect(x0, cardY, cardW, cardH);
    }
    if (p2Here) {
      c.strokeStyle = st.selDone[1] ? '#5fd08a' : '#ff8f5f';
      c.strokeRect(x0 + 5, cardY + 5, cardW - 10, cardH - 10);
    }
    if (!p1Here && !p2Here) {
      c.strokeStyle = '#2a4050';
      c.lineWidth = 1.4;
      c.strokeRect(x0, cardY, cardW, cardH);
    }
    c.textAlign = 'center';
    c.font = `italic 700 16px ${FONT}`;
    c.fillStyle = '#e8eef5';
    c.fillText(CHARS[char].name, mid, cardY + 28);
    c.font = `500 10px ${FONT}`;
    c.fillStyle = '#8a9aaa';
    c.fillText(SUBS[char], mid, cardY + 46);
    c.restore();
    // キャラ見本（カード内に立たせる）
    const dummy = dummyFighter(char, mid - CHARS[char].w / 2, 1);
    dummy.y = cardY + 232 - CHARS[char].h;
    DRAW[char](c, dummy, titleAnims[i]!);
  }

  c.save();
  c.textAlign = 'center';
  c.font = `600 13px ${FONT}`;
  c.fillStyle = '#8a9aaa';
  if (net) {
    // オンライン: 自分の側だけを操作。両者とも 1P キー（A/D＋J）。
    const you = net.localSide === 0 ? '左 (1P・シアン枠)' : '右 (2P・オレンジ枠)';
    c.fillStyle = '#7ef0a8';
    c.fillText(`ONLINE — あなたは ${you}`, W / 2, 372);
    c.fillStyle = '#8a9aaa';
    c.fillText('A / D で選択、J（攻撃）で決定', W / 2, 392);
  } else if (st.mode === 'vs') {
    c.fillText('1P: A/D + J で決定　　2P: ←/→ + テンキー1 で決定', W / 2, 390);
  } else {
    c.fillText('A/D で選択 — J/K/L で決定（CPU は隣のキャラを使用）', W / 2, 390);
  }
  const p1c = charAt(st.sel[0]);
  const youMark = (side: 0 | 1): string => (net && net.localSide === side ? ' ◀あなた' : '');
  c.font = `500 12px ${FONT}`;
  c.fillStyle = '#6a8090';
  c.fillText(`1P: ${CHARS[p1c].name}${st.selDone[0] ? ' ✔' : ''}${youMark(0)}`, W / 2 - 130, 414);
  if (st.mode === 'vs') {
    const p2c = charAt(st.sel[1]);
    c.fillText(`2P: ${CHARS[p2c].name}${st.selDone[1] ? ' ✔' : ''}${youMark(1)}`, W / 2 + 130, 414);
  }
  c.restore();
  drawCredit(c);
}

// ---- メイン render ----------------------------------------------------------

/** オンライン対戦時のゲーム内文脈（配線層から渡す）。null=オフライン。 */
export interface NetInfo { localSide: 0 | 1; roomId: string; stalled: boolean }

// ---- タップ判定（タッチ/クリック用。座標は 800x480 キャンバス系） ----
/** タイトルのモード行（0..3）。外れは -1。drawTitle のレイアウトと一致させる。 */
export function hitTitleMode(cx: number, cy: number): number {
  for (let i = 0; i < 4; i++) {
    const y = 212 + i * 38;
    if (cx >= W / 2 - 120 && cx <= W / 2 + 120 && cy >= y - 20 && cy <= y + 12) return i;
  }
  return -1;
}
/** セレクトのカード（0..n-1）。外れは -1。drawSelect のレイアウトと一致させる。 */
export function hitSelectCard(cx: number, cy: number): number {
  const n = CHAR_LIST.length, sideM = 12, gutter = 6, cardY = 96, cardH = 246;
  const cardW = (W - 2 * sideM - (n - 1) * gutter) / n;
  if (cy < cardY || cy > cardY + cardH) return -1;
  for (let i = 0; i < n; i++) {
    const x0 = sideM + i * (cardW + gutter);
    if (cx >= x0 && cx <= x0 + cardW) return i;
  }
  return -1;
}

export function render(c: Ctx, st: GameState, net: NetInfo | null = null): void {
  rs.tick++;
  c.clearRect(0, 0, W, H);

  if (st.status === 'title') { drawTitle(c, st); return; }
  if (st.status === 'select') { drawSelect(c, st, net); return; }

  // 画面シェイク
  c.save();
  if (st.shake > 0) {
    const s = st.shake;
    c.translate(((rs.tick * 7) % 5 - 2) * s * 0.25, ((rs.tick * 11) % 5 - 2) * s * 0.2);
  }

  drawStage(c, rs.tick);

  // 体力バーの遅れ演出
  for (const side of [0, 1] as const) {
    const target = Math.max(0, st.fighters[side].hp / st.fighters[side].maxhp);
    if (rs.hpLag[side] > target) rs.hpLag[side] = Math.max(target, rs.hpLag[side] - 0.004);
    else rs.hpLag[side] = target;
  }

  // キャラ（後: 2P → 前: 1P。攻撃中の方を前に）
  const order: [Fighter, Fighter] =
    st.fighters[0].atk > 0 ? [st.fighters[1], st.fighters[0]] : [st.fighters[0], st.fighters[1]];
  for (const f of order) {
    DRAW[f.char](c, f, rs.anims[f.side]);
  }

  // 飛び道具・エフェクト
  for (const p of st.projectiles) drawProjectile(c, p, rs.tick);
  for (const e of st.effects) drawEffect(c, e);

  // HUD（その側が AI 操作かつ専用 AI なら ★バッジ）
  const aiCtl = (side: 0 | 1): boolean => st.mode === 'demo' || (st.mode === 'cpu' && st.aiSide === side);
  drawHpBar(c, st.fighters[0], 0, rs.hpLag[0], aiCtl(0) && hasCustomAI(st.fighters[0].char));
  drawHpBar(c, st.fighters[1], 1, rs.hpLag[1], aiCtl(1) && hasCustomAI(st.fighters[1].char));
  drawTimer(c, st);
  drawMeter(c, st.fighters[0], 0, rs.tick);
  drawMeter(c, st.fighters[1], 1, rs.tick);

  // ROUND 表示
  c.save();
  c.textAlign = 'center';
  c.font = `600 12px ${FONT}`;
  c.fillStyle = '#7a90a6';
  c.fillText(`ROUND ${st.round}`, W / 2, 70);
  c.restore();

  // 観戦バナー（CPU vs CPU 巡回中）
  if (st.mode === 'demo') {
    c.save();
    c.textAlign = 'center';
    const pairs = st.demoPair % 15 + 1;
    c.font = `700 12px ${FONT}`;
    c.fillStyle = rs.tick % 60 < 40 ? '#ffd24a' : '#c98a3a';
    c.fillText(`● 観戦 CPU vs CPU  —  ${CHARS[st.fighters[0].char].name} vs ${CHARS[st.fighters[1].char].name}  (${pairs}/15)`, W / 2, 96);
    c.font = `500 10px ${FONT}`;
    c.fillStyle = '#7a90a6';
    c.fillText('ENTER で終了', W / 2, 112);
    c.restore();
  }

  // オンライン対戦の細バナー（select は drawSelect 側が扱うので除外）
  if (net) {
    c.save();
    c.textAlign = 'center';
    c.font = `700 10px ${FONT}`;
    c.fillStyle = net.stalled ? '#ff8f5f' : '#7ef0a8';
    const you = net.localSide === 0 ? '1P (左)' : '2P (右)';
    c.fillText(`● ONLINE  ルーム ${net.roomId}  あなた=${you}${net.stalled ? '  (通信待ち)' : ''}   ·   Esc で退出`, W / 2, 90);
    c.restore();
  }

  // 状態オーバーレイ
  c.save();
  c.textAlign = 'center';
  if (st.status === 'intro') {
    const t = st.statusTimer;
    c.font = `italic 700 52px ${FONT}`;
    if (t > 40) {
      c.fillStyle = '#e8eef5';
      c.shadowColor = '#4a90c0';
      c.shadowBlur = 16;
      c.fillText(`ROUND ${st.round}`, W / 2, 230);
    } else {
      c.fillStyle = '#ff8f5f';
      c.shadowColor = '#ff5f2f';
      c.shadowBlur = 20;
      const scale = 1 + (40 - t) * 0.01;
      c.save();
      c.translate(W / 2, 230);
      c.scale(scale, scale);
      c.fillText('FIGHT!', 0, 0);
      c.restore();
    }
  } else if (st.status === 'roundEnd') {
    const t = ROUND_END_FRAMES - st.statusTimer;
    const scale = Math.min(1, t * 0.08);
    c.save();
    c.translate(W / 2, 220);
    c.scale(scale, scale);
    c.font = `italic 700 72px ${FONT}`;
    c.fillStyle = st.roundMsg === 'K.O.' || st.roundMsg === 'DOUBLE K.O.' ? '#ff5f5f' : '#ffd24a';
    c.shadowColor = '#ff2f2f';
    c.shadowBlur = 24;
    c.fillText(st.roundMsg, 0, 0);
    c.restore();
  } else if (st.status === 'matchEnd') {
    c.fillStyle = 'rgba(4,8,14,0.72)';
    c.fillRect(0, 0, W, H);
    const wf = st.fighters[st.winner === 1 ? 1 : 0];
    c.font = `italic 700 48px ${FONT}`;
    c.fillStyle = '#ffd24a';
    c.shadowColor = '#ffaa2a';
    c.shadowBlur = 20;
    c.fillText(`${CHARS[wf.char].name} WINS!`, W / 2, 150);
    c.shadowBlur = 0;
    if (st.mode === 'vs') {
      drawRematchVote(c, st, net);
    } else if (st.statusTimer > 40) {
      c.font = `600 15px ${FONT}`;
      c.fillStyle = '#c8d4e0';
      c.fillText('攻撃ボタン: リマッチ　　Enter: タイトルへ', W / 2, 260);
    }
  }
  c.restore();

  c.restore(); // shake
}

/** 双方合意の再戦投票 UI（vs）。各サイドが はい/いいえ を選び攻撃で確定。 */
function drawRematchVote(c: Ctx, st: GameState, net: NetInfo | null): void {
  c.save();
  c.textAlign = 'center';
  c.fillStyle = '#e8eef5';
  c.font = `700 20px ${FONT}`;
  c.fillText('もう一度 対戦する？', W / 2, 210);

  const panelY = 250;
  const drawSide = (side: 0 | 1, cx: number): void => {
    const isYou = net && net.localSide === side;
    const label = (side === 0 ? '1P (左)' : '2P (右)') + (isYou ? ' — あなた' : '');
    c.font = `700 13px ${FONT}`;
    c.fillStyle = isYou ? '#7ef0a8' : '#9aa6b8';
    c.fillText(label, cx, panelY - 8);
    // はい / いいえ の2択
    const opts = ['はい', 'いいえ'];
    for (let o = 0; o < 2; o++) {
      const ox = cx + (o === 0 ? -46 : 46);
      const sel = st.rematchSel[side] === o;
      const done = st.rematchDone[side];
      c.font = `700 16px ${FONT}`;
      if (done) {
        // 確定後は選んだ方だけ強調（はい=緑 / いいえ=赤）
        c.fillStyle = sel ? (o === 0 ? '#7ef0a8' : '#ff8f7a') : 'rgba(120,130,145,0.4)';
      } else {
        c.fillStyle = sel ? '#ffd24a' : '#6a7889';
      }
      const box = 62, bh = 30;
      c.save();
      c.strokeStyle = sel ? (done ? (o === 0 ? '#7ef0a8' : '#ff8f7a') : '#ffd24a') : 'rgba(90,110,130,0.5)';
      c.lineWidth = sel ? 2 : 1.2;
      c.strokeRect(ox - box / 2, panelY + 6, box, bh);
      c.restore();
      c.fillText(opts[o]!, ox, panelY + 27);
    }
    // 確定マーク
    if (st.rematchDone[side]) {
      c.font = `700 12px ${FONT}`;
      c.fillStyle = '#5fd08a';
      c.fillText('✔ 決定', cx, panelY + 56);
    } else {
      c.font = `500 11px ${FONT}`;
      c.fillStyle = '#7a90a6';
      c.fillText('選択中…', cx, panelY + 56);
    }
  };
  drawSide(0, W / 2 - 150);
  drawSide(1, W / 2 + 150);

  c.font = `600 13px ${FONT}`;
  c.fillStyle = '#8a9aaa';
  const hint = net ? '← → で選び、攻撃ボタン(J)で決定' : '各自 ← → で選び、攻撃ボタンで決定';
  c.fillText(hint, W / 2, 340);
  c.font = `500 11px ${FONT}`;
  c.fillStyle = '#6a7889';
  c.fillText('両者「はい」で再戦、どちらかが「いいえ」なら終了', W / 2, 360);
  c.restore();
}
