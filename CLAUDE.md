# TECH FIGHTER — 技術スタック格ゲー

Gopher / Duke / Ferris / Tux / Deno / GNU が戦う 2D 格闘ゲーム。単一 Canvas・TypeScript。
アーキテクチャは `../2d-action`（GOPHER DEVIL）踏襲。

## キャラクターとライセンス

- **Gopher**（Go）— Renée French 作 / CC BY 4.0。クレジット表記必須（タイトル画面に常時表示）。
- **Duke**（Java）— Sun が 2006 年に New BSD License でオープンソース化。使用・改変自由。
- **Ferris**（Rust）— Karen Rustad Tölva 作 / CC0 パブリックドメイン（rustacean.net）。
- **Tux**（Linux）— Larry Ewing 作。クレジット表記（lewing@isc.tamu.edu and The GIMP）で使用・改変自由。
- **Deno**（Deno）— 元祖マスコット（ry 作）が MIT License（deno.com/artwork）。
- **GNU**（GNU）— A GNU head（Aurélio A. Heckert 作）/ Free Art License・GFDL・CC BY-SA（gnu.org）。
- 全キャラ画像素材ではなく **Canvas 手続き描画**（`src/render/<char>.ts`）。
- 各言語の**ロゴやワードマークは商標なので描かない**（マスコットのみ使用）。
- ライセンス未整備のため見送ったマスコット: **Elysia chan**（ライセンス明記なし＋特定作家の著作キャラ）、
  **Bun**（コードは MIT だがマスコット未整備）、**PHP elePHPant**、**FreeBSD Beastie**（用途限定）。

## ゲームデザイン

- 2 ラウンド先取・99 秒タイマー・体力バー＋超必ゲージ（STACK）。
- 技: 弱 / 強 / しゃがみ版 / ジャンプ攻撃 / 必殺 3 種（中立=飛び道具・前=突進・上=対空）/ 超必殺。
- ガード: 相手と反対へ入力。下段はしゃがみ、ジャンプ攻撃は立ちでのみガード可。必殺は削りあり。
  **grab 属性はガード不能**（ただし空中の相手には当たらない）。
- 弱ヒット → 必殺キャンセル可。空中ヒットは必ずダウン。起き上がり無敵あり。
- Gopher=軽量ラッシュ（go routine() / Channel Rush / panic() / GOROUTINE SWARM）、
  Duke=重量パワー（NullPointerException / HotSpot Tackle / Stack Trace Upper / OutOfMemoryError）、
  Ferris=装甲グラップラー（cargo throw=放物線クレート / Borrow Checker=突進掴み / unsafe { }=超必掴み）、
  Tux=下段ゾナー（Pipe | Stream=地這い下段弾 / Penguin Slide / KERNEL PANIC=横断ビーム）、
  Deno=万能ラッシュ（fetch()=速い弾 / Permission Dash=突進 / Top-Level Await=対空 / DENO DEPLOY=降雨弾）、
  GNU=曲射ゾナー（Recursive GNU=往復ブーメラン / Emacs Charge=突進 / Freedom Rising=対空 / GPL CASCADE=巨大弾）。
- モード: VS CPU（AI は決定論 xorshift）/ 2P ローカル対戦 / 観戦（CPU vs CPU・全15カード自動巡回）/
  オンライン対戦（WebRTC P2P・決定論ロックステップ。詳細は `NETPLAY.md`）。

## アーキテクチャ

- `src/core/` — **純粋ロジック。DOM 非依存で全ユニットテスト対象。** `game.ts` の
  `createGame()` と `step(state, input)` は `Math.random`/`Date` を使わない決定論的フレーム更新
  （乱数は `state.rng` の xorshift32）。
- `src/render/` — 状態 → Canvas 描画のみ（`canvas.ts` + キャラ別 `gopher.ts`/`duke.ts`、ポーズ計算 `pose.ts`）。
- `src/input/controls.ts` — キーボード → `GameInput`（DOM 入力はここだけ）。1P=WASD+JKL、2P=矢印+テンキー123（or B/N/M）。
- `src/audio/sound.ts` — Web Audio の**手続き合成**（音源ファイル無し）。core は無音のまま、`sound.update(state)` が
  GameState の差分（被弾/ガード/技発生/飛び道具/ジャンプ/ゲージMAX/KO/画面遷移）を観測して SFX を鳴らし、
  BGM（ベース＋リードの16ステップループ）の音量を状況で調整。Backquote(`) でミュート。
- `src/net/` — **オンライン対戦**（決定論ロックステップ × WebRTC P2P）。core は無改造で、
  各クライアントが同じ入力列から `step()` を回して同期。マッチング/シグナリングだけ `/api/net/*`
  （in-memory+SSE。dev は `vite.config.ts` の netEndpoint、本番は `api/net/*.ts`）。詳細は `NETPLAY.md`。
- `src/main.ts` — 配線（rAF: input → step → sound.update → render。オンライン中は OnlineController が駆動）。

## コマンド

- `npm run dev` — Vite 開発サーバ
- `npm test` — Vitest（1回）/ `npm run test:watch`
- `npm run typecheck` — tsgo（TypeScript 7 native）で型検査
- `npm run build` — 型検査 → vite build

## AI

- `src/core/ai.ts` — `aiInput()` が**汎用 AI**（距離帯別の確率行動＋反射ガード/対空）。
- **キャラ専用 AI** は同ファイルの `CUSTOM_AI` レジストリに登録し、`aiFor(st, side)` が
  キャラに応じて自動で切替（未登録は汎用）。現状 **gopher のみ専用**（`gopherAI`＝地上ラッシュ＋
  弱ヒット確認からの必殺キャンセル）。専用 AI で動く側は HUD 名の横に `★専用AI` を表示。
- 全 AI は決定論（`roll()` が `st.rng` の xorshift32 を進める。`Math.random` 不使用）。

## 強さ調査

- `npx vite-node scripts/tournament.ts` — AI vs AI 総当たり（10 seeds × 両サイド）で勝率ランクと相性表を出力。
- `npx vite-node scripts/diag-gopher.ts` — 専用 AI の敗因診断（被弾状況・キャンセル成功数など）。新キャラ専用 AI の調整に流用。

## デバッグ

- `window.__g()` — 状態サマリ / `__gs()` — GameState 生参照 / `__reset()` / `__run(n)` — 同期 n フレーム実行 / `__demo(pair?)` — 観戦モードへ即ジャンプ。
- dev サーバに `/__shot?name=x` POST（canvas.toDataURL）で `.shots/` に PNG 保存
  （非表示タブでも `__run` + `/__shot` でスクリーンショット検証できる）。
