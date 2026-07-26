// オンライン接続のオーケストレータ。
// マッチング(create/join/quick) → WebRTC シグナリング → DataChannel 確立 まで面倒を見て、
// ロックステップ用の { transport, localSide, seed } を返す。
// シグナリングは常駐 Socket.IO サーバー（video-call と同型）。
import type { Side } from '../core/types';
import { SignalSocket } from './signal-socket';
import type { Transport } from './transport';
import { channelTransport, createPeer, waitOpen } from './webrtc';

export type MatchKind = 'quick' | 'create' | 'join';

export interface OnlineHandle {
  transport: Transport;
  localSide: Side;
  seed: number;
  roomId: string;
  /** 接続が生きているか（切断検知）。 */
  alive(): boolean;
  close(): void;
}

interface Sig { kind: string; sdp?: string; candidate?: unknown; seed?: number }

const makeSeed = (): number => ((Date.now() & 0xffffff) ^ (Math.floor(Math.random() * 0xffffffff))) | 1;

/**
 * オンライン対戦の接続を確立する。
 * @param onStatus 進捗テキスト（UI 表示用）
 * @param onRoom   ルームコード確定時（ルーム作成の共有用）
 */
export async function connectOnline(
  kind: MatchKind,
  code: string | undefined,
  onStatus: (s: string) => void,
  onRoom?: (roomId: string) => void,
): Promise<OnlineHandle> {
  const sig = new SignalSocket();

  onStatus('マッチング中…');
  const m = await sig.matchmake(kind, code);
  if (!m.ok || !m.roomId) { sig.close(); throw new Error(m.error ?? 'マッチングに失敗しました'); }
  const isHost = m.role === 'host';
  onRoom?.(m.roomId);
  onStatus(isHost ? `相手を待っています…（ルーム ${m.roomId}）` : '接続中…');

  const pc = createPeer();
  let seed = isHost ? makeSeed() : 0;

  // 切断検知: 一時的な 'disconnected' は猶予（自動復帰を待つ）。'failed'/'closed' で終了。
  let alive = true;
  let discTimer: ReturnType<typeof setTimeout> | null = null;
  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    if (s === 'failed' || s === 'closed') { alive = false; }
    else if (s === 'disconnected') {
      if (!discTimer) discTimer = setTimeout(() => { if (pc.connectionState !== 'connected') alive = false; }, 8000);
    } else if (s === 'connected') {
      if (discTimer) { clearTimeout(discTimer); discTimer = null; }
      alive = true;
    }
  };
  // 相手がルームから抜けた（タブを閉じた等）
  sig.onPeerLeft(() => { alive = false; });

  // ICE 候補は相手へ送る。remoteDescription 前に来た候補はバッファ。
  let remoteSet = false;
  const pendingIce: RTCIceCandidateInit[] = [];
  pc.onicecandidate = (e) => { if (e.candidate) sig.send({ kind: 'ice', candidate: e.candidate.toJSON() }); };
  const flushIce = async (): Promise<void> => {
    for (const c of pendingIce.splice(0)) { try { await pc.addIceCandidate(c); } catch { /* ignore */ } }
  };

  // DataChannel（host が作成 / guest は受信）
  let resolveCh!: (ch: RTCDataChannel) => void;
  const channelReady = new Promise<RTCDataChannel>((res) => { resolveCh = res; });
  if (isHost) {
    resolveCh(pc.createDataChannel('game', { ordered: true }));
  } else {
    pc.ondatachannel = (e) => resolveCh(e.channel);
  }

  // host: 相手入室で offer 生成（seed 同送）
  let offerSent = false;
  const makeOffer = async (): Promise<void> => {
    if (offerSent) return; offerSent = true;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sig.send({ kind: 'offer', sdp: offer.sdp, seed });
  };
  if (isHost) sig.onPeerJoined(() => { void makeOffer(); });

  // シグナル受信
  let answered = false;
  sig.onSignal(async (raw) => {
    const s = raw as Sig;
    try {
      if (s.kind === 'offer' && !isHost && !answered) {
        answered = true;
        seed = (s.seed as number) ?? seed;
        await pc.setRemoteDescription({ type: 'offer', sdp: s.sdp });
        remoteSet = true; await flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sig.send({ kind: 'answer', sdp: answer.sdp });
        onStatus('接続確立中…');
      } else if (s.kind === 'answer' && isHost && !remoteSet) {
        await pc.setRemoteDescription({ type: 'answer', sdp: s.sdp });
        remoteSet = true; await flushIce();
        onStatus('接続確立中…');
      } else if (s.kind === 'ice') {
        const cand = s.candidate as RTCIceCandidateInit;
        if (remoteSet) { try { await pc.addIceCandidate(cand); } catch { /* ignore */ } }
        else pendingIce.push(cand);
      }
    } catch (err) {
      console.error('signal handling error', err);
    }
  });

  const channel = await channelReady;
  channel.onclose = () => { alive = false; };
  // 相手が参加してコードを共有する時間を見込んで長め（Esc で中止可）
  await waitOpen(channel, 120_000);
  onStatus('接続完了');
  // 接続後もシグナリングは開いたまま（peer-left 検知用）。close で切る。

  return {
    transport: channelTransport(channel, pc),
    localSide: (isHost ? 0 : 1) as Side,
    seed,
    roomId: m.roomId,
    alive: () => alive,
    close: () => { if (discTimer) clearTimeout(discTimer); sig.close(); try { pc.close(); } catch { /* noop */ } },
  };
}
