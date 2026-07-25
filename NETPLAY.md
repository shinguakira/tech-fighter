# ネット対戦（オンライン）

決定論ロックステップ × WebRTC P2P。マッチング/シグナリングだけ最小のサーバー関数を使う。

## 構成

```
ブラウザA ──┐   /api/net/* (マッチング＋WebRTCシグナリング, in-memory+SSE)   ┌── ブラウザB
   │        └────────────────── Vercel Functions ──────────────────────────┘        │
   └───────────────── WebRTC DataChannel (P2P・60fpsの入力交換) ──────────────────────┘
```

- **接続確立まで**だけサーバー（`/api/net/*`）を経由（SDP/ICE を数通中継）。
- **対戦中はサーバーを一切通さず** P2P。両クライアントが同じ入力列から `step()` を回すので画面は常に一致（`src/net/session.ts`）。
- 入力ディレイ 3 フレーム（約 50ms）で遅延を吸収。

## ファイル

- `src/net/session.ts` — ロックステップ中核（トランスポート非依存）。
- `src/net/transport.ts` — `Transport` 抽象＋テスト用ループバック。
- `src/net/webrtc.ts` — `RTCDataChannel` を `Transport` 化。
- `src/net/online.ts` — マッチング→シグナリング→WebRTC 確立のオーケストレータ。
- `src/net/online-ui.ts` — ロビー/接続/対戦の状態機械＋オーバーレイ描画（配線層）。
- `src/net/signal-client.ts` — `/api/net/*` クライアント（fetch＋EventSource）。
- `src/net/server/rooms.ts` — ルーム＆シグナル中継のコア（in-memory）。
- `src/net/server/handlers.ts` — HTTP 非依存のハンドラ本体。
- `api/net/[action].ts` / `api/net/events.ts` — Vercel 関数（本番）。
- `vite.config.ts` の `netEndpoint` — dev サーバ内で同じ API を提供（ローカル2タブ検証用）。

## 遊び方

タイトル →「オンライン対戦」→
- **Q** クイックマッチ（待機中の相手と自動マッチング）
- **R** ルーム作成（表示コードを相手に共有）
- **F** ルーム参加（コード入力）

操作は両者とも 1P と同じ（WASD＋JKL）。`Esc` で退出。

## Vercel デプロイ（最小手順）

このリポジトリは Vite 静的サイト＋`/api` サーバーレス関数の構成で、**外部サービス不要**。

1. GitHub にプッシュ。
2. Vercel で "New Project" → リポジトリを import。
3. Framework は自動で **Vite** 判定（`vercel.json` で明示済み）。そのまま Deploy。
   - 静的ビルド = `dist/`、`/api/net/*` は Node サーバーレス関数として自動デプロイ。
4. 発行された URL を2人で開けば対戦可能。

CLI なら:

```bash
npm i -g vercel
vercel        # プレビュー
vercel --prod # 本番
```

## 既知の制約

- **WebRTC の NAT 越え**: STUN（Google の無料）で大半つながる。対称 NAT 等で失敗する場合は
  `src/net/webrtc.ts` の `iceServers` に TURN を追加（Cloudflare/Metered などの無料枠）。
- **Vercel の in-memory シグナリング**: サーバーレスはインスタンス毎にメモリが別になり得るため、
  稀に SSE と POST が別インスタンスに載るとマッチングに失敗することがある（dev/単一ノードでは常に一致）。
  恒久運用で不安定なら `src/net/server/rooms.ts` の `Rooms` を Vercel KV 等に置き換え可能
  （インターフェースはそのまま流用できる）。
- **ネットコード**: 現状はディレイ式ロックステップ（相手入力が届くまで待つ）。地域内なら快適。
  さらなる体感向上にはロールバックへ拡張可能（状態がシリアライズ可能なので実装可能）。
