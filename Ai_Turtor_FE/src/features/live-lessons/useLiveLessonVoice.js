import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuthToken } from '../auth/services/tokenStorage';
import { env } from '../../config/env';
import { getPersonDisplayName } from '../../utils/displayNames';
import { buildRealtimeSocketUrl } from '../realtime/realtimeEvents';

const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const PING_MS = 20000;

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

function icePayload(candidate) {
  if (!candidate) return null;
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
  };
}

function upsertPeer(list, peer) {
  if (!peer?.userId) return list;
  if (list.some((item) => item.userId === peer.userId)) {
    return list.map((item) => (item.userId === peer.userId ? { ...item, ...peer } : item));
  }
  return [...list, peer];
}

export function useLiveLessonVoice({ lessonId, currentUser, enabled, isTeacher = false, triggerToast }) {
  const fallbackUserId = currentUser?.userId || currentUser?.id || '';
  const displayName = getPersonDisplayName(currentUser, fallbackUserId);
  const [muted, setMuted] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [canSpeak, setCanSpeak] = useState(Boolean(isTeacher));
  const [peers, setPeers] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const peersRef = useRef(new Map());
  const pendingIceRef = useRef(new Map());
  const streamRef = useRef(null);
  const selfIdRef = useRef(fallbackUserId);
  const isTeacherRef = useRef(isTeacher);
  isTeacherRef.current = isTeacher;

  const send = useCallback((payload) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }, []);

  const playRemote = useCallback(() => {
    peersRef.current.forEach(({ audio }) => {
      try {
        audio.muted = false;
        audio.volume = 1;
        const played = audio.play();
        if (played?.catch) played.catch(() => {});
      } catch {
        // Autoplay can still fail until the next click.
      }
    });
  }, []);

  const applyForceMute = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      track.enabled = false;
      track.stop();
    });
    streamRef.current = null;
    peersRef.current.forEach(({ pc }) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === 'audio') sender.replaceTrack(null).catch(() => {});
      });
    });
    setMuted(true);
    setCanSpeak(false);
    setHandRaised(false);
  }, []);

  const flushIce = useCallback(async (peerId) => {
    const entry = peersRef.current.get(peerId);
    const queued = pendingIceRef.current.get(peerId) || [];
    pendingIceRef.current.delete(peerId);
    if (!entry?.pc?.remoteDescription) return;
    for (const candidate of queued) {
      try {
        await entry.pc.addIceCandidate(candidate);
      } catch {
        // Candidate may belong to a previous offer.
      }
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
    pendingIceRef.current.delete(peerId);
  }, []);

  const attachStream = useCallback((pc) => {
    const stream = streamRef.current;
    if (!stream || !pc) return;
    stream.getAudioTracks().forEach((track) => {
      const sender = pc.getSenders().find((item) => !item.track || item.track.kind === 'audio');
      if (sender) sender.replaceTrack(track);
      else pc.addTrack(track, stream);
    });
  }, []);

  const offerTo = useCallback(async (peerId) => {
    const entry = peersRef.current.get(peerId);
    const pc = entry?.pc;
    if (!pc || pc.signalingState !== 'stable') return;
    entry.makingOffer = true;
    try {
      const offer = await pc.createOffer();
      if (pc.signalingState !== 'stable') return;
      await pc.setLocalDescription(offer);
      send({ type: 'OFFER', toUserId: peerId, sdp: pc.localDescription.sdp });
    } catch {
      // Glare while two peers offer at once.
    } finally {
      entry.makingOffer = false;
    }
  }, [send]);

  const ensurePeer = useCallback((peerId) => {
    if (!peerId || peerId === selfIdRef.current) return null;
    const existing = peersRef.current.get(peerId);
    if (existing) return existing.pc;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.addTransceiver('audio', { direction: 'sendrecv' });
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.playsInline = true;
    audio.muted = false;
    audio.volume = 1;
    document.body.appendChild(audio);
    const entry = { pc, audio, makingOffer: false, polite: String(selfIdRef.current) > String(peerId) };
    pc.onicecandidate = (event) => {
      const candidate = icePayload(event.candidate);
      if (candidate?.candidate) {
        send({ type: 'ICE', toUserId: peerId, candidate });
      }
    };
    pc.ontrack = (event) => {
      const stream = event.streams?.[0] || new MediaStream([event.track]);
      audio.srcObject = stream;
      audio.muted = false;
      audio.volume = 1;
      const played = audio.play();
      if (played?.catch) played.catch(() => {});
    };
    pc.onnegotiationneeded = () => {
      offerTo(peerId).catch(() => {});
    };
    attachStream(pc);
    peersRef.current.set(peerId, entry);
    return pc;
  }, [attachStream, offerTo, send]);

  useEffect(() => {
    if (!enabled || !lessonId || !fallbackUserId) return undefined;
    const token = getAuthToken();
    if (!token || typeof WebSocket === 'undefined') return undefined;
    let disposed = false;
    let pingTimer;
    const socket = new WebSocket(buildVoiceUrl({ token, lessonId, displayName }));
    socketRef.current = socket;

    socket.onopen = () => {
      if (disposed) return;
      setConnected(true);
      pingTimer = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'PING' }));
        }
      }, PING_MS);
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
      if (type === 'ERROR') {
        triggerToast?.(event.message || 'Không thực hiện được lệnh mic.');
        return;
      }
      if (type === 'CONNECTED') {
        if (event.userId) selfIdRef.current = String(event.userId);
        setCanSpeak(Boolean(event.canSpeak) || isTeacherRef.current);
        const list = Array.isArray(event.peers) ? event.peers : [];
        setPeers(list);
        setParticipants(Array.isArray(event.participants) ? event.participants : list);
        for (const peer of list) {
          ensurePeer(peer.userId);
        }
        return;
      }
      if (type === 'PEER_JOINED' && event.peer?.userId) {
        setPeers((current) => upsertPeer(current, event.peer));
        setParticipants((current) => upsertPeer(current, event.peer));
        ensurePeer(event.peer.userId);
        return;
      }
      if (type === 'PEER_UPDATED' && event.peer?.userId) {
        setPeers((current) => upsertPeer(current, event.peer));
        setParticipants((current) => upsertPeer(current, event.peer));
        if (String(event.peer.userId) === String(selfIdRef.current)) {
          setHandRaised(Boolean(event.peer.handRaised));
          setCanSpeak(Boolean(event.peer.canSpeak) || isTeacherRef.current);
          if (event.peer.muted !== false) {
            if (streamRef.current) {
              streamRef.current.getTracks().forEach((track) => {
                track.enabled = false;
                track.stop();
              });
              streamRef.current = null;
              peersRef.current.forEach(({ pc }) => {
                pc.getSenders().forEach((sender) => {
                  if (sender.track?.kind === 'audio') sender.replaceTrack(null).catch(() => {});
                });
              });
            }
            setMuted(true);
          }
        }
        return;
      }
      if (type === 'MUTE_ALL') {
        if (!isTeacherRef.current) applyForceMute();
        if (Array.isArray(event.participants)) setParticipants(event.participants);
        return;
      }
      if (type === 'FORCE_MUTE') {
        applyForceMute();
        return;
      }
      if (type === 'SPEAK_ALLOWED') {
        setCanSpeak(true);
        setHandRaised(false);
        triggerToast?.('Giảng viên cho phép bạn nói. Hãy bấm Bật mic.');
        return;
      }
      if (type === 'PEER_LEFT') {
        closePeer(event.userId);
        setPeers((current) => current.filter((item) => item.userId !== event.userId));
        setParticipants((current) => current.filter((item) => item.userId !== event.userId));
        return;
      }
      if (type === 'OFFER' && event.fromUserId && event.sdp) {
        const pc = ensurePeer(event.fromUserId);
        const entry = peersRef.current.get(event.fromUserId);
        if (!pc || !entry) return;
        const collision = entry.makingOffer || pc.signalingState !== 'stable';
        if (collision) {
          if (!entry.polite) return;
          try {
            await pc.setLocalDescription({ type: 'rollback' });
          } catch {
            return;
          }
        }
        try {
          await pc.setRemoteDescription({ type: 'offer', sdp: event.sdp });
          await flushIce(event.fromUserId);
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
        try {
          await pc?.setRemoteDescription({ type: 'answer', sdp: event.sdp });
          await flushIce(event.fromUserId);
        } catch {
          // Ignore a late answer after hangup.
        }
        return;
      }
      if (type === 'ICE' && event.fromUserId && event.candidate) {
        ensurePeer(event.fromUserId);
        const pc = peersRef.current.get(event.fromUserId)?.pc;
        if (!pc?.remoteDescription) {
          const queued = pendingIceRef.current.get(event.fromUserId) || [];
          queued.push(event.candidate);
          pendingIceRef.current.set(event.fromUserId, queued);
          return;
        }
        try {
          await pc.addIceCandidate(event.candidate);
        } catch {
          // Ignore late ICE after hangup.
        }
      }
    };

    return () => {
      disposed = true;
      window.clearInterval(pingTimer);
      socket.close();
      socketRef.current = null;
      peersRef.current.forEach((_, peerId) => closePeer(peerId));
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setConnected(false);
      setPeers([]);
      setParticipants([]);
    };
  }, [applyForceMute, closePeer, displayName, enabled, ensurePeer, fallbackUserId, flushIce, lessonId, send, triggerToast]);

  const toggleMic = async () => {
    playRemote();
    if (muted) {
      if (!isTeacher && !canSpeak) {
        triggerToast?.('Hãy giơ tay. Giảng viên sẽ bật mic khi đến lượt bạn.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false,
        });
        streamRef.current = stream;
        peersRef.current.forEach(({ pc }, peerId) => {
          attachStream(pc);
          offerTo(peerId).catch(() => {});
        });
        playRemote();
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
    peersRef.current.forEach(({ pc }) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track?.kind === 'audio') sender.replaceTrack(null).catch(() => {});
      });
    });
    setMuted(true);
    send({ type: 'MUTE', muted: true });
  };

  const raiseHand = () => {
    playRemote();
    setHandRaised(true);
    send({ type: 'RAISE_HAND' });
  };

  const lowerHand = () => {
    setHandRaised(false);
    send({ type: 'LOWER_HAND' });
  };

  const muteAll = () => send({ type: 'MUTE_ALL' });
  const allowSpeak = (userId) => send({ type: 'ALLOW_SPEAK', toUserId: userId });
  const muteUser = (userId) => send({ type: 'MUTE_USER', toUserId: userId });

  const speaking = participants.filter((peer) => peer.muted === false);

  return {
    muted,
    handRaised,
    canSpeak,
    connected,
    speaking,
    participants,
    toggleMic,
    raiseHand,
    lowerHand,
    muteAll,
    allowSpeak,
    muteUser,
    playRemote,
  };
}
