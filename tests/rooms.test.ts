import { beforeEach, describe, expect, it } from 'vitest';
import { Rooms } from '../server/rooms';

describe('マッチング/シグナリング（常駐サーバーの Rooms）', () => {
  let rooms: Rooms;
  // 決定論の擬似乱数（コード生成用）
  beforeEach(() => {
    let s = 12345;
    rooms = new Rooms(() => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; });
  });

  it('create: host が作成され、コードが返る', () => {
    const r = rooms.create('a');
    expect(r.ok).toBe(true);
    expect(r.role).toBe('host');
    expect(r.roomId).toMatch(/^[A-Z0-9]{4}$/);
    expect(rooms.size()).toBe(1);
  });

  it('join: guest 参加で2人に。満員は弾く', () => {
    const host = rooms.create('a');
    const g = rooms.join(host.roomId, 'b');
    expect(g.ok).toBe(true);
    if (g.ok) expect(g.role).toBe('guest');
    expect(rooms.join(host.roomId, 'c').ok).toBe(false);
  });

  it('存在しないコードは参加失敗', () => {
    expect(rooms.join('ZZZZ', 'x').ok).toBe(false);
  });

  it('quick: 待機があれば参加、無ければ作成', () => {
    const first = rooms.quick('a');
    expect(first.role).toBe('host');
    const second = rooms.quick('b');
    expect(second.role).toBe('guest');
    expect(second.roomId).toBe(first.roomId);
    const third = rooms.quick('c');
    expect(third.role).toBe('host');
    expect(third.roomId).not.toBe(first.roomId);
  });

  it('peerOf: 同じルームの相手 socket を返す', () => {
    const host = rooms.create('a');
    rooms.join(host.roomId, 'b');
    expect(rooms.peerOf('a')).toBe('b');
    expect(rooms.peerOf('b')).toBe('a');
    expect(rooms.peerOf('x')).toBeUndefined();
  });

  it('leave: 退室で相手を返し、空室は破棄', () => {
    const host = rooms.create('a');
    rooms.join(host.roomId, 'b');
    const left = rooms.leave('b');
    expect(left.peer).toBe('a'); // 残った host を通知対象で返す
    expect(rooms.peerOf('a')).toBeUndefined();
    rooms.leave('a');
    expect(rooms.size()).toBe(0); // 空室破棄
  });

  it('新しい matchmake で前のルームからは自動退室', () => {
    const r1 = rooms.create('a');
    rooms.create('a'); // 作り直し
    // 前のルームは a が抜けて空 → 破棄
    expect(rooms.size()).toBe(1);
    expect(rooms.roomOf('a')?.id).not.toBe(r1.roomId);
  });
});
