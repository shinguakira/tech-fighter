import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/chakra-petch/700-italic.css';
import { createGame, demoPairs, startDemoMatch, step } from './core/game';
import { render, resetRenderState } from './render/canvas';
import { createControls } from './input/controls';
import { Sound } from './audio/sound';
import { OnlineController } from './net/online-ui';

const canvas = document.getElementById('c') as HTMLCanvasElement | null;
if (!canvas) throw new Error('canvas #c not found');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2d context unavailable');

let game = createGame();
const input = createControls();
const sound = new Sound();
const online = new OnlineController();
let prevStatus = game.status;

// autoplay 制約: 最初のユーザー操作で音を初期化。Backquote(`) でミュート切替。
const initAudio = (): void => sound.ensure();
window.addEventListener('pointerdown', initAudio, { once: true });
window.addEventListener('keydown', (e) => {
  sound.ensure();
  if (e.code === 'Backquote') sound.toggleMute();
  // オンラインのロビー/対戦キー（Q/R/F/Esc）は online に委譲
  if (online.isActive()) online.onKey(e.code);
});

function loop(): void {
  const gi = input.consume();

  if (online.isActive()) {
    // オンライン: ロビー/接続中はタイトル背景、対戦中は net セッションを描画
    const netGame = online.step(gi.p1); // ローカルは 1P キー入力を使う
    const shown = netGame ?? game;
    document.body.classList.toggle('playing', netGame != null && (shown.status === 'play' || shown.status === 'intro'));
    if (netGame) sound.update(netGame);
    render(ctx!, shown, online.netInfo());
    online.draw(ctx!);
    drawMuteIndicator();
    requestAnimationFrame(loop);
    return;
  }

  step(game, gi);
  // タイトルで「オンライン」決定 → ロビーへ
  if (game.enterOnline) { game.enterOnline = false; online.open(); }
  // ローカル2P: 再戦投票で「いいえ」→ タイトルへ
  if (game.mode === 'vs' && game.rematchResult === 'quit') { game = createGame(); prevStatus = game.status; }
  if (game.status !== prevStatus) {
    // 対戦開始時に描画側の持続状態（HPラグ等）をリセット
    if (game.status === 'intro' && (prevStatus === 'select' || prevStatus === 'matchEnd' || prevStatus === 'title')) resetRenderState();
    prevStatus = game.status;
  }
  document.body.classList.toggle('playing', game.status === 'play' || game.status === 'intro');
  sound.update(game);
  render(ctx!, game);
  drawMuteIndicator();
  requestAnimationFrame(loop);
}

// ミュート中だけ右上に小さく表示（通常は非表示）。
function drawMuteIndicator(): void {
  if (!sound.isMuted()) return;
  const c = ctx!;
  c.save();
  c.font = '600 12px "Chakra Petch"';
  c.fillStyle = 'rgba(255,120,120,0.85)';
  c.textAlign = 'right';
  c.fillText('🔇 MUTE (`)', 792, 14);
  c.restore();
}

// 表示フォントを先に読み込んでから開始（初回フレームのフォールバック点滅を防ぐ）
const start = (): void => { requestAnimationFrame(loop); };
Promise.all([
  document.fonts.load('700 54px "Chakra Petch"'),
  document.fonts.load('italic 700 54px "Chakra Petch"'),
  document.fonts.load('600 16px "Chakra Petch"'),
  document.fonts.load('500 14px "Chakra Petch"'),
]).then(start, start);

// デバッグ用フック（プレビュー検証用）
interface DebugWindow extends Window {
  __g?: () => unknown;
  __gs?: () => unknown;
  __reset?: () => void;
  __run?: (n: number) => void;
  __demo?: (pair?: number) => void;
}
(window as DebugWindow & { __snd?: Sound; __netTest?: (n?: number) => Promise<unknown> }).__snd = sound;
// 全スタック自己テスト（同一ページで host/guest を張り WebRTC 対戦の同期を確認）
(window as DebugWindow & { __netTest?: (n?: number) => Promise<unknown> }).__netTest = (n = 300) =>
  import('./net/selftest').then((m) => m.netSelfTest(n));
(window as DebugWindow).__gs = () => game;
(window as DebugWindow).__reset = () => { game = createGame(); };
// 観戦モードへ即ジャンプ（pair 省略で先頭カードから巡回）。
(window as DebugWindow).__demo = (pair = 0) => {
  game = createGame();
  game.demoPair = ((pair % demoPairs().length) + demoPairs().length) % demoPairs().length;
  startDemoMatch(game);
};
// 非表示タブ（rAF 停止）でも進められる同期ステップ実行。実行後に1回描画。
(window as DebugWindow).__run = (n: number) => {
  for (let i = 0; i < n; i++) { step(game, input.consume()); sound.update(game); }
  render(ctx!, game);
  drawMuteIndicator();
};
(window as DebugWindow).__g = () => ({
  status: game.status,
  round: game.round,
  timer: Math.ceil(game.timer / 60),
  p1: { char: game.fighters[0].char, hp: game.fighters[0].hp, x: Math.round(game.fighters[0].x), wins: game.fighters[0].wins, meter: Math.round(game.fighters[0].meter) },
  p2: { char: game.fighters[1].char, hp: game.fighters[1].hp, x: Math.round(game.fighters[1].x), wins: game.fighters[1].wins, meter: Math.round(game.fighters[1].meter) },
  projectiles: game.projectiles.length,
});
