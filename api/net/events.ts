// Vercel サーバーレス関数: GET /api/net/events?roomId=&playerId=（SSE シグナリング）
// dev では vite.config.ts の netEndpoint が同じロジックを提供する。
import { handleNetEvents } from '../../src/net/server/handlers';

export const config = { maxDuration: 60 };

export default function handler(req: any, res: any): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  handleNetEvents(req.query ?? {}, {
    write: (line: string) => { try { res.write(line); } catch { /* closed */ } },
    onClose: (fn: () => void) => { req.on('close', fn); },
  });
}
