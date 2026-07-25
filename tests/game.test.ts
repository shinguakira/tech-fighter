import { describe, expect, it } from 'vitest';
import { CHARS, INTRO_FRAMES, ROUND_END_FRAMES, WINS_NEED } from '../src/core/constants';
import { createGame, step, timerSec } from '../src/core/game';
import { GI, faceOff, frames, toPlay } from './helpers';

describe('game flow', () => {
  it('title → select → intro → play', () => {
    const st = createGame();
    expect(st.status).toBe('title');
    frames(st, 1, GI({}, {}, true));
    expect(st.status).toBe('select');
    frames(st, 1, GI({ light: true }));
    expect(st.status).toBe('intro'); // CPU 戦は P1 確定で開始
    expect(st.mode).toBe('cpu');
    expect(st.aiSide).toBe(1);
    frames(st, INTRO_FRAMES + 1, GI());
    expect(st.status).toBe('play');
  });

  it('CPU 戦: P1 gopher 確定 → CPU は duke', () => {
    const st = createGame();
    frames(st, 1, GI({}, {}, true));
    frames(st, 1, GI({ light: true }));
    expect(st.fighters[0].char).toBe('gopher');
    expect(st.fighters[1].char).toBe('duke');
  });

  it('2P 対戦: 両者確定で開始・同キャラは 2P カラー', () => {
    const st = createGame();
    st.modeSel = 1;
    frames(st, 1, GI({}, {}, true));
    expect(st.mode).toBe('vs');
    frames(st, 1, GI({ light: true }));
    expect(st.status).toBe('select'); // P2 未確定
    // P2 が gopher にカーソル移動して確定（ミラー）
    frames(st, 1, GI({}, { left: true }));
    frames(st, 1, GI({}, { light: true }));
    expect(st.status).toBe('intro');
    expect(st.fighters[1].char).toBe('gopher');
    expect(st.fighters[1].alt).toBe(true);
  });

  it('KO → roundEnd → 勝者に加点 → 次ラウンド', () => {
    const st = createGame();
    toPlay(st);
    faceOff(st);
    st.fighters[1].hp = 1;
    const d = CHARS.gopher.moves.light;
    frames(st, 1 + d.startup + 1, GI({ light: true }));
    expect(st.status).toBe('roundEnd');
    expect(st.fighters[0].wins).toBe(1);
    expect(st.roundMsg).toContain('K.O.');
    frames(st, ROUND_END_FRAMES + 2, GI());
    expect(st.status).toBe('intro');
    expect(st.round).toBe(2);
    expect(st.fighters[1].hp).toBe(st.fighters[1].maxhp); // 回復
  });

  it('PERFECT 表示: 無傷勝利', () => {
    const st = createGame();
    toPlay(st);
    faceOff(st);
    st.fighters[1].hp = 1;
    const d = CHARS.gopher.moves.light;
    frames(st, 1 + d.startup + 1, GI({ light: true }));
    expect(st.roundMsg).toBe('PERFECT K.O.');
  });

  it('2ラウンド先取で matchEnd', () => {
    const st = createGame();
    toPlay(st);
    st.fighters[0].wins = WINS_NEED - 1;
    faceOff(st);
    st.fighters[1].hp = 1;
    const d = CHARS.gopher.moves.light;
    frames(st, 1 + d.startup + 1, GI({ light: true }));
    frames(st, ROUND_END_FRAMES + 2, GI());
    expect(st.status).toBe('matchEnd');
    expect(st.winner).toBe(0);
  });

  it('タイムアップ: 体力の多い方が勝つ', () => {
    const st = createGame();
    toPlay(st);
    st.fighters[1].hp = 50;
    st.timer = 1;
    frames(st, 2, GI());
    expect(st.status).toBe('roundEnd');
    expect(st.roundMsg).toBe('TIME UP');
    expect(st.fighters[0].wins).toBe(1);
  });

  it('タイマーは 99 秒から減る', () => {
    const st = createGame();
    toPlay(st);
    expect(timerSec(st)).toBe(99);
    frames(st, 61, GI());
    expect(timerSec(st)).toBe(98);
  });

  it('matchEnd → Enter でタイトルへ', () => {
    const st = createGame();
    toPlay(st);
    st.status = 'matchEnd';
    st.winner = 0;
    st.statusTimer = 50;
    frames(st, 1, GI({}, {}, true));
    expect(st.status).toBe('title');
  });

  it('matchEnd → 攻撃ボタンでリマッチ（wins リセット）', () => {
    const st = createGame();
    toPlay(st);
    st.fighters[0].wins = 2;
    st.status = 'matchEnd';
    st.winner = 0;
    st.statusTimer = 50;
    frames(st, 1, GI({ light: true }));
    expect(st.status).toBe('intro');
    expect(st.fighters[0].wins).toBe(0);
    expect(st.round).toBe(1);
  });

  it('決定論: 同じ seed と入力列で状態が完全一致（CPU 戦込み）', () => {
    const run = (): string => {
      const st = createGame(0xdeadbeef);
      frames(st, 1, GI({}, {}, true));
      frames(st, 1, GI({ light: true }));
      frames(st, INTRO_FRAMES + 1, GI());
      // 適当な操作列
      for (let i = 0; i < 600; i++) {
        step(st, GI({
          right: i % 3 === 0,
          left: i % 7 === 0,
          light: i % 11 === 0,
          heavy: i % 17 === 0,
          special: i % 23 === 0,
          up: i % 37 === 0,
          down: i % 5 === 0,
        }));
      }
      return JSON.stringify(st);
    };
    expect(run()).toBe(run());
  });

  it('ヒットストップ中は本体が止まる', () => {
    const st = createGame();
    toPlay(st);
    faceOff(st);
    const d = CHARS.gopher.moves.light;
    frames(st, 1 + d.startup + 1, GI({ light: true }));
    expect(st.hitstop).toBeGreaterThan(0);
    const x = st.fighters[1].x;
    frames(st, 1, GI({}, { right: true }));
    expect(st.fighters[1].x).toBe(x); // 停止中は動かない
  });
});
