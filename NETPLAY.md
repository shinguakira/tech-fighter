# ネット対戦（オンライン）

決定論ロックステップ × WebRTC P2P。マッチング/シグナリングは **単一の Vercel 関数
（`api/net.ts`）＋ Upstash Redis（Vercel Storage 統合）＋ポーリング** で行う。

## 構成

```
ブラウザA ──┐   POST /api/net  (create/join/quick-match/signal/poll・単一関数)   ┌── ブラウザB
   │        └──────────────── Vercel Function ──── Upstash Redis ──────────────┘        │
   └───────────────── WebRTC DataChannel (P2P・60fpsの入力交換) ──────────────────────┘
```

- **接続確立まで**だけサーバー（`POST /api/net`）を経由（SDP/ICE を数通中継）。相手待ちはポーリングで受信。
- **対戦中はサーバーを一切通さず** P2P。両クライアントが同じ入力列から `step()` を回すので画面は常に一致（`src/net/session.ts`）。
- 入力ディレイ 3 フレーム（約 50ms）で遅延を吸収。

### なぜ Redis を挟むか
Vercel のサーバーレス関数は呼び出し毎に別インスタンスになり得るため、関数内の
`in-memory` 変数（`let ROOMS = {}` のようなもの）だけに頼ると、create と join が
別インスタンスに載った瞬間ルームが噛み合わなくなる（実際にこれで一度不具合が出た）。
**状態を関数の外＝Redis に置く**ことで、どのインスタンスが応答してもルーム/シグナル
の受け渡しが常に同じデータを見る。マッチング（`spop`）やメールボックス配送
（`rpush`/`lrange`）は Redis の原子的なコマンドで行うため、同時アクセスでも壊れない。

## ファイル

- `api/net.ts` — **マッチング＋シグナリングの単一関数**（Vercel も dev も同一）。
  状態は Upstash Redis（`RedisLike` インターフェース越し。テストは in-memory フェイクに差し替え）。
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

## セットアップ（必須: Redis 統合）

1. Vercel ダッシュボード → プロジェクト → **Storage** タブ → **Redis**（Upstash 提供、無料枠あり）を接続。
   → 本番の環境変数 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` が自動注入される。
2. ローカル dev でも同じ Redis を使うため:
   ```bash
   npx vercel env pull .env.local
   ```
   （`.env.local.example` に必要な変数名を記載。手動で値を入れても可）
3. `npm run dev` → 2タブで動作確認できる。

## Vercel デプロイ（最小手順）

Vite 静的サイト＋`api/net.ts` の1関数。**外部の常駐サーバーは不要**（Storage 統合のみ）。

1. GitHub にプッシュ。
2. Vercel で "New Project" → リポジトリを import → 上記の Redis 統合を接続。
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

- **WebRTC の NAT 越え**: STUN（Google 無料）で大半つながる。対称 NAT 等で失敗する場合は
  `src/net/webrtc.ts` の `iceServers` に TURN を追加（Metered などの無料枠）。
- **ネットコード**: ディレイ式ロックステップ（相手入力が届くまで待つ）。地域内なら快適。
  体感向上にはロールバックへ拡張可能（状態がシリアライズ可能なので実装可能）。
- **Redis 未接続の場合**: `api/net.ts` はエラーを JSON で返す（クラッシュはしない）が、
  マッチングは機能しない。デプロイ前に必ず Storage 統合を済ませること。
