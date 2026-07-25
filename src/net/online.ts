// オンライン接続のオーケストレータ。
// マッチング(create/join/quick) → WebRTC シグナリング → DataChannel 確立 まで面倒を見て、
// ロックステップ用の { transport, localSide, seed } を返す。
import type { Side } from '../core/types';
import { SignalClient } from './signal-client';
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
  const sig = new SignalClient();

  onStatus('マッチング中…');
  const m = kind === 'create' ? await sig.create()
    : kind === 'join' ? await sig.join(code ?? '')
      : await sig.quickMatch();
  if (!m.ok || !m.roomId) throw new Error(m.error ?? 'マッチングに失敗しました');
  const isHost = m.role === 'host';
  onRoom?.(m.roomId);
  onStatus(isHost ? `相手を待っています…（ルーム ${m.roomId}）` : '接続中…');

  const pc = createPeer();
  let seed = isHost ? makeSeed() : 0;
  let alive = true;
  pc.onconnectionstatechange = () => {
    if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) alive = false;
  };

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
    const ch = pc.createDataChannel('game', { ordered: true });
    resolveCh(ch);
  } else {
    pc.ondatachannel = (e) => resolveCh(e.channel);
  }

  // シグナル受信（オファー/アンサーは各1回だけ処理する）
  let offerSent = false;
  let answered = false;
  sig.listen(async (s) => {
    try {
      if (s.kind === 'peer-joined' && isHost && !offerSent) {
        // guest 到着 → オファー生成（seed を同送）
        offerSent = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        sig.send({ kind: 'offer', sdp: offer.sdp, seed });
      } else if (s.kind === 'offer' && !isHost && !answered) {
        answered = true;
        seed = (s.seed as number) ?? seed;
        await pc.setRemoteDescription({ type: 'offer', sdp: s.sdp as string });
        remoteSet = true; await flushIce();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sig.send({ kind: 'answer', sdp: answer.sdp });
        onStatus('接続確立中…');
      } else if (s.kind === 'answer' && isHost && !remoteSet) {
        await pc.setRemoteDescription({ type: 'answer', sdp: s.sdp as string });
        remoteSet = true; await flushIce();
        onStatus('接続確立中…');
      } else if (s.kind === 'ice') {
        const cand = s.candidate as RTCIceCandidateInit;
        if (remoteSet) { try { await pc.addIceCandidate(cand); } catch { /* ignore */ } }
        else pendingIce.push(cand);
      } else if (s.kind === 'peer-left') {
        // 接続前に相手が抜けた場合は待機継続（UI 側で扱う）
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
  // 接続確立後はシグナリングを閉じてよい（以後は P2P）
  sig.close();

  return {
    transport: channelTransport(channel, pc),
    localSide: (isHost ? 0 : 1) as Side,
    seed,
    roomId: m.roomId,
    alive: () => alive,
    close: () => { sig.close(); try { pc.close(); } catch { /* noop */ } },
  };
}
