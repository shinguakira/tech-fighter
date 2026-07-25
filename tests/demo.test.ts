import { describe, expect, it } from 'vitest';
import { INTRO_FRAMES } from '../src/core/constants';
import { createGame, demoPairs, startDemoMatch, step } from '../src/core/game';
import { GI, frames } from './helpers';

describe('観戦モード (CPU vs CPU)', () => {
  it('タイトルのモードは4択を巡回する', () => {
    const st = createGame();
    expect(st.modeSel).toBe(0);
    frames(st, 1, GI({ down: true }));
    expect(st.modeSel).toBe(1);
    frames(st, 1, GI());
    frames(st, 1, GI({ down: true }));
    expect(st.modeSel).toBe(2);
    frames(st, 1, GI());
    frames(st, 1, GI({ down: true }));
    expect(st.modeSel).toBe(3); // オンライン
    frames(st, 1, GI());
    frames(st, 1, GI({ down: true }));
    expect(st.modeSel).toBe(0); // 巡回
    // 上入力で逆回り
    frames(st, 1, GI());
    frames(st, 1, GI({ up: true }));
    expect(st.modeSel).toBe(3);
  });

  it('タイトルで modeSel=3 決定 → enterOnline フラグが立つ（status は据え置き）', () => {
    const st = createGame();
    st.modeSel = 3;
    frames(st, 1, GI({}, {}, true));
    expect(st.enterOnline).toBe(true);
    expect(st.status).toBe('title'); // 遷移は配線層に委ねる
  });

  it('観戦を選ぶとキャラ選択を飛ばして即対戦（両側 AI）', () => {
    const st = createGame();
    st.modeSel = 2;
    frames(st, 1, GI({}, {}, true));
    expect(st.mode).toBe('demo');
    expect(st.status).toBe('intro'); // select を経由しない
    expect(st.aiSide).toBe(-1); // demo は片側 AI ではない
    // 最初のカードは gopher vs duke（総当たり先頭）
    expect(st.fighters[0].char).toBe('gopher');
    expect(st.fighters[1].char).toBe('duke');
  });

  it('demoPairs は全キャラの総当たり（15カード）', () => {
    expect(demoPairs().length).toBe(15);
  });

  it('両側 AI が実際に行動し、試合が成立する', () => {
    const st = createGame(0x51d5);
    st.demoPair = 4;
    startDemoMatch(st);
    st.status = 'play';
    st.statusTimer = 0;
    let acted = 0;
    for (let i = 0; i < 1200; i++) {
      step(st, GI());
      if (st.fighters[0].atk > 0) acted |= 1;
      if (st.fighters[1].atk > 0) acted |= 2;
    }
    expect(acted).toBe(3); // 両者が攻撃を出している
    const dmg = (st.fighters[0].maxhp - st.fighters[0].hp) + (st.fighters[1].maxhp - st.fighters[1].hp)
      + st.fighters[0].wins + st.fighters[1].wins;
    expect(dmg).toBeGreaterThan(0);
  });

  it('試合終了で自動的に次のカードへ進む', () => {
    const st = createGame();
    startDemoMatch(st); // pair 0
    st.status = 'matchEnd';
    st.statusTimer = 0;
    frames(st, 160, GI()); // 150 超で次カード
    expect(st.demoPair).toBe(1);
    expect(['intro', 'play']).toContain(st.status);
    expect(st.fighters[0].char).toBe('gopher');
    expect(st.fighters[1].char).toBe('ferris'); // pair 1 = [0,2]
  });

  it('観戦中に Enter でタイトルへ戻る', () => {
    const st = createGame();
    startDemoMatch(st);
    st.status = 'play';
    st.statusTimer = 0;
    frames(st, INTRO_FRAMES, GI());
    step(st, GI({}, {}, true)); // Enter
    expect(st.status).toBe('title');
    expect(st.mode).toBe('cpu'); // createGame 既定に戻る
  });

  it('決定論: 同じ seed の観戦は同一に進行する', () => {
    const run = (): string => {
      const st = createGame(0xbeef);
      st.demoPair = 7;
      startDemoMatch(st);
      st.status = 'play';
      st.statusTimer = 0;
      frames(st, 900, GI());
      return JSON.stringify(st.fighters.map((f) => [f.hp, Math.round(f.x), f.wins]));
    };
    expect(run()).toBe(run());
  });
});
