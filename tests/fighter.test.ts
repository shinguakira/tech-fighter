import { describe, expect, it } from 'vitest';
import { CHARS, FLOOR_Y, SUPER_COST } from '../src/core/constants';
import { chooseMove, createFighter, startMove } from '../src/core/fighter';
import { createGame } from '../src/core/game';
import { GI, P, faceOff, frames, toPlay } from './helpers';

describe('fighter', () => {
  it('createFighter: 足元が床に接地して満タン HP', () => {
    const f = createFighter(0, 'gopher', 100, 1, false);
    expect(f.y + f.h).toBe(FLOOR_Y);
    expect(f.hp).toBe(CHARS.gopher.hp);
    expect(f.grounded).toBe(true);
  });

  it('歩き: 前進は forward 速度・後退は back 速度', () => {
    const st = createGame();
    toPlay(st);
    const x0 = st.fighters[0].x;
    frames(st, 10, GI({ right: true }));
    const fwd = st.fighters[0].x - x0;
    expect(fwd).toBeCloseTo(CHARS.gopher.walkF * 10, 0);
    const x1 = st.fighters[0].x;
    frames(st, 10, GI({ left: true }));
    expect(x1 - st.fighters[0].x).toBeCloseTo(CHARS.gopher.walkB * 10, 0);
  });

  it('ジャンプ: エッジで浮いて着地で戻る', () => {
    const st = createGame();
    toPlay(st);
    frames(st, 1, GI({ up: true }));
    expect(st.fighters[0].grounded).toBe(false);
    frames(st, 120, GI({ up: true })); // 押しっぱなしでも再ジャンプしない
    expect(st.fighters[0].grounded).toBe(true);
    expect(st.fighters[0].y + st.fighters[0].h).toBe(FLOOR_Y);
  });

  it('しゃがみ: 高さが縮み足元は変わらない', () => {
    const st = createGame();
    toPlay(st);
    frames(st, 2, GI({ down: true }));
    const f = st.fighters[0];
    expect(f.h).toBe(CHARS.gopher.crouchH);
    expect(f.y + f.h).toBe(FLOOR_Y);
    frames(st, 2, GI());
    expect(f.h).toBe(CHARS.gopher.h);
  });

  it('chooseMove: 弱/強/しゃがみ/必殺の分岐', () => {
    const st = createGame();
    toPlay(st);
    faceOff(st);
    const [a, b] = st.fighters;
    expect(chooseMove(a, P({ light: true }), P(), b)).toBe('light');
    expect(chooseMove(a, P({ down: true, heavy: true }), P(), b)).toBe('cheavy');
    expect(chooseMove(a, P({ special: true }), P(), b)).toBe('spN');
    expect(chooseMove(a, P({ special: true, up: true }), P(), b)).toBe('spU');
    expect(chooseMove(a, P({ special: true, right: true }), P(), b)).toBe('spF'); // 相手は右
    expect(chooseMove(a, P({ special: true, left: true }), P(), b)).toBe('spN');  // 後ろ入力は弾
  });

  it('超必殺: ゲージ不足では出ずに必殺になる。満タンで発動しゲージ消費', () => {
    const st = createGame();
    toPlay(st);
    faceOff(st);
    const a = st.fighters[0];
    expect(chooseMove(a, P({ special: true, heavy: true }), P(), st.fighters[1])).not.toBe('super');
    a.meter = SUPER_COST;
    expect(chooseMove(a, P({ special: true, heavy: true }), P(), st.fighters[1])).toBe('super');
    startMove(a, 'super');
    expect(a.meter).toBe(0);
  });

  it('攻撃開始: atk が総フレームからカウントダウン', () => {
    const st = createGame();
    toPlay(st);
    frames(st, 1, GI({ light: true }));
    const f = st.fighters[0];
    const d = CHARS.gopher.moves.light;
    expect(f.move).toBe('light');
    expect(f.atkTotal).toBe(d.startup + d.active + d.recovery);
    frames(st, f.atkTotal, GI());
    expect(f.move).toBeNull();
  });

  it('空中攻撃は1ジャンプ1回まで', () => {
    const st = createGame();
    toPlay(st);
    frames(st, 1, GI({ up: true }));
    frames(st, 2, GI());
    frames(st, 1, GI({ light: true }));
    const f = st.fighters[0];
    expect(f.move).toBe('air');
    // 技が終わってももう一度は出ない
    frames(st, f.atkTotal + 2, GI());
    if (!f.grounded) {
      frames(st, 1, GI({ light: true }));
      expect(f.move).not.toBe('air');
    }
  });
});
