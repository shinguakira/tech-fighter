import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import { attachSignaling } from './server/signal';

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
 * 開発時のみ: Vite dev サーバの http サーバーに Socket.IO シグナリングを相乗り。
 * **本番の server/index.ts と同じ attachSignaling を呼ぶ**ので dev と prod が一致。
 * これによりローカルの2タブでオンライン対戦フローを本番同等に検証できる。
 */
function signalingDev(): Plugin {
  return {
    name: 'signaling-dev',
    configureServer(server) {
      if (server.httpServer) attachSignaling(server.httpServer);
    },
  };
}

export default defineConfig({
  plugins: [shotEndpoint(), signalingDev()],
  // 純粋ロジックは DOM 非依存なので node 環境でテストできる（速い）
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
