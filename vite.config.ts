import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import { handleNetEvents, handleNetPost } from './src/net/server/handlers';

/**
 * 開発時のみ: ブラウザから canvas の dataURL を POST すると .shots/ に PNG 保存。
 * ヘッドレス検証用（fetch('/__shot?name=x', {method:'POST', body: canvas.toDataURL()})）。
 */
function shotEndpoint(): Plugin {
  return {
    name: 'shot-endpoint',
    configureServer(server) {
      server.middlewares.use('/__shot', (req, res) => {
        const url = new URL(req.url ?? '/', 'http://x');
        const name = (url.searchParams.get('name') ?? 'shot').replace(/[^\w-]/g, '_');
        let body = '';
        req.on('data', (c: Buffer) => { body += c.toString(); });
        req.on('end', () => {
          const b64 = body.replace(/^data:image\/png;base64,/, '');
          const dir = join(server.config.root, '.shots');
          mkdirSync(dir, { recursive: true });
          writeFileSync(join(dir, `${name}.png`), Buffer.from(b64, 'base64'));
          res.end('ok');
        });
      });
    },
  };
}

/**
 * 開発時のみ: /api/net/* を Vite dev サーバ内で処理（同一プロセス in-memory）。
 * 本番 Vercel では api/net/*.ts のサーバーレス関数が同じロジックを提供する。
 * これによりローカルの2タブでオンライン対戦フローを検証できる。
 */
function netEndpoint(): Plugin {
  return {
    name: 'net-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/net/', (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://x');
        const action = url.pathname.replace(/^\/?/, '').split('/').pop() ?? '';
        const query = Object.fromEntries(url.searchParams.entries());
        if (req.method === 'GET' && action === 'events') {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          });
          handleNetEvents(query, {
            write: (line) => { try { res.write(line); } catch { /* closed */ } },
            onClose: (fn) => req.on('close', fn),
          });
          return;
        }
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (c: Buffer) => { body += c.toString(); });
          req.on('end', () => {
            let parsed: Record<string, unknown> = {};
            try { parsed = body ? JSON.parse(body) : {}; } catch { /* ignore */ }
            const out = handleNetPost(action, { body: parsed, query });
            res.writeHead(out.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(out.json));
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [shotEndpoint(), netEndpoint()],
  // 純粋ロジックは DOM 非依存なので node 環境でテストできる（速い）
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
