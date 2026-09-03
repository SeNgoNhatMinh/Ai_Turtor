import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuthToken } from '../auth/services/tokenStorage';
import { env } from '../../config/env';
import { buildRealtimeSocketUrl } from '../realtime/realtimeEvents';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

function buildVoiceUrl({ token, lessonId, displayName }) {
  const url = new URL(buildRealtimeSocketUrl({
    apiBaseUrl: env.apiBaseUrl,
    token,
  }));
  url.pathname = url.pathname.replace(/\/ws\/events$/, '/ws/live-voice');
  url.searchParams.set('lessonId', lessonId);
  if (displayName) url.searchParams.set('displayName', displayName);
  return url.toString();
}

export function useLiveLessonVoice({ lessonId, currentUser, enabled, triggerToast }) {
  const userId = currentUser?.userId || currentUser?.id || '';
  const displayName = currentUser?.fullName || currentUser?.name || currentUser?.email || userId;
  const [muted, setMuted] = useState(true);
  const [peers, setPeers] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const peersRef = useRef(new Map());
  const streamRef = useRef(null);
  const mutedRef = useRef(true);
  const userIdRef = useRef(userId);

  mutedRef.current = muted;
  userIdRef.current = userId;

  const send = useCallback((payload) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }, []);

  const closePeer = useCallback((peerId) => {
    const entry = peersRef.current.get(peerId);
    if (!entry) return;
    try {
      entry.pc.close();
    } catch {
      // Already closed.
    }
    entry.audio?.remove();
    peersRef.current.delete(peerId);
  }, []);

  const attachStream = useCallback((pc) => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((track) => {
      const existing = pc.getSenders().find((sender) => sender.track?.kind === track.kind);
      if (existing) existing.replaceTrack(track);
      else pc.addTrack(track, stream);
    });
  }, []);

  const ensurePeer = useCallback((peerId) => {
    if (!peerId || peerId === userIdRef.current) return null;
    const existing = peersRef.current.get(peerId);
    if (existing) return existing.pc;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.setAttribute('playsinline', 'true');
    document.body.appendChild(audio);
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        send({ type: 'ICE', toUserId: peerId, candidate: event.candidate });
      }
    };
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) audio.srcObject = stream;
    };
    attachStream(pc);
    peersRef.current.set(peerId, { pc, audio });
    return pc;
  }, [attachStream, send]);

  const offerTo = useCallback(async (peerId) => {
    const pc = ensurePeer(peerId);
    if (!pc || pc.signalingState !== 'stable') return;
    const offer = await pc.createOffer({ offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);
    send({ type: 'OFFER', toUserId: peerId, sdp: offer.sdp });
  }, [ensurePeer, send]);

  useEffect(() => {
    if (!enabled || !lessonId || !userId) return undefined;
    const token = getAuthToken();
    if (!token || typeof WebSocket === 'undefined') return undefined;
    let disposed = false;
    const socket = new WebSocket(buildVoiceUrl({ token, lessonId, displayName }));
    socketRef.current = socket;

    socket.onopen = () => {
      if (!disposed) setConnected(true);
    };
    socket.onclose = () => {
      if (!disposed) setConnected(false);
    };
    socket.onmessage = async ({ data }) => {
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        return;
      }
      const type = String(event.type || '').toUpperCase();
      if (type === 'CONNECTED') {
        const list = Array.isArray(event.peers) ? event.peers : [];
        setPeers(list);
        for (const peer of list) {
          if (String(userIdRef.current) < String(peer.userId)) {
            offerTo(peer.userId).catch(() => {});
          } else {
            ensurePeer(peer.userId);
          }
        }
        return;
      }
      if (type === 'PEER_JOINED' && event.peer?.userId) {
        setPeers((current) => {
          if (current.some((item) => item.userId === event.peer.userId)) return current;
          return [...current, event.peer];
        });
        if (String(userIdRef.current) < String(event.peer.userId)) {
          offerTo(event.peer.userId).catch(() => {});
        } else {
          ensurePeer(event.peer.userId);
        }
        return;
      }
      if (type === 'PEER_LEFT') {
        closePeer(event.userId);
        setPeers((current) => current.filter((item) => item.userId !== event.userId));
        return;
      }
      if (type === 'PEER_MUTED') {
        setPeers((current) => current.map((item) => (
          item.userId === event.userId ? { ...item, muted: event.muted } : item
        )));
        return;
      }
      if (type === 'OFFER' && event.fromUserId && event.sdp) {
        const pc = ensurePeer(event.fromUserId);
        if (!pc) return;
        try {
          await pc.setRemoteDescription({ type: 'offer', sdp: event.sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send({ type: 'ANSWER', toUserId: event.fromUserId, sdp: answer.sdp });
        } catch {
          // Ignore glare while two peers offer at once.
        }
        return;
      }
      if (type === 'ANSWER' && event.fromUserId && event.sdp) {
        const pc = ensurePeer(event.fromUserId);
        if (!pc) return;
        try {
          await pc.setRemoteDescription({ type: 'answer', sdp: event.sdp });
        } catch {
          // Ignore a late answer after hangup.
        }
        return;
      }
      if (type === 'ICE' && event.fromUserId && event.candidate) {
        const pc = ensurePeer(event.fromUserId);
        try {
          await pc?.addIceCandidate(event.candidate);
        } catch {
          // Ignore late ICE after hangup.
        }
      }
    };

    return () => {
      disposed = true;
      socket.close();
      socketRef.current = null;
      peersRef.current.forEach((_, peerId) => closePeer(peerId));
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setConnected(false);
      setPeers([]);
    };
  }, [closePeer, displayName, enabled, ensurePeer, lessonId, offerTo, userId]);

  const toggleMic = async () => {
    if (muted) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        streamRef.current = stream;
        peersRef.current.forEach(({ pc }, peerId) => {
          attachStream(pc);
          offerTo(peerId).catch(() => {});
        });
        setMuted(false);
        send({ type: 'MUTE', muted: false });
      } catch {
        triggerToast?.('Không bật được mic. Hãy cho phép microphone trong trình duyệt.');
      }
      return;
    }
    streamRef.current?.getTracks().forEach((track) => {
      track.enabled = false;
      track.stop();
    });
    streamRef.current = null;
    setMuted(true);
    send({ type: 'MUTE', muted: true });
  };

  const speaking = peers.filter((peer) => peer.muted === false);

  return {
    muted,
    connected,
    speaking,
    toggleMic,
  };
}
