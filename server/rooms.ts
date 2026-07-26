// ルーム管理のコア（ソケット非依存・テスト可能）。
// 常駐プロセスの in-memory 状態。プレイヤーは socket id で識別、players[0]=host(offerer)。

export interface Room { id: string; players: string[] }

const CODE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 紛らわしい文字を除外

export type Role = 'host' | 'guest';
export interface MatchOk { ok: true; roomId: string; role: Role }
export interface MatchErr { ok: false; error: string }
export type MatchResult = MatchOk | MatchErr;

export class Rooms {
  private map = new Map<string, Room>();
  private rand: () => number;

  /** rand は決定論テスト用に差し替え可能（既定は Math.random）。 */
  constructor(rand: () => number = Math.random) { this.rand = rand; }

  private genCode(): string {
    let s = '';
    for (let i = 0; i < 4; i++) s += CODE[Math.floor(this.rand() * CODE.length)];
    return s;
  }

  /** sid が今いるルーム。 */
  roomOf(sid: string): Room | undefined {
    for (const r of this.map.values()) if (r.players.includes(sid)) return r;
    return undefined;
  }

  /** 同じルームの相手 socket id。 */
  peerOf(sid: string): string | undefined {
    const r = this.roomOf(sid);
    return r?.players.find((p) => p !== sid);
  }

  /** ルーム作成（host になる）。既存の所属からは抜ける。 */
  create(sid: string): MatchOk {
    this.leave(sid);
    let id = this.genCode();
    while (this.map.has(id)) id = this.genCode();
    this.map.set(id, { id, players: [sid] });
    return { ok: true, roomId: id, role: 'host' };
  }

  /** コード指定で参加（guest）。 */
  join(code: string, sid: string): MatchResult {
    const room = this.map.get((code || '').toUpperCase());
    if (!room) return { ok: false, error: 'ルームが見つかりません' };
    if (room.players.includes(sid)) return { ok: true, roomId: room.id, role: room.players[0] === sid ? 'host' : 'guest' };
    if (room.players.length >= 2) return { ok: false, error: 'ルームが満員です' };
    this.leave(sid);
    room.players.push(sid);
    return { ok: true, roomId: room.id, role: 'guest' };
  }

  /** クイックマッチ: 空き(1人)ルームがあれば参加、無ければ作成。 */
  quick(sid: string): MatchOk {
    for (const room of this.map.values()) {
      if (room.players.length === 1 && !room.players.includes(sid)) {
        return this.join(room.id, sid) as MatchOk;
      }
    }
    return this.create(sid);
  }

  /** sid を退室させ、相手 sid（居れば）を返す。空室は破棄。 */
  leave(sid: string): { roomId?: string; peer?: string } {
    const room = this.roomOf(sid);
    if (!room) return {};
    const peer = room.players.find((p) => p !== sid);
    room.players = room.players.filter((p) => p !== sid);
    if (room.players.length === 0) this.map.delete(room.id);
    return { roomId: room.id, peer };
  }

  /** テスト用: ルーム数。 */
  size(): number { return this.map.size; }
}
