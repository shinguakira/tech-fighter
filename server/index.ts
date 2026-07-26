// 本番の常駐サーバー: dist/ を静的配信しつつ、同一プロセスで Socket.IO シグナリングを動かす。
// Render / Fly / Railway 等の永続ホストにデプロイ（`npm start`）。
// フロントを別ホスト(Vercel 等)に置く場合は、この server だけ動かして
// クライアントの VITE_SIGNALING_URL をこの URL に向ける。
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import express from 'express';
import { attachSignaling } from './signal';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');

const app = express();
app.get('/healthz', (_req, res) => { res.send('ok'); });
app.use(express.static(DIST));
// SPA フォールバック（/socket.io は Socket.IO が先に処理する）
app.use((_req, res) => { res.sendFile(join(DIST, 'index.html')); });

const server = createServer(app);
attachSignaling(server);

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => {
  console.log(`[tech-fighter] server + signaling on :${PORT}`);
});
