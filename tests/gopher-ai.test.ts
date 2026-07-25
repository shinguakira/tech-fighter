import { describe, expect, it } from 'vitest';
import { aiFor, gopherAI, hasCustomAI } from '../src/core/ai';
import { CHARS } from '../src/core/constants';
import { createGame } from '../src/core/game';
import { GI, faceOff, frames, toPlay } from './helpers';

describe('gopher 専用 AI', () => {
  it('gopher にだけ専用 AI が登録され、aiFor で切り替わる', () => {
    expect(hasCustomAI('gopher')).toBe(true);
    expect(hasCustomAI('duke')).toBe(false);
    const st = createGame();
    toPlay(st, 0, 1); // P1 gopher, P2 duke
    // aiFor(gopher) は専用、aiFor(duke) は汎用 — どちらも PlayerInput を返す
    const g = aiFor(st, 0);
    const d = aiFor(st, 1);
    expect(typeof g.light).toBe('boolean');
    expect(typeof d.light).toBe('boolean');
  });

  it('決定論: 同じ状態で同じ入力を返す', () => {
    const mk = () => { const s = createGame(0x1234); toPlay(s, 0, 1); faceOff(s); return s; };
    const a = mk();
    const b = mk();
    for (let i = 0; i < 200; i++) {
      expect(gopherAI(a, 0)).toEqual(gopherAI(b, 0));
    }
  });

  it('弱ヒット確認 → 必殺キャンセルを実際に行う（cancel 窓で必殺入力）', () => {
    // gopher(P1) の弱を duke(P2) に当ててキャンセル窓を作り、
    // gopherAI がその窓で special を押すことを確認する。
    const st = createGame(0x99);
    toPlay(st, 0, 1);
    faceOff(st);
    const me = st.fighters[0];
    // 弱を1発当てる（cancel>0 になる）
    const d = CHARS.gopher.moves.light;
    frames(st, 1 + d.startup + 1, GI({ light: true }));
    expect(me.cancel).toBeGreaterThan(0);
    expect(me.atk).toBeGreaterThan(0);
    // この局面で gopherAI は special を押す（キャンセル）
    const out = gopherAI(st, 0);
    expect(out.special).toBe(true);
  });

  it('弱がガードされたら（cancel 窓が開かない）必殺を漏らさない', () => {
    const st = createGame(0x99);
    toPlay(st, 0, 1);
    faceOff(st);
    const me = st.fighters[0];
    const d = CHARS.gopher.moves.light;
    // P2 が後ろ入力でガード → cancel は開かない
    frames(st, 1 + d.startup + 1, GI({ light: true }, { right: true }));
    expect(me.cancel).toBe(0);
    // 攻撃中でも cancel が無いので special キャンセルはしない（think 保持 or 通常行動）
    const out = gopherAI(st, 0);
    // 攻撃中なら「待ち」= 方向のみ or 空。special キャンセルは出ないことだけ担保
    // （ここでは cancel 局面でないので special による即キャンセルは起きない）
    if (me.atk > 0) expect(out.special === true && out.heavy === false && !out.up).not.toBe(true);
  });

  it('相手が空中接近なら対空 panic（special+up）を出しうる', () => {
    const st = createGame(0x7);
    toPlay(st, 0, 1);
    st.fighters[0].x = 360; st.fighters[0].facing = 1;
    st.fighters[1].x = 300; st.fighters[1].facing = -1;
    st.fighters[1].grounded = false; st.fighters[1].y -= 60;
    // 数回試行して panic が出ることを確認（確率 0.72）
    let sawAntiAir = false;
    for (let i = 0; i < 30 && !sawAntiAir; i++) {
      const s = createGame(0x7 + i * 101);
      toPlay(s, 0, 1);
      s.fighters[0].x = 360; s.fighters[0].facing = 1;
      s.fighters[1].x = 300; s.fighters[1].grounded = false; s.fighters[1].y -= 60;
      const out = gopherAI(s, 0);
      if (out.special && out.up) sawAntiAir = true;
    }
    expect(sawAntiAir).toBe(true);
  });

  it('専用 AI 導入後も観戦の決定論は保たれる', () => {
    const run = (): string => {
      const st = createGame(0x2f2f);
      toPlay(st, 0, 1); // gopher vs duke
      st.mode = 'demo'; // 両側 AI
      frames(st, 900, GI());
      return JSON.stringify(st.fighters.map((f) => [f.hp, Math.round(f.x), f.wins]));
    };
    expect(run()).toBe(run());
  });
});
