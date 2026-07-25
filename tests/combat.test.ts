import { describe, expect, it } from 'vitest';
import { attackHitbox, hittable, isBlocking } from '../src/core/combat';
import { CHARS } from '../src/core/constants';
import { createGame } from '../src/core/game';
import { GI, P, faceOff, frames, toPlay } from './helpers';

describe('combat', () => {
  it('attackHitbox: active 中のみ前方に出る', () => {
    const st = createGame();
    toPlay(st);
    faceOff(st);
    const a = st.fighters[0];
    const d = CHARS.gopher.moves.light;
    frames(st, 1, GI({ light: true }));
    expect(attackHitbox(a)).toBeNull(); // まだ startup
    frames(st, d.startup, GI());
    const hb = attackHitbox(a);
    expect(hb).not.toBeNull();
    expect(hb!.x).toBeCloseTo(a.x + a.w, 5);
  });

  it('弱がヒット: ダメージ・ヒットストップ・のけぞり・ゲージ増加', () => {
    const st = createGame();
    toPlay(st);
    faceOff(st);
    const [a, b] = st.fighters;
    const d = CHARS.gopher.moves.light;
    frames(st, 1 + d.startup + 1, GI({ light: true }));
    expect(b.hp).toBe(b.maxhp - d.dmg);
    expect(b.hitstun).toBeGreaterThan(0);
    expect(st.hitstop).toBeGreaterThan(0);
    expect(a.meter).toBeGreaterThan(0);
    expect(b.meter).toBeGreaterThan(0);
    expect(a.cancel).toBeGreaterThan(0); // 弱ヒット後は必殺キャンセル可
  });

  it('1発1ヒット: 同じ攻撃は多段ヒットしない', () => {
    const st = createGame();
    toPlay(st);
    faceOff(st);
    const [, b] = st.fighters;
    const d = CHARS.gopher.moves.light;
    frames(st, 1 + d.startup + d.active + 2, GI({ light: true }));
    expect(b.hp).toBe(b.maxhp - d.dmg);
  });

  it('立ちガード: 後ろ入力で中段を防ぎ、削り 0・ブロックスタン', () => {
    const st = createGame();
    toPlay(st);
    faceOff(st);
    const [, b] = st.fighters;
    const d = CHARS.gopher.moves.light;
    // P2 は右側にいるので後ろ = right
    frames(st, 1 + d.startup + 1, GI({ light: true }, { right: true }));
    expect(b.hp).toBe(b.maxhp);
    expect(b.blockstun).toBeGreaterThan(0);
    expect(b.hitstun).toBe(0);
  });

  it('下段: 立ちガードでは食らい、しゃがみガードで防ぐ', () => {
    // 立ちガード → 食らう
    const st = createGame();
    toPlay(st);
    faceOff(st);
    const d = CHARS.gopher.moves.cheavy;
    frames(st, 1 + d.startup + 1, GI({ down: true, heavy: true }, { right: true }));
    expect(st.fighters[1].hp).toBeLessThan(st.fighters[1].maxhp);

    // しゃがみガード → 防ぐ
    const st2 = createGame();
    toPlay(st2);
    faceOff(st2);
    frames(st2, 1 + d.startup + 1, GI({ down: true, heavy: true }, { right: true, down: true }));
    expect(st2.fighters[1].hp).toBe(st2.fighters[1].maxhp);
  });

  it('必殺はガードしても削れる', () => {
    const st = createGame();
    toPlay(st);
    faceOff(st);
    const d = CHARS.gopher.moves.spF;
    frames(st, 1 + d.startup + 1, GI({ special: true, right: true }, { right: true }));
    expect(st.fighters[1].hp).toBe(st.fighters[1].maxhp - d.chip);
  });

  it('足払い: ヒットでダウン → 無敵 → 起き上がり', () => {
    const st = createGame();
    toPlay(st);
    faceOff(st);
    const b = st.fighters[1];
    const d = CHARS.gopher.moves.cheavy;
    frames(st, 1 + d.startup + 1, GI({ down: true, heavy: true }));
    expect(b.kdPending).toBe(true);
    // 着地してダウンに入るまで回す
    frames(st, 40, GI());
    expect(b.kd).toBeGreaterThan(0);
    expect(hittable(b)).toBe(false);
    frames(st, b.kd, GI()); // ダウンの残りを消化した直後
    expect(b.kd).toBe(0);
    expect(b.invul).toBeGreaterThan(0); // 起き上がり無敵
  });

  it('飛び道具: 発生 → 飛翔 → ヒットで消える', () => {
    const st = createGame();
    toPlay(st);
    const [a, b] = st.fighters;
    a.x = 200;
    b.x = 500;
    const d = CHARS.gopher.moves.spN;
    frames(st, 1 + d.startup + 1, GI({ special: true }));
    expect(st.projectiles.length).toBe(1);
    frames(st, 60, GI());
    expect(b.hp).toBe(b.maxhp - d.dmg);
    expect(st.projectiles.filter((p) => !p.dead).length).toBe(0);
  });

  it('弾同士は相殺する', () => {
    const st = createGame();
    toPlay(st);
    const [a, b] = st.fighters;
    a.x = 150;
    b.x = 550;
    const dg = CHARS.gopher.moves.spN;
    const dd = CHARS.duke.moves.spN;
    // 両者同時に弾（duke の方が発生が遅いので P1 を遅らせて撃つ）
    frames(st, 1, GI({ special: true }, { special: true }));
    frames(st, Math.max(dg.startup, dd.startup) + 2, GI());
    expect(st.projectiles.length).toBe(2);
    frames(st, 80, GI());
    // どこかで相殺して両方消える
    expect(st.projectiles.filter((p) => !p.dead).length).toBe(0);
    expect(st.fighters[0].hp).toBe(st.fighters[0].maxhp);
    expect(st.fighters[1].hp).toBe(st.fighters[1].maxhp);
  });

  it('isBlocking: 空中・攻撃中はガード不可', () => {
    const st = createGame();
    toPlay(st);
    faceOff(st);
    const b = st.fighters[1];
    expect(isBlocking(b, P({ right: true }), 1, 'mid')).toBe(true);
    b.grounded = false;
    expect(isBlocking(b, P({ right: true }), 1, 'mid')).toBe(false);
    b.grounded = true;
    b.atk = 5;
    expect(isBlocking(b, P({ right: true }), 1, 'mid')).toBe(false);
  });

  it('ジャンプ攻撃は high: しゃがみガード不可・立ちガード可', () => {
    const st = createGame();
    toPlay(st);
    faceOff(st);
    const b = st.fighters[1];
    expect(isBlocking(b, P({ right: true, down: true }), 1, 'high')).toBe(false);
    expect(isBlocking(b, P({ right: true }), 1, 'high')).toBe(true);
  });
});
