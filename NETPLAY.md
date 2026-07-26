# ネット対戦（オンライン）

決定論ロックステップ × WebRTC P2P。マッチング/シグナリングだけ **単一の Vercel 関数（in-memory＋ポーリング）** を使う。

## 構成

```
ブラウザA ──┐   POST /api/net  (create/join/quick-match/signal/poll・単一関数)   ┌── ブラウザB
   │        └────────────────── Vercel Function (api/net.ts) ─────────────────┘        │
   └───────────────── WebRTC DataChannel (P2P・60fpsの入力交換) ──────────────────────┘
```

- **接続確立まで**だけサーバー（`POST /api/net`）を経由（SDP/ICE を数通中継）。相手待ちはポーリングで受信。
- **対戦中はサーバーを一切通さず** P2P。両クライアントが同じ入力列から `step()` を回すので画面は常に一致（`src/net/session.ts`）。
- 入力ディレイ 3 フレーム（約 50ms）で遅延を吸収。

### Vercel 制約への対応（重要）
Vercel のサーバーレスは**状態を持てない**（呼び出し毎に別インスタンスになり得る）。それでも動くように:
- **全操作を単一関数 `api/net.ts` に統合**（別関数だとメモリを共有できない）。
- **SSE をやめてポーリング**（接続を掴みっぱなしにせず、サーバーレスと相性が良い）。
- **自己完結・生の Node req/res**（外部 import やフレームワーク拡張に依存せず、関数が落ちない）。
- dev（`vite.config.ts`）も**同じ `api/net.ts` ハンドラ**を呼ぶので、ローカル＝本番。

## ファイル

- `api/net.ts` — **マッチング＋シグナリングの単一関数**（Vercel も dev も同一）。in-memory ルーム＋ポーリング。
- `src/net/session.ts` — ロックステップ中核（トランスポート非依存）。
- `src/net/transport.ts` — `Transport` 抽象＋テスト用ループバック。
- `src/net/webrtc.ts` — `RTCDataChannel` を `Transport` 化。
- `src/net/signal-client.ts` — `/api/net` クライアント（fetch＋ポーリング）。
- `src/net/online.ts` — マッチング→シグナリング→WebRTC 確立のオーケストレータ。
- `src/net/online-ui.ts` — ロビー/接続/対戦の状態機械＋オーバーレイ描画（配線層）。
- `vite.config.ts` の `netEndpoint` — dev で `api/net.ts` を配線（ローカル2タブ検証用）。

## 遊び方

タイトル →「オンライン対戦」→
- **Q** クイックマッチ（待機中の相手と自動マッチング）
- **R** ルーム作成（表示コードを相手に共有）
- **F** ルーム参加（コード入力）

操作は両者とも 1P と同じ（WASD＋JKL）。`Esc` で退出。

## Vercel デプロイ（最小手順）

Vite 静的サイト＋`api/net.ts` の1関数だけ。**外部サービス不要**。

1. GitHub にプッシュ。
2. Vercel で "New Project" → リポジトリを import。
3. Framework は自動で **Vite** 判定（`vercel.json` で明示済み）。そのまま Deploy。
   - 静的ビルド = `dist/`、`/api/net` は Node サーバーレス関数として自動デプロイ。
4. 発行された URL を2人で開けば対戦可能。

CLI なら:

```bash
npm i -g vercel
vercel        # プレビュー
vercel --prod # 本番
```

## 既知の制約（正直に）

- **Vercel の状態共有**: サーバーレスは状態を持てないので、**稀に2人が別インスタンスに載るとルームが噛み合わない**。
  低トラフィック（2人・数秒の接続窓）なら実際は同一インスタンスに載りやすく実用上ほぼ動くが、**100%の保証はできない**。
  確実に固めたい場合の唯一の方法は「関数の外に状態を置く」＝共有ストア（Vercel KV 等）か永続サーバー。
  その場合は `api/net.ts` の `ROOMS`（in-memory）をストアに差し替えるだけ（ロジックはそのまま）。
- **ルーム作成（R）の方がクイックマッチ（Q）より安定**: create→共有→join は数秒の逐次アクセスで同一インスタンスに載りやすい。
  クイックマッチは2人同時アクセスで別インスタンスになる可能性がやや高い。
- **WebRTC の NAT 越え**: STUN（Google 無料）で大半つながる。対称 NAT 等で失敗する場合は
  `src/net/webrtc.ts` の `iceServers` に TURN を追加（Metered などの無料枠）。
- **ネットコード**: ディレイ式ロックステップ（相手入力が届くまで待つ）。地域内なら快適。
  体感向上にはロールバックへ拡張可能（状態がシリアライズ可能なので実装可能）。
