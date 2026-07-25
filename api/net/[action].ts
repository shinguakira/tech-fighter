// Vercel サーバーレス関数: POST /api/net/{create|join|quick-match|signal}
// dev では vite.config.ts の netEndpoint が同じロジックを提供する。
// （このファイルは Vercel Node ランタイムで動作。プロジェクトの tsgo 対象外）
import { handleNetPost } from '../../src/net/server/handlers';

export default function handler(req: any, res: any): void {
  const action = String(req.query?.action ?? '');
  let body: Record<string, unknown> = {};
  if (req.body && typeof req.body === 'object') body = req.body;
  else if (typeof req.body === 'string' && req.body) { try { body = JSON.parse(req.body); } catch { /* ignore */ } }
  const out = handleNetPost(action, { body, query: req.query ?? {} });
  res.status(out.status).json(out.json);
}
