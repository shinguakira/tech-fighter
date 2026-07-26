# ネット対戦（オンライン）

決定論ロックステップ × WebRTC P2P。マッチング/シグナリングは **常駐 Socket.IO サーバー**で行う
（`../PoC/video-call` と同型）。サーバーレスの in-memory 問題を避けるため、シグナリングは
**ずっと起きている 1 プロセス**が担う。

## 構成

```
ブラウザA ──┐  Socket.IO (matchmake / signal 中継)  ┌── ブラウザB
   │        └────── 常駐 Node サーバー (server/) ────┘        │
   └──────────── WebRTC DataChannel (P2P・60fpsの入力交換) ──────────┘
```

- **接続確立まで**だけ Socket.IO サーバーを経由（SDP/ICE を数通中継）。**対戦中はサーバー非経由の P2P**。
- 両クライアントが同じ入力列から `step()` を回すので画面は常に一致（`src/net/session.ts`）。入力ディレイ 3 フレーム。
- **なぜ Socket.IO（常駐）か**: Vercel 等のサーバーレスは呼び出し毎に別インスタンスになり得て、
  in-memory のルームが噛み合わず「マッチングできない」。常駐プロセスなら1箇所で状態を持てるので確実。
  （この判断は video-call PoC の実装＝ Socket.IO in-memory 常駐に倣った）
- **切断対策**: WebRTC の一時的な `disconnected` は 8 秒猶予して自動復帰を待つ（即終了しない）。
  相手のタブが閉じたら Socket.IO の `peer-left` で検知。
- **TURN は未設定**（video-call と同条件）。同一/良回線なら STUN のみで繋がる。対称NAT 等の一部回線を
  確実にしたい場合のみ `src/net/webrtc.ts` の `iceServers` に TURN を足す。

## ファイル

- `server/rooms.ts` — ルーム管理コア（ソケット非依存・テスト対象）。
- `server/signal.ts` — `attachSignaling(httpServer)`。Socket.IO を http サーバーに相乗り（dev/prod 共通）。
- `server/index.ts` — 本番の常駐サーバー。`dist/` を配信しつつ同一プロセスで Socket.IO を動かす。
- `src/net/signal-socket.ts` — クライアント（socket.io-client）。
- `src/net/online.ts` — マッチング→シグナリング→WebRTC 確立のオーケストレータ。
- `src/net/{session,transport,webrtc}.ts` — ロックステップ／トランスポート／WebRTC。
- `src/net/online-ui.ts` — ロビー/接続/対戦の状態機械＋オーバーレイ。
- `vite.config.ts` の `signalingDev` — dev サーバに同じ `attachSignaling` を相乗り（ローカル2タブ検証用）。

## 遊び方

タイトル →「オンライン対戦」→ **Q** クイックマッチ / **R** ルーム作成 / **F** ルーム参加。
操作は両者とも 1P と同じ（WASD＋JKL、スマホはオンスクリーン）。`Esc` で退出。

## デプロイ

### 推奨: サーバー一体（1デプロイ）
フロント配信＋シグナリングを 1 つの常駐サーバーで動かす。**Render / Fly.io / Railway** の無料枠へ。

- ビルド: `npm ci && npm run build:prod`（`dist/` を生成）
- 起動: `npm start`（`server/index.ts` が `dist/` 配信＋Socket.IO）
- Render は同梱の `render.yaml` で Blueprint デプロイ可（`/healthz` でヘルスチェック）。

```bash
npm run build:prod && npm start   # ローカル本番相当（http://localhost:3000）
```

### フロントを Vercel に置く場合（2デプロイ）
- 常駐サーバーだけ Render 等にデプロイ。
- フロントは Vercel（`vercel.json` の静的ビルド）。ビルド時に **`VITE_SIGNALING_URL`** を
  常駐サーバーの URL に設定（`.env.local.example` 参照）。

## 既知の制約

- **TURN 無し**: 対称NAT／一部モバイル・企業ネットワークは P2P 直結できず接続不可（TURN で解決）。
- **無料の常駐ホストはアイドルでスリープする場合がある**（Render 無料等）。初回接続時に数十秒の
  起床待ちが出ることがある。
- **ネットコード**: ディレイ式ロックステップ。地域内なら快適。体感向上にはロールバックへ拡張可能。
