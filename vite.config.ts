import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import netHandler from './api/net';

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
 * 開発時のみ: /api/net を Vite dev サーバ内で処理。
 * **本番 Vercel の api/net.ts と同一ハンドラを呼ぶ**ので、dev と prod が完全一致。
 * これによりローカルの2タブでオンライン対戦フローを本番同等に検証できる。
 */
function netEndpoint(): Plugin {
  return {
    name: 'net-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/net', (req, res) => {
        void netHandler(req, res);
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
