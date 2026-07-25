import type { CharDef, CharId, MoveDef, MoveId } from './types';

// ---- 画面・ステージ ---------------------------------------------------------
export const W = 800;
export const H = 480;
/** 地面の Y（足元基準） */
export const FLOOR_Y = 420;
/** ステージ左右の壁 */
export const WALL_L = 16;
export const WALL_R = W - 16;

// ---- 物理 -------------------------------------------------------------------
export const GRAV = 0.55;
/** ノックバック速度の地上摩擦 */
export const FRICTION = 0.82;

// ---- 対戦ルール -------------------------------------------------------------
/** ラウンド制限時間（秒） */
export const ROUND_SEC = 99;
export const ROUND_FRAMES = ROUND_SEC * 60;
/** 先取ラウンド数 */
export const WINS_NEED = 2;
export const METER_MAX = 100;
/** 超必殺のコスト */
export const SUPER_COST = 100;

/** ダウンの長さ（この間は無敵で寝ている） */
export const KD_FRAMES = 48;
/** 起き上がり無敵 */
export const WAKEUP_INVUL = 16;
/** 空中コンボ補正: 1ヒットごとの打ち上げ減衰 */
export const JUGGLE_DECAY = 0.35;
/** ラウンド開始位置（中央からのオフセット） */
export const START_OFFSET = 190;

/** 演出フレーム */
export const INTRO_FRAMES = 130;
export const ROUND_END_FRAMES = 160;

/** 先行入力の受付: 硬直の残りこのフレーム以下で押した技を記憶 */
export const BUFFER_WINDOW = 7;
/** 弱ヒット後の必殺キャンセル受付フレーム */
export const CANCEL_WINDOW = 12;

/** 被弾側のゲージ増加率（与えた側の meterGain に対する割合） */
export const METER_TAKEN_RATE = 0.6;
/** ガード側のゲージ増加率 */
export const METER_BLOCK_RATE = 0.4;

// ---- キャラクター定義 -------------------------------------------------------

const move = (m: Omit<MoveDef, 'chip'> & { chip?: number }): MoveDef => ({ chip: 0, ...m });

/**
 * GOPHER（Go）— 軽量ラッシュ型。歩きが速く技が軽い。
 * 必殺は goroutine の飛び道具・channel の突進・panic() の対空。
 */
const GOPHER: CharDef = {
  id: 'gopher',
  name: 'GOPHER',
  hp: 100,
  walkF: 2.7,
  walkB: 2.1,
  jumpVy: -11.2,
  jumpVx: 2.6,
  w: 44,
  h: 84,
  crouchH: 58,
  moves: {
    light: move({ id: 'light', name: 'Paw Jab', dmg: 5, startup: 4, active: 3, recovery: 8, hitstun: 15, blockstun: 9, kbx: 3.2, kby: 0, level: 'mid', knockdown: false, range: 40, hitY: -66, hitH: 24, hitstop: 5, meterGain: 6 }),
    clight: move({ id: 'clight', name: 'Low Scratch', dmg: 4, startup: 4, active: 3, recovery: 9, hitstun: 14, blockstun: 8, kbx: 2.8, kby: 0, level: 'low', knockdown: false, range: 44, hitY: -20, hitH: 18, hitstop: 5, meterGain: 5 }),
    heavy: move({ id: 'heavy', name: 'Tail Hammer', dmg: 11, startup: 10, active: 4, recovery: 17, hitstun: 22, blockstun: 13, kbx: 6.5, kby: -2.2, level: 'mid', knockdown: false, range: 52, hitY: -78, hitH: 46, hitstop: 9, meterGain: 10 }),
    cheavy: move({ id: 'cheavy', name: 'Sweep.go', dmg: 9, startup: 9, active: 4, recovery: 19, hitstun: 24, blockstun: 12, kbx: 4, kby: 0, level: 'low', knockdown: true, range: 56, hitY: -16, hitH: 16, hitstop: 8, meterGain: 8 }),
    air: move({ id: 'air', name: 'Dive Claw', dmg: 8, startup: 6, active: 9, recovery: 10, hitstun: 19, blockstun: 12, kbx: 4, kby: 0, level: 'high', knockdown: false, range: 42, hitY: -30, hitH: 34, hitstop: 7, meterGain: 7 }),
    spN: move({ id: 'spN', name: 'go routine()', dmg: 8, chip: 2, startup: 11, active: 2, recovery: 22, hitstun: 18, blockstun: 14, kbx: 5, kby: 0, level: 'mid', knockdown: false, range: 0, hitY: 0, hitH: 0, hitstop: 6, meterGain: 8, projectile: true }),
    spF: move({ id: 'spF', name: 'Channel Rush', dmg: 10, chip: 3, startup: 8, active: 10, recovery: 16, hitstun: 20, blockstun: 14, kbx: 7, kby: -3, level: 'mid', knockdown: false, range: 46, hitY: -70, hitH: 44, hitstop: 8, meterGain: 9, lunge: 6.5 }),
    spU: move({ id: 'spU', name: 'panic()', dmg: 11, chip: 3, startup: 5, active: 8, recovery: 24, hitstun: 26, blockstun: 14, kbx: 3, kby: -9.5, level: 'mid', knockdown: true, range: 42, hitY: -108, hitH: 96, hitstop: 9, meterGain: 9, invul: 9 }),
    super: move({ id: 'super', name: 'GOROUTINE SWARM', dmg: 4, chip: 1, startup: 12, active: 2, recovery: 30, hitstun: 16, blockstun: 12, kbx: 3, kby: 0, level: 'mid', knockdown: false, range: 0, hitY: 0, hitH: 0, hitstop: 4, meterGain: 0, projectile: true }),
  },
};

/**
 * DUKE（Java）— 重量パワー型。一撃が重くリーチが長い。
 * 必殺は NullPointerException の巨弾・HotSpot タックル・Stack Trace アッパー。
 */
const DUKE: CharDef = {
  id: 'duke',
  name: 'DUKE',
  hp: 110,
  walkF: 2.2,
  walkB: 1.8,
  jumpVy: -10.6,
  jumpVx: 2.3,
  w: 48,
  h: 86,
  crouchH: 60,
  moves: {
    light: move({ id: 'light', name: 'Mitt Slap', dmg: 6, startup: 5, active: 3, recovery: 10, hitstun: 16, blockstun: 10, kbx: 3.5, kby: 0, level: 'mid', knockdown: false, range: 46, hitY: -64, hitH: 26, hitstop: 5, meterGain: 6 }),
    clight: move({ id: 'clight', name: 'Low Mitt', dmg: 5, startup: 5, active: 3, recovery: 11, hitstun: 15, blockstun: 9, kbx: 3, kby: 0, level: 'low', knockdown: false, range: 46, hitY: -20, hitH: 18, hitstop: 5, meterGain: 5 }),
    heavy: move({ id: 'heavy', name: 'Nose Hammer', dmg: 14, startup: 13, active: 4, recovery: 19, hitstun: 24, blockstun: 14, kbx: 7.5, kby: -2.6, level: 'mid', knockdown: false, range: 58, hitY: -80, hitH: 50, hitstop: 10, meterGain: 11 }),
    cheavy: move({ id: 'cheavy', name: 'Slide.class', dmg: 10, startup: 11, active: 5, recovery: 21, hitstun: 24, blockstun: 12, kbx: 4.5, kby: 0, level: 'low', knockdown: true, range: 62, hitY: -16, hitH: 16, hitstop: 9, meterGain: 9 }),
    air: move({ id: 'air', name: 'Duke Press', dmg: 9, startup: 7, active: 9, recovery: 11, hitstun: 20, blockstun: 13, kbx: 4.5, kby: 0, level: 'high', knockdown: false, range: 44, hitY: -32, hitH: 36, hitstop: 8, meterGain: 7 }),
    spN: move({ id: 'spN', name: 'NullPointerException', dmg: 10, chip: 3, startup: 16, active: 2, recovery: 26, hitstun: 20, blockstun: 16, kbx: 5.5, kby: 0, level: 'mid', knockdown: false, range: 0, hitY: 0, hitH: 0, hitstop: 7, meterGain: 9, projectile: true }),
    spF: move({ id: 'spF', name: 'HotSpot Tackle', dmg: 12, chip: 4, startup: 12, active: 12, recovery: 20, hitstun: 24, blockstun: 15, kbx: 8, kby: -3.5, level: 'mid', knockdown: true, range: 50, hitY: -74, hitH: 50, hitstop: 10, meterGain: 10, lunge: 5.5 }),
    spU: move({ id: 'spU', name: 'Stack Trace Upper', dmg: 12, chip: 3, startup: 6, active: 8, recovery: 26, hitstun: 26, blockstun: 14, kbx: 3, kby: -10, level: 'mid', knockdown: true, range: 44, hitY: -112, hitH: 100, hitstop: 10, meterGain: 9, invul: 10 }),
    super: move({ id: 'super', name: 'OutOfMemoryError', dmg: 22, chip: 8, startup: 16, active: 2, recovery: 34, hitstun: 30, blockstun: 20, kbx: 9, kby: -6, level: 'mid', knockdown: true, range: 0, hitY: 0, hitH: 0, hitstop: 12, meterGain: 0, projectile: true }),
  },
};

/**
 * FERRIS（Rust）— 装甲グラップラー。遅く硬く、掴み（grab=ガード不能）で崩す。
 * cargo throw の放物線クレート・Borrow Checker（突進掴み）・Unwrap Upper・UNSAFE BLOCK（超必掴み）。
 */
const FERRIS: CharDef = {
  id: 'ferris',
  name: 'FERRIS',
  hp: 118,
  walkF: 1.9,
  walkB: 1.6,
  jumpVy: -9.8,
  jumpVx: 2.0,
  w: 54,
  h: 72,
  crouchH: 52,
  moves: {
    light: move({ id: 'light', name: 'Claw Snip', dmg: 6, startup: 6, active: 3, recovery: 11, hitstun: 16, blockstun: 10, kbx: 3.6, kby: 0, level: 'mid', knockdown: false, range: 46, hitY: -52, hitH: 26, hitstop: 6, meterGain: 6 }),
    clight: move({ id: 'clight', name: 'Low Pinch', dmg: 5, startup: 6, active: 3, recovery: 12, hitstun: 15, blockstun: 9, kbx: 3, kby: 0, level: 'low', knockdown: false, range: 48, hitY: -18, hitH: 16, hitstop: 5, meterGain: 5 }),
    heavy: move({ id: 'heavy', name: 'Big Pinch', dmg: 15, startup: 14, active: 4, recovery: 21, hitstun: 25, blockstun: 15, kbx: 8, kby: -2.8, level: 'mid', knockdown: false, range: 56, hitY: -64, hitH: 44, hitstop: 11, meterGain: 12 }),
    cheavy: move({ id: 'cheavy', name: 'Claw Sweep', dmg: 11, startup: 12, active: 5, recovery: 22, hitstun: 24, blockstun: 12, kbx: 4.5, kby: 0, level: 'low', knockdown: true, range: 60, hitY: -16, hitH: 16, hitstop: 10, meterGain: 9 }),
    air: move({ id: 'air', name: 'Crab Drop', dmg: 9, startup: 8, active: 9, recovery: 12, hitstun: 20, blockstun: 13, kbx: 4.5, kby: 0, level: 'high', knockdown: false, range: 46, hitY: -28, hitH: 32, hitstop: 8, meterGain: 7 }),
    spN: move({ id: 'spN', name: 'cargo throw', dmg: 10, chip: 3, startup: 14, active: 2, recovery: 24, hitstun: 20, blockstun: 15, kbx: 5, kby: -2, level: 'mid', knockdown: false, range: 0, hitY: 0, hitH: 0, hitstop: 7, meterGain: 9, projectile: true }),
    spF: move({ id: 'spF', name: 'Borrow Checker', dmg: 13, chip: 0, startup: 11, active: 8, recovery: 22, hitstun: 26, blockstun: 0, kbx: 7, kby: -4, level: 'grab', knockdown: true, range: 42, hitY: -60, hitH: 44, hitstop: 11, meterGain: 10, lunge: 5 }),
    spU: move({ id: 'spU', name: 'Unwrap Upper', dmg: 12, chip: 3, startup: 6, active: 8, recovery: 26, hitstun: 26, blockstun: 14, kbx: 3, kby: -9.5, level: 'mid', knockdown: true, range: 44, hitY: -100, hitH: 90, hitstop: 10, meterGain: 9, invul: 9 }),
    super: move({ id: 'super', name: 'unsafe { }', dmg: 30, chip: 0, startup: 10, active: 6, recovery: 32, hitstun: 34, blockstun: 0, kbx: 9, kby: -8, level: 'grab', knockdown: true, range: 50, hitY: -62, hitH: 50, hitstop: 16, meterGain: 0 }),
  },
};

/**
 * TUX（Linux）— 下段主体のゾナー。Pipe | Stream（地を這う下段弾）と
 * Penguin Slide で崩し、KERNEL PANIC の全画面ビームで〆る。
 */
const TUX: CharDef = {
  id: 'tux',
  name: 'TUX',
  hp: 104,
  walkF: 2.4,
  walkB: 1.9,
  jumpVy: -10.8,
  jumpVx: 2.4,
  w: 46,
  h: 80,
  crouchH: 56,
  moves: {
    light: move({ id: 'light', name: 'Flipper Jab', dmg: 5, startup: 4, active: 3, recovery: 9, hitstun: 15, blockstun: 9, kbx: 3.2, kby: 0, level: 'mid', knockdown: false, range: 42, hitY: -62, hitH: 24, hitstop: 5, meterGain: 6 }),
    clight: move({ id: 'clight', name: 'Low Peck', dmg: 4, startup: 5, active: 3, recovery: 10, hitstun: 14, blockstun: 8, kbx: 2.8, kby: 0, level: 'low', knockdown: false, range: 44, hitY: -18, hitH: 16, hitstop: 5, meterGain: 5 }),
    heavy: move({ id: 'heavy', name: 'Beak Hammer', dmg: 12, startup: 11, active: 4, recovery: 18, hitstun: 23, blockstun: 13, kbx: 6.8, kby: -2.4, level: 'mid', knockdown: false, range: 50, hitY: -76, hitH: 46, hitstop: 9, meterGain: 10 }),
    cheavy: move({ id: 'cheavy', name: 'Ice Sweep', dmg: 9, startup: 10, active: 4, recovery: 20, hitstun: 24, blockstun: 12, kbx: 4.2, kby: 0, level: 'low', knockdown: true, range: 58, hitY: -14, hitH: 14, hitstop: 8, meterGain: 8 }),
    air: move({ id: 'air', name: 'Air Glide', dmg: 8, startup: 6, active: 9, recovery: 10, hitstun: 19, blockstun: 12, kbx: 4, kby: 0, level: 'high', knockdown: false, range: 42, hitY: -30, hitH: 32, hitstop: 7, meterGain: 7 }),
    spN: move({ id: 'spN', name: 'Pipe | Stream', dmg: 9, chip: 3, startup: 13, active: 2, recovery: 24, hitstun: 19, blockstun: 15, kbx: 5, kby: 0, level: 'low', knockdown: false, range: 0, hitY: 0, hitH: 0, hitstop: 6, meterGain: 8, projectile: true }),
    spF: move({ id: 'spF', name: 'Penguin Slide', dmg: 11, chip: 3, startup: 9, active: 10, recovery: 18, hitstun: 24, blockstun: 14, kbx: 6.5, kby: -3, level: 'low', knockdown: true, range: 48, hitY: -26, hitH: 26, hitstop: 9, meterGain: 9, lunge: 6.5 }),
    spU: move({ id: 'spU', name: 'sudo Upper', dmg: 11, chip: 3, startup: 5, active: 8, recovery: 24, hitstun: 26, blockstun: 14, kbx: 3, kby: -9.8, level: 'mid', knockdown: true, range: 42, hitY: -106, hitH: 94, hitstop: 9, meterGain: 9, invul: 8 }),
    super: move({ id: 'super', name: 'KERNEL PANIC', dmg: 24, chip: 8, startup: 18, active: 2, recovery: 32, hitstun: 30, blockstun: 20, kbx: 9, kby: -5, level: 'mid', knockdown: true, range: 0, hitY: 0, hitH: 0, hitstop: 12, meterGain: 0, projectile: true }),
  },
};

/**
 * DENO（Deno ランタイム）— バランス型ラッシュ。TypeScript ネイティブで手堅い。
 * fetch()（速い web 弾）・Permission Dash（突進）・Top-Level Await（対空）・
 * DENO DEPLOY（画面上から降る TS の雨）。
 */
const DENO: CharDef = {
  id: 'deno',
  name: 'DENO',
  hp: 106,
  walkF: 2.5,
  walkB: 2.0,
  jumpVy: -11.0,
  jumpVx: 2.5,
  w: 50,
  h: 82,
  crouchH: 56,
  moves: {
    light: move({ id: 'light', name: 'Tail Tap', dmg: 5, startup: 5, active: 3, recovery: 9, hitstun: 15, blockstun: 9, kbx: 3.2, kby: 0, level: 'mid', knockdown: false, range: 44, hitY: -64, hitH: 26, hitstop: 5, meterGain: 6 }),
    clight: move({ id: 'clight', name: 'Low Bite', dmg: 4, startup: 5, active: 3, recovery: 10, hitstun: 14, blockstun: 8, kbx: 2.8, kby: 0, level: 'low', knockdown: false, range: 46, hitY: -18, hitH: 16, hitstop: 5, meterGain: 5 }),
    heavy: move({ id: 'heavy', name: 'Chomp', dmg: 12, startup: 11, active: 4, recovery: 18, hitstun: 23, blockstun: 13, kbx: 6.8, kby: -2.4, level: 'mid', knockdown: false, range: 54, hitY: -74, hitH: 48, hitstop: 9, meterGain: 10 }),
    cheavy: move({ id: 'cheavy', name: 'Tail Sweep', dmg: 9, startup: 9, active: 4, recovery: 19, hitstun: 24, blockstun: 12, kbx: 4, kby: 0, level: 'low', knockdown: true, range: 58, hitY: -16, hitH: 16, hitstop: 8, meterGain: 8 }),
    air: move({ id: 'air', name: 'Dino Dive', dmg: 8, startup: 6, active: 9, recovery: 10, hitstun: 19, blockstun: 12, kbx: 4, kby: 0, level: 'high', knockdown: false, range: 44, hitY: -30, hitH: 34, hitstop: 7, meterGain: 7 }),
    spN: move({ id: 'spN', name: 'fetch()', dmg: 8, chip: 2, startup: 12, active: 2, recovery: 22, hitstun: 18, blockstun: 14, kbx: 5, kby: 0, level: 'mid', knockdown: false, range: 0, hitY: 0, hitH: 0, hitstop: 6, meterGain: 8, projectile: true }),
    spF: move({ id: 'spF', name: 'Permission Dash', dmg: 11, chip: 3, startup: 9, active: 10, recovery: 17, hitstun: 22, blockstun: 14, kbx: 7, kby: -3, level: 'mid', knockdown: false, range: 46, hitY: -68, hitH: 46, hitstop: 8, meterGain: 9, lunge: 6 }),
    spU: move({ id: 'spU', name: 'Top-Level Await', dmg: 11, chip: 3, startup: 5, active: 8, recovery: 24, hitstun: 26, blockstun: 14, kbx: 3, kby: -9.5, level: 'mid', knockdown: true, range: 42, hitY: -106, hitH: 94, hitstop: 9, meterGain: 9, invul: 9 }),
    super: move({ id: 'super', name: 'DENO DEPLOY', dmg: 6, chip: 2, startup: 20, active: 2, recovery: 30, hitstun: 18, blockstun: 12, kbx: 3, kby: -4, level: 'mid', knockdown: false, range: 0, hitY: 0, hitH: 0, hitstop: 5, meterGain: 0, projectile: true }),
  },
};

/**
 * GNU（GNU/自由ソフト）— 曲射ゾナー＆トリックスター。Recursive GNU の
 * ブーメラン弾で崩し、角の突進・アッパーで暴れ、GPL CASCADE の巨大弾で〆る。
 */
const GNU: CharDef = {
  id: 'gnu',
  name: 'GNU',
  hp: 108,
  walkF: 2.2,
  walkB: 1.9,
  jumpVy: -10.6,
  jumpVx: 2.2,
  w: 50,
  h: 84,
  crouchH: 58,
  moves: {
    light: move({ id: 'light', name: 'Hoof Jab', dmg: 5, startup: 5, active: 3, recovery: 9, hitstun: 15, blockstun: 9, kbx: 3.2, kby: 0, level: 'mid', knockdown: false, range: 46, hitY: -66, hitH: 26, hitstop: 5, meterGain: 6 }),
    clight: move({ id: 'clight', name: 'Low Hoof', dmg: 4, startup: 5, active: 3, recovery: 10, hitstun: 14, blockstun: 8, kbx: 2.8, kby: 0, level: 'low', knockdown: false, range: 46, hitY: -18, hitH: 16, hitstop: 5, meterGain: 5 }),
    heavy: move({ id: 'heavy', name: 'Horn Butt', dmg: 13, startup: 12, active: 4, recovery: 18, hitstun: 23, blockstun: 13, kbx: 7, kby: -2.4, level: 'mid', knockdown: false, range: 54, hitY: -76, hitH: 48, hitstop: 9, meterGain: 10 }),
    cheavy: move({ id: 'cheavy', name: 'Beard Sweep', dmg: 9, startup: 9, active: 4, recovery: 20, hitstun: 24, blockstun: 12, kbx: 4, kby: 0, level: 'low', knockdown: true, range: 58, hitY: -16, hitH: 16, hitstop: 8, meterGain: 8 }),
    air: move({ id: 'air', name: 'Gnu Stomp', dmg: 8, startup: 6, active: 9, recovery: 11, hitstun: 19, blockstun: 12, kbx: 4, kby: 0, level: 'high', knockdown: false, range: 44, hitY: -30, hitH: 34, hitstop: 7, meterGain: 7 }),
    spN: move({ id: 'spN', name: 'Recursive GNU', dmg: 9, chip: 2, startup: 13, active: 2, recovery: 20, hitstun: 18, blockstun: 13, kbx: 4, kby: 0, level: 'mid', knockdown: false, range: 0, hitY: 0, hitH: 0, hitstop: 6, meterGain: 7, projectile: true }),
    spF: move({ id: 'spF', name: 'Emacs Charge', dmg: 12, chip: 3, startup: 10, active: 9, recovery: 19, hitstun: 24, blockstun: 15, kbx: 7.5, kby: -3, level: 'mid', knockdown: true, range: 48, hitY: -70, hitH: 48, hitstop: 9, meterGain: 9, lunge: 5.5 }),
    spU: move({ id: 'spU', name: 'Freedom Rising', dmg: 11, chip: 3, startup: 6, active: 8, recovery: 25, hitstun: 26, blockstun: 14, kbx: 3, kby: -9.6, level: 'mid', knockdown: true, range: 44, hitY: -104, hitH: 92, hitstop: 9, meterGain: 9, invul: 9 }),
    super: move({ id: 'super', name: 'GPL CASCADE', dmg: 20, chip: 7, startup: 15, active: 2, recovery: 32, hitstun: 28, blockstun: 18, kbx: 8, kby: -4, level: 'mid', knockdown: true, range: 0, hitY: 0, hitH: 0, hitstop: 11, meterGain: 0, projectile: true }),
  },
};

/**
 * BUN（Bun ランタイム）— 俊敏なオールインワン・ラッシュ。速い足回りと素早い技で押す。
 * bun install（速い荷物弾）・Hot Reload（突進）・bun --watch（対空）・ALL-IN-ONE（連射超必）。
 */
const BUN: CharDef = {
  id: 'bun',
  name: 'BUN',
  hp: 98,
  walkF: 2.8,
  walkB: 2.2,
  jumpVy: -11.4,
  jumpVx: 2.7,
  w: 48,
  h: 78,
  crouchH: 54,
  moves: {
    light: move({ id: 'light', name: 'Bun Jab', dmg: 5, startup: 4, active: 3, recovery: 8, hitstun: 15, blockstun: 9, kbx: 3.2, kby: 0, level: 'mid', knockdown: false, range: 42, hitY: -58, hitH: 24, hitstop: 5, meterGain: 6 }),
    clight: move({ id: 'clight', name: 'Low Nibble', dmg: 4, startup: 4, active: 3, recovery: 9, hitstun: 14, blockstun: 8, kbx: 2.8, kby: 0, level: 'low', knockdown: false, range: 44, hitY: -18, hitH: 16, hitstop: 5, meterGain: 5 }),
    heavy: move({ id: 'heavy', name: 'Rolling Pin', dmg: 11, startup: 10, active: 4, recovery: 17, hitstun: 22, blockstun: 13, kbx: 6.4, kby: -2.2, level: 'mid', knockdown: false, range: 52, hitY: -70, hitH: 44, hitstop: 9, meterGain: 10 }),
    cheavy: move({ id: 'cheavy', name: 'Dough Sweep', dmg: 9, startup: 8, active: 4, recovery: 18, hitstun: 24, blockstun: 12, kbx: 4, kby: 0, level: 'low', knockdown: true, range: 54, hitY: -16, hitH: 16, hitstop: 8, meterGain: 8 }),
    air: move({ id: 'air', name: 'Bun Drop', dmg: 8, startup: 5, active: 9, recovery: 10, hitstun: 19, blockstun: 12, kbx: 4, kby: 0, level: 'high', knockdown: false, range: 42, hitY: -28, hitH: 34, hitstop: 7, meterGain: 7 }),
    spN: move({ id: 'spN', name: 'bun install', dmg: 8, chip: 2, startup: 10, active: 2, recovery: 20, hitstun: 18, blockstun: 13, kbx: 5, kby: 0, level: 'mid', knockdown: false, range: 0, hitY: 0, hitH: 0, hitstop: 6, meterGain: 8, projectile: true }),
    spF: move({ id: 'spF', name: 'Hot Reload', dmg: 10, chip: 3, startup: 8, active: 10, recovery: 16, hitstun: 20, blockstun: 14, kbx: 7, kby: -3, level: 'mid', knockdown: false, range: 46, hitY: -64, hitH: 44, hitstop: 8, meterGain: 9, lunge: 6.5 }),
    spU: move({ id: 'spU', name: 'bun --watch', dmg: 11, chip: 3, startup: 5, active: 8, recovery: 24, hitstun: 26, blockstun: 14, kbx: 3, kby: -9.5, level: 'mid', knockdown: true, range: 42, hitY: -104, hitH: 92, hitstop: 9, meterGain: 9, invul: 9 }),
    super: move({ id: 'super', name: 'ALL-IN-ONE', dmg: 5, chip: 1, startup: 12, active: 2, recovery: 30, hitstun: 16, blockstun: 12, kbx: 3, kby: 0, level: 'mid', knockdown: false, range: 0, hitY: 0, hitH: 0, hitstop: 5, meterGain: 0, projectile: true }),
  },
};

export const CHARS: Record<CharId, CharDef> = { gopher: GOPHER, duke: DUKE, ferris: FERRIS, tux: TUX, deno: DENO, gnu: GNU, bun: BUN };
export const CHAR_LIST: readonly CharId[] = ['gopher', 'duke', 'ferris', 'tux', 'deno', 'gnu', 'bun'];

export const charAt = (i: number): CharId => CHAR_LIST[((i % CHAR_LIST.length) + CHAR_LIST.length) % CHAR_LIST.length]!;

export const moveDef = (c: CharId, m: MoveId): MoveDef => CHARS[c].moves[m];
