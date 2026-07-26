// 常駐 Socket.IO シグナリング。video-call の instrumentation.ts と同型。
// http.Server に相乗りさせる（本番の Node サーバー / dev の Vite サーバー 両方）。
import type { Server as HttpServer } from 'node:http';
import type { Http2SecureServer } from 'node:http2';
import { Server as IOServer } from 'socket.io';
import { Rooms } from './rooms';

type MatchMode = 'create' | 'join' | 'quick';

/** 与えた http サーバーに Socket.IO のシグナリングを取り付ける（Vite の http2 サーバーにも対応）。 */
export function attachSignaling(httpServer: HttpServer | Http2SecureServer): IOServer {
  const io = new IOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });
  const rooms = new Rooms();

  io.on('connection', (socket) => {
    // マッチング（create/join/quick）。ack で {ok, roomId, role} を返す。
    socket.on('matchmake', (payload: { mode: MatchMode; code?: string }, ack?: (r: unknown) => void) => {
      const mode = payload?.mode;
      const res = mode === 'create' ? rooms.create(socket.id)
        : mode === 'join' ? rooms.join(payload.code ?? '', socket.id)
          : rooms.quick(socket.id);
      if (res.ok) {
        void socket.join(res.roomId);
        // 2人目が入ったら host(=players[0]) に通知（host が offer を作る）
        const room = rooms.roomOf(socket.id);
        if (room && room.players.length === 2) io.to(room.players[0]!).emit('peer-joined');
      }
      ack?.(res);
    });

    // WebRTC シグナル（offer/answer/ice）を相手へ中継。
    socket.on('signal', (payload: { signal: unknown }) => {
      const peer = rooms.peerOf(socket.id);
      if (peer) io.to(peer).emit('signal', { signal: payload?.signal });
    });

    const partOut = (): void => {
      const { peer } = rooms.leave(socket.id);
      if (peer) io.to(peer).emit('peer-left');
    };
    socket.on('leave', partOut);
    socket.on('disconnect', partOut);
  });

  return io;
}
