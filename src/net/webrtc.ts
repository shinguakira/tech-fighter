// WebRTC DataChannel を Transport として提供する。
// ロックステップの入力メッセージを ordered チャンネルで P2P 送受信する。
import type { NetMsg, Transport } from './transport';

const STUN: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
  // 必要に応じて TURN をここに追加（対称NAT対策）。
};

export function createPeer(): RTCPeerConnection {
  return new RTCPeerConnection(STUN);
}

/** RTCDataChannel を Transport 化。onMessage 登録前の受信は取りこぼさずバッファする。 */
export function channelTransport(channel: RTCDataChannel, pc: RTCPeerConnection): Transport {
  let cb: ((m: NetMsg) => void) | null = null;
  const buffer: NetMsg[] = [];
  channel.onmessage = (e) => {
    let m: NetMsg;
    try { m = JSON.parse(e.data as string) as NetMsg; } catch { return; }
    if (cb) cb(m); else buffer.push(m);
  };
  return {
    send: (m) => { if (channel.readyState === 'open') channel.send(JSON.stringify(m)); },
    onMessage: (fn) => { cb = fn; for (const m of buffer.splice(0)) fn(m); },
    close: () => { try { channel.close(); } catch { /* noop */ } try { pc.close(); } catch { /* noop */ } },
  };
}

/** チャンネルが open になるまで待つ（タイムアウト付き）。 */
export function waitOpen(channel: RTCDataChannel, timeoutMs = 15000): Promise<void> {
  if (channel.readyState === 'open') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('接続タイムアウト')), timeoutMs);
    channel.onopen = () => { clearTimeout(to); resolve(); };
    channel.onerror = () => { clearTimeout(to); reject(new Error('接続エラー')); };
  });
}
