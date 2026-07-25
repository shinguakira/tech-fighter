// ゲームの純粋な型定義（DOM 非依存）

export type CharId = 'gopher' | 'duke' | 'ferris' | 'tux' | 'deno' | 'gnu';
export type Facing = 1 | -1;
export type Side = 0 | 1;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * ガード方向の属性。low=しゃがみガードのみ / high=立ちガードのみ / mid=どちらでも /
 * grab=ガード不能（ただし空中の相手には当たらない）。
 */
export type HitLevel = 'mid' | 'low' | 'high' | 'grab';

/**
 * 技ID。light/heavy=立ち弱/強、clight/cheavy=しゃがみ弱/強、air=ジャンプ攻撃、
 * spN/spF/spU=必殺（中立=飛び道具 / 前=突進 / 上=対空）、super=超必殺。
 */
export type MoveId =
  | 'light' | 'heavy' | 'clight' | 'cheavy' | 'air'
  | 'spN' | 'spF' | 'spU' | 'super';

export interface MoveDef {
  id: MoveId;
  /** 技名（HUD 演出・デバッグ表示用） */
  name: string;
  dmg: number;
  /** ガード時の削りダメージ（0=削りなし） */
  chip: number;
  startup: number;
  active: number;
  recovery: number;
  hitstun: number;
  blockstun: number;
  /** ヒット時ノックバック（相手の後方へ） */
  kbx: number;
  /** 打ち上げ初速（負=上方向） */
  kby: number;
  level: HitLevel;
  knockdown: boolean;
  /** ヒットボックス: 前方リーチ幅 */
  range: number;
  /** ヒットボックス上端（足元基準・負のオフセット） */
  hitY: number;
  hitH: number;
  hitstop: number;
  meterGain: number;
  /** 突進技: active 中の前進速度 */
  lunge?: number;
  /** 飛び道具を撃つ技か */
  projectile?: boolean;
  /** 出だし無敵フレーム（対空技） */
  invul?: number;
}

export interface CharDef {
  id: CharId;
  name: string;
  hp: number;
  walkF: number;
  walkB: number;
  jumpVy: number;
  jumpVx: number;
  w: number;
  h: number;
  crouchH: number;
  moves: Record<MoveId, MoveDef>;
}

export type ProjKind =
  | 'gofunc' | 'null' | 'swarm' | 'oom' | 'crate' | 'pipe' | 'beam'
  | 'fetch' | 'rain' | 'boomerang' | 'gpl';

export interface Projectile extends Rect {
  owner: Side;
  vx: number;
  vy: number;
  dmg: number;
  chip: number;
  hitstun: number;
  blockstun: number;
  kbx: number;
  kby: number;
  level: HitLevel;
  knockdown: boolean;
  /** 残り寿命フレーム */
  life: number;
  /** 発射までの遅延（>0 の間は動かず当たらない。スワームの時間差用） */
  delay: number;
  /** 重力（crate/rain の放物線・落下用。0=直進） */
  grav: number;
  /** 水平加速度（boomerang の往復用。初速と逆向きに効いて戻ってくる） */
  ax: number;
  kind: ProjKind;
  dead: boolean;
  hitstop: number;
  meterGain: number;
  /** 多段ヒット防止用の識別子 */
  id: number;
}

export interface Fighter extends Rect {
  side: Side;
  char: CharId;
  vx: number;
  vy: number;
  grounded: boolean;
  facing: Facing;
  hp: number;
  maxhp: number;
  /** 超必ゲージ 0..METER_MAX */
  meter: number;
  crouch: boolean;
  /** 攻撃の残りフレーム（atkTotal から減る）。0=非攻撃中 */
  atk: number;
  atkTotal: number;
  move: MoveId | null;
  /** 1発1ヒットの識別子（攻撃開始ごとに増える） */
  atkId: number;
  /** この攻撃が既に相手に当たった/ガードされたか */
  atkHit: boolean;
  hitstun: number;
  blockstun: number;
  /** 今ガードポーズか（描画・演出用） */
  blocking: boolean;
  /** ダウン残フレーム（>0 で転倒中・無敵） */
  kd: number;
  /** ヒットスタン中に着地したらダウンする（打ち上げ・ノックダウン技） */
  kdPending: boolean;
  /** 無敵残フレーム（起き上がり・対空無敵） */
  invul: number;
  /** 空中コンボ補正（当てるたび増、着地でリセット） */
  juggle: number;
  /** 空中攻撃を使用済みか（着地でリセット） */
  airAtk: boolean;
  /** ジャンプ中の水平速度（空中制御なし・固定） */
  airVx: number;
  /** 硬直終盤に押した技の先行入力 */
  buf: MoveId | null;
  /** 弱攻撃ヒット後の必殺キャンセル受付残フレーム */
  cancel: number;
  /** 取得ラウンド数 */
  wins: number;
  /** 2P カラーか（ミラー戦用） */
  alt: boolean;
}

/** 1プレイヤー分の生入力（押しっぱなし状態。エッジ検出は core 側で行う） */
export interface PlayerInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  light: boolean;
  heavy: boolean;
  special: boolean;
}

export interface GameInput {
  p1: PlayerInput;
  p2: PlayerInput;
  /** スタート（Enter）の押下エッジ */
  start: boolean;
}

export type EffectKind = 'spark' | 'block' | 'dust' | 'ko' | 'super';

export interface Effect {
  kind: EffectKind;
  x: number;
  y: number;
  t: number;
  total: number;
  dir: Facing;
}

export type Status = 'title' | 'select' | 'intro' | 'play' | 'roundEnd' | 'matchEnd';

export type Winner = Side | -1;

export interface AiState {
  /** 次の意思決定までのフレーム */
  think: number;
  /** 現在保持している入力 */
  hold: PlayerInput;
  /** 攻撃ボタンは1フレームだけ押す（エッジ用） */
  tapped: boolean;
}

export interface GameState {
  status: Status;
  /** cpu=P1人間+CPU / vs=2P対戦 / demo=CPU vs CPU 観戦（両側 AI・自動巡回） */
  mode: 'cpu' | 'vs' | 'demo';
  fighters: [Fighter, Fighter];
  projectiles: Projectile[];
  effects: Effect[];
  /** 残り時間（フレーム） */
  timer: number;
  round: number;
  /** ヒットストップ残フレーム（全体停止） */
  hitstop: number;
  /** intro/roundEnd/matchEnd の演出タイマー */
  statusTimer: number;
  roundMsg: string;
  winner: Winner;
  /** xorshift32 の内部状態（AI 用・決定論） */
  rng: number;
  /** CPU が操作する側（vs は -1）。demo は両側 AI なので参照しない。 */
  aiSide: Winner;
  /** 各サイドの AI 状態（demo は両方使う）。 */
  ai: [AiState, AiState];
  /** キャラ選択カーソル（0=gopher, 1=duke） */
  sel: [number, number];
  selDone: [boolean, boolean];
  /** エッジ検出用の前フレーム入力 */
  prevIn: [PlayerInput, PlayerInput];
  frame: number;
  /** 画面シェイク残フレーム */
  shake: number;
  /** タイトルのモードカーソル（0=CPU戦, 1=2P対戦, 2=観戦, 3=オンライン） */
  modeSel: number;
  /** 観戦モードで現在表示しているカード番号（全ペアを巡回）。 */
  demoPair: number;
  /** タイトルで「オンライン」を選んだ合図（配線層=main.ts がロビーへ遷移して false に戻す）。 */
  enterOnline: boolean;
  /** 再戦投票（vs のみ）: 各サイドの選択 0=はい / 1=いいえ。 */
  rematchSel: [number, number];
  /** 再戦投票の確定フラグ。 */
  rematchDone: [boolean, boolean];
  /** 再戦の結果シグナル。'quit'=どちらかが拒否→配線層が終了処理する。 */
  rematchResult: 'none' | 'quit';
}
