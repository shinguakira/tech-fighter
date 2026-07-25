import { describe, expect, it } from 'vitest';
import { aiInput } from '../src/core/ai';
import { INTRO_FRAMES } from '../src/core/constants';
import { createGame, step } from '../src/core/game';
import { GI, frames } from './helpers';

describe('ai', () => {
  it('決定論: 同じ状態から同じ入力を返す', () => {
    const make = () => {
      const st = createGame(42);
      frames(st, 1, GI({}, {}, true));
      frames(st, 1, GI({ light: true }));
      frames(st, INTRO_FRAMES + 1, GI());
      return st;
    };
    const a = make();
    const b = make();
    for (let i = 0; i < 120; i++) {
      expect(aiInput(a, 1)).toEqual(aiInput(b, 1));
    }
  });

  it('CPU 戦を長時間回してもクラッシュせず、CPU が何か行動する', () => {
    const st = createGame(7);
    frames(st, 1, GI({}, {}, true));
    frames(st, 1, GI({ light: true }));
    frames(st, INTRO_FRAMES + 1, GI());
    let cpuActed = false;
    for (let i = 0; i < 3600; i++) {
      step(st, GI({ right: i % 4 === 0, light: i % 13 === 0 }));
      const cpu = st.fighters[1];
      if (cpu.atk > 0 || Math.abs(cpu.vx) > 0) cpuActed = true;
    }
    expect(cpuActed).toBe(true);
    // どちらかにダメージが入っているはず（試合が成立している）
    const dmg = (st.fighters[0].maxhp - st.fighters[0].hp) + (st.fighters[1].maxhp - st.fighters[1].hp)
      + st.fighters[0].wins + st.fighters[1].wins;
    expect(dmg).toBeGreaterThan(0);
  });
});
