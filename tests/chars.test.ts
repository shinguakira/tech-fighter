import { describe, expect, it } from 'vitest';
import { CHARS, CHAR_LIST, FLOOR_Y } from '../src/core/constants';
import { createGame } from '../src/core/game';
import type { MoveId } from '../src/core/types';
import { GI, frames, toPlay } from './helpers';

const ALL_MOVES: MoveId[] = ['light', 'heavy', 'clight', 'cheavy', 'air', 'spN', 'spF', 'spU', 'super'];

describe('characters', () => {
  it('全キャラ: フレームデータが健全（発生/持続/硬直/威力）', () => {
    expect(CHAR_LIST.length).toBe(7);
    for (const id of CHAR_LIST) {
      const d = CHARS[id];
      expect(d.hp).toBeGreaterThan(0);
      expect(d.walkF).toBeGreaterThan(d.walkB * 0.9);
      expect(d.jumpVy).toBeLessThan(0);
      expect(d.crouchH).toBeLessThan(d.h);
      for (const m of ALL_MOVES) {
        const mv = d.moves[m];
        expect(mv, `${id}.${m}`).toBeDefined();
        expect(mv.startup, `${id}.${m} startup`).toBeGreaterThan(0);
        expect(mv.active, `${id}.${m} active`).toBeGreaterThan(0);
        expect(mv.recovery, `${id}.${m} recovery`).toBeGreaterThanOrEqual(0);
        expect(mv.dmg, `${id}.${m} dmg`).toBeGreaterThan(0);
        expect(mv.hitstun, `${id}.${m} hitstun`).toBeGreaterThan(0);
      }
      // 下段技はしゃがみ系に付いている
      expect(d.moves.clight.level).toBe('low');
      expect(d.moves.cheavy.level).toBe('low');
      expect(d.moves.air.level).toBe('high');
    }
  });

  it('FERRIS の掴み（Borrow Checker）はガード不能', () => {
    const st = createGame();
    toPlay(st, 2, 0); // P1=ferris, P2=gopher
    st.fighters[0].x = 300;
    st.fighters[1].x = 360;
    const d = CHARS.ferris.moves.spF;
    // P2 は右側なのでガード方向は right（＋しゃがみも試す）→ それでも食らう
    frames(st, 1 + d.startup + 3, GI({ special: true, right: true }, { right: true, down: true }));
    expect(st.fighters[1].hp).toBeLessThan(st.fighters[1].maxhp);
    expect(st.fighters[1].hitstun).toBeGreaterThan(0);
  });

  it('掴みは空中の相手に当たらない', () => {
    const st = createGame();
    toPlay(st, 2, 0);
    st.fighters[0].x = 300;
    st.fighters[1].x = 360;
    st.fighters[1].grounded = false;
    st.fighters[1].y -= 130; // 掴みの持続が終わるまで着地しない高さ
    const d = CHARS.ferris.moves.spF;
    frames(st, 1 + d.startup + 2, GI({ special: true, right: true }));
    expect(st.fighters[1].hp).toBe(st.fighters[1].maxhp);
  });

  it('FERRIS 超必殺 unsafe { } は弾を出さない近接掴み', () => {
    const st = createGame();
    toPlay(st, 2, 0);
    st.fighters[0].x = 300;
    st.fighters[1].x = 356;
    st.fighters[0].meter = 100;
    const d = CHARS.ferris.moves.super;
    frames(st, 1 + d.startup + 3, GI({ special: true, heavy: true }, { right: true }));
    expect(st.projectiles.length).toBe(0);
    expect(st.fighters[1].hp).toBe(st.fighters[1].maxhp - d.dmg); // ガード入力でも直撃
  });

  it('cargo throw は放物線を描いて床で消える', () => {
    const st = createGame();
    toPlay(st, 2, 0);
    st.fighters[0].x = 150;
    st.fighters[1].x = 700; // 当たらない距離
    const d = CHARS.ferris.moves.spN;
    frames(st, 1 + d.startup + 1, GI({ special: true }));
    expect(st.projectiles.length).toBe(1);
    const p = st.projectiles[0]!;
    const vy0 = p.vy;
    frames(st, 10, GI());
    expect(p.vy).toBeGreaterThan(vy0); // 重力で降下へ
    frames(st, 80, GI());
    expect(p.dead).toBe(true); // 床で消滅
    expect(p.y + p.h).toBeLessThanOrEqual(FLOOR_Y + 8);
  });

  it('TUX の Pipe | Stream は下段: 立ちガード不可・しゃがみガード可', () => {
    // 立ちガード → 食らう
    const st = createGame();
    toPlay(st, 3, 0); // P1=tux, P2=gopher
    st.fighters[0].x = 200;
    st.fighters[1].x = 430;
    const d = CHARS.tux.moves.spN;
    frames(st, 1 + d.startup + 1, GI({ special: true }));
    frames(st, 60, GI({}, { right: true }));
    expect(st.fighters[1].hp).toBe(st.fighters[1].maxhp - d.dmg);

    // しゃがみガード → 削りのみ
    const st2 = createGame();
    toPlay(st2, 3, 0);
    st2.fighters[0].x = 200;
    st2.fighters[1].x = 430;
    frames(st2, 1 + d.startup + 1, GI({ special: true }));
    frames(st2, 60, GI({}, { right: true, down: true }));
    expect(st2.fighters[1].hp).toBe(st2.fighters[1].maxhp - d.chip);
  });

  it('TUX 超必殺 KERNEL PANIC はビームが画面を横断してヒット', () => {
    const st = createGame();
    toPlay(st, 3, 0);
    st.fighters[0].x = 100;
    st.fighters[1].x = 650;
    st.fighters[0].meter = 100;
    const d = CHARS.tux.moves.super;
    frames(st, 1 + d.startup + 1, GI({ special: true, heavy: true }));
    expect(st.projectiles.some((p) => p.kind === 'beam')).toBe(true);
    frames(st, 90, GI());
    expect(st.fighters[1].hp).toBe(st.fighters[1].maxhp - d.dmg);
  });

  it('セレクト: カーソルは7キャラを巡回・CPU は隣のキャラ', () => {
    const st = createGame();
    frames(st, 1, GI({}, {}, true)); // → select
    expect(st.status).toBe('select');
    frames(st, 1, GI({ left: true }));
    expect(st.sel[0]).toBe(6); // 左端(gopher)から巡回して bun
    frames(st, 1, GI());
    frames(st, 1, GI({ right: true }));
    expect(st.sel[0]).toBe(0);
    // ferris (index 2) へ移動して確定
    frames(st, 1, GI());
    frames(st, 1, GI({ right: true }));
    frames(st, 1, GI());
    frames(st, 1, GI({ right: true }));
    expect(st.sel[0]).toBe(2);
    frames(st, 1, GI({ light: true }));
    expect(st.fighters[0].char).toBe('ferris');
    expect(st.fighters[1].char).toBe('tux'); // 隣 (2+1)%7=3
  });

  it('DENO の DENO DEPLOY は上空から降る複数弾を生成し床で消える', () => {
    const st = createGame();
    toPlay(st, 4, 0); // P1=deno, P2=gopher
    st.fighters[0].x = 200;
    st.fighters[1].x = 600;
    st.fighters[0].meter = 100;
    const d = CHARS.deno.moves.super;
    frames(st, 1 + d.startup + 1, GI({ special: true, heavy: true }));
    const rain = st.projectiles.filter((p) => p.kind === 'rain');
    expect(rain.length).toBe(6);
    // 自分(P1)には当たらない・十分回すと相手に当たるか床で消えて全滅
    frames(st, 220, GI());
    expect(st.fighters[0].hp).toBe(st.fighters[0].maxhp);
    expect(st.projectiles.filter((p) => p.kind === 'rain' && !p.dead).length).toBe(0);
  });

  it('GNU の Recursive GNU ブーメランは往復して戻る（初速と逆へ加速）', () => {
    const st = createGame();
    toPlay(st, 5, 0); // P1=gnu, P2=gopher
    st.fighters[0].x = 150;
    st.fighters[0].facing = 1;
    st.fighters[1].x = 760; // 遠くて当たらない
    const d = CHARS.gnu.moves.spN;
    frames(st, 1 + d.startup + 1, GI({ special: true }));
    const p = st.projectiles.find((pp) => pp.kind === 'boomerang')!;
    expect(p).toBeDefined();
    expect(p.vx).toBeGreaterThan(0); // 前方へ
    frames(st, 40, GI());
    expect(p.vx).toBeLessThan(0); // 加速で反転して戻る
  });

  it('GNU の GPL CASCADE は打ち消されない巨大弾', () => {
    const st = createGame();
    toPlay(st, 5, 0);
    st.fighters[0].x = 150;
    st.fighters[1].x = 520;
    st.fighters[0].meter = 100;
    const d = CHARS.gnu.moves.super;
    frames(st, 1 + d.startup + 1, GI({ special: true, heavy: true }));
    expect(st.projectiles.some((p) => p.kind === 'gpl')).toBe(true);
    frames(st, 70, GI());
    expect(st.fighters[1].hp).toBeLessThanOrEqual(st.fighters[1].maxhp - d.chip);
  });

  it('新キャラ同士でも決定論が保たれる', () => {
    const run = (): string => {
      const st = createGame(0xfeed);
      toPlay(st, 2, 3); // ferris vs tux
      for (let i = 0; i < 400; i++) {
        frames(st, 1, GI(
          { right: i % 3 === 0, light: i % 9 === 0, special: i % 21 === 0, down: i % 6 === 0 },
          { left: i % 4 === 0, heavy: i % 13 === 0, special: i % 17 === 0 },
        ));
      }
      return JSON.stringify(st);
    };
    expect(run()).toBe(run());
  });
});
