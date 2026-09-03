import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Hand, Mic, MicOff } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import AiAnswer from '../../components/AiAnswer';
import AnswerEvidence from '../student/chat/components/AnswerEvidence';
import { getPersonDisplayName } from '../../utils/displayNames';
import { liveLessonApi } from '../../services/liveLessonApi';
import { getUserFacingError } from '../../services/httpClient';
import { youtubeWatchUrl } from '../../utils/youtubeVideo';
import { useRealtimeEvent } from '../realtime/realtimeContext';
import { formatLessonTime, STATUS_LABEL, waitingCopy } from './liveLessonUtils';
import { followPlaybackSeconds, mergePlaybackSnapshot, playbackSnapshotFromLesson, snapshotClockMs } from './playbackClock';
import LiveSyncedPlayer from './LiveSyncedPlayer';
import { useLiveLessonVoice } from './useLiveLessonVoice';
import './live-lesson.css';

const POLL_MS = 4000;

function isStaffRole(role) {
  const value = String(role || '').toUpperCase();
  return value === 'TEACHER' || value === 'ADMIN' || value === 'SENIOR_MENTOR';
}

function rosterName(person) {
  return getPersonDisplayName(person, isStaffRole(person?.role) ? 'Giảng viên' : 'Sinh viên');
}

function personStatus(person) {
  if (isStaffRole(person.role)) return 'Giảng viên';
  if (person.muted === false) return 'Đang nói';
  if (person.handRaised) return 'Đang giơ tay';
  if (person.canSpeak) return 'Được phép nói';
  return 'Mic tắt';
}

function sortRoster(people) {
  return [...people].sort((left, right) => {
    const rank = (person) => {
      if (person.handRaised) return 0;
      if (person.muted === false) return 1;
      if (person.canSpeak) return 2;
      if (isStaffRole(person.role)) return 3;
      return 4;
    };
    return rank(left) - rank(right)
      || String(rosterName(left)).localeCompare(String(rosterName(right)));
  });
}

function voiceHelpText({ connected, isTeacher, canSpeak, muted, handRaised, speakingNames }) {
  if (!connected) return 'Đang nối mic lớp...';
  const speaking = speakingNames.length ? `Đang nói: ${speakingNames.join(', ')}. ` : '';
  if (isTeacher) {
    return `${speaking}${muted ? 'Bật mic để giảng. Quản lý sinh viên ở tab Người tham gia.' : 'Mic của bạn đang bật.'}`;
  }
  if (!canSpeak) {
    return `${speaking}${handRaised ? 'Đã giơ tay. Chờ giảng viên cho phép nói.' : 'Giơ tay để xin nói. Giảng viên sẽ bật mic khi đến lượt bạn.'}`;
  }
  return `${speaking}${muted ? 'Giảng viên đã cho phép. Bấm Bật mic để nói.' : 'Bạn đang nói.'}`;
}

export default function LiveClassroomPage({
  currentUser,
  role = 'student',
  triggerToast,
}) {
  const { lessonId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const isTeacher = role === 'teacher' || String(location.pathname || '').includes('/teacher/live-lessons/');
  const [lesson, setLesson] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [tab, setTab] = useState(isTeacher ? 'people' : 'class');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiTurns, setAiTurns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [asking, setAsking] = useState(false);
  const displayName = getPersonDisplayName(currentUser, currentUser?.email || '');
  const playbackActive = Boolean(lesson?.playbackActive);
  const liveRef = useRef(false);
  liveRef.current = playbackActive && lesson?.status !== 'ENDED';
  const voice = useLiveLessonVoice({
    lessonId,
    currentUser,
    enabled: Boolean(lessonId && lesson && lesson.status !== 'ENDED'),
    isTeacher,
    triggerToast,
  });

  const applyLesson = (next) => {
    setLesson(next);
    setSnapshot((current) => mergePlaybackSnapshot(current, next));
  };

  const loadLesson = async () => {
    const next = await liveLessonApi.get(lessonId);
    applyLesson(next);
    return next;
  };

  const loadChat = async () => {
    const next = await liveLessonApi.listChat(lessonId);
    setMessages(Array.isArray(next) ? next : []);
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setLoading(true);
        await loadLesson();
        await loadChat();
      } catch (error) {
        if (!cancelled) triggerToast?.(getUserFacingError(error), 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    boot();
    const timer = window.setInterval(() => {
      loadChat().catch(() => {});
      loadLesson().catch(() => {});
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [lessonId]);

  useRealtimeEvent(['LIVE_LESSON_PLAYBACK', 'LIVE_LESSON_STARTED', 'LIVE_LESSON_ENDED'], (event) => {
    if (String(event.entityId) !== String(lessonId)) return;
    if (event.type === 'LIVE_LESSON_ENDED') {
      setLesson((current) => (current ? {
        ...current,
        status: 'ENDED',
        playbackActive: false,
        playbackPaused: true,
      } : current));
      setSnapshot((current) => (current ? {
        ...current,
        playbackActive: false,
        paused: true,
      } : current));
      return;
    }
    const paused = event.data?.paused ?? event.data?.playbackPaused;
    const position = event.data?.positionSeconds;
    const eventClock = snapshotClockMs(event.data, Date.now());
    setLesson((current) => {
      if (!current) return current;
      return {
        ...current,
        playbackActive: current.playbackActive || event.type === 'LIVE_LESSON_STARTED',
        status: event.type === 'LIVE_LESSON_STARTED' ? 'LIVE' : current.status,
        playbackPaused: paused == null ? current.playbackPaused : Boolean(paused),
        playbackElapsedSeconds: position == null ? current.playbackElapsedSeconds : Number(position),
        playbackClockEpochMs: event.data?.playbackClockEpochMs ?? current.playbackClockEpochMs,
      };
    });
    if (position != null || paused != null) {
      setSnapshot((current) => {
        const next = {
          playbackActive: true,
          paused: Boolean(paused),
          positionSeconds: Number(position) || 0,
          capturedAtMs: Date.now(),
          clockAtMs: eventClock,
        };
        if (!current) return next;
        if (current.clockAtMs && next.clockAtMs + 1500 < current.clockAtMs && !next.paused) return current;
        if (Boolean(current.paused) !== next.paused) return next;
        const jumped = Math.abs(followPlaybackSeconds(current) - next.positionSeconds) > 2.5;
        return jumped ? next : current;
      });
    } else {
      loadLesson().catch(() => {});
    }
  });

  const goBack = () => {
    navigate(isTeacher ? '/teacher/live-lessons' : '/student/live-lessons');
  };

  const sendClassChat = async (event) => {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await liveLessonApi.sendChat(lessonId, draft.trim(), displayName);
      setDraft('');
      await loadChat();
    } catch (error) {
      triggerToast?.(getUserFacingError(error), 'error');
    } finally {
      setSending(false);
    }
  };

  const shareReplayLink = async () => {
    const url = youtubeWatchUrl(lesson?.youtubeUrl || lesson?.youtubeVideoId);
    if (!url) return;
    try {
      await liveLessonApi.sendChat(
        lessonId,
        `Xem lại bài giảng trên YouTube (mở ngoài lớp live): ${url}`,
        displayName,
      );
      await loadChat();
      triggerToast?.('Đã gửi link xem lại vào chat lớp.', 'success');
    } catch (error) {
      triggerToast?.(getUserFacingError(error), 'error');
    }
  };

  const askAi = async (event) => {
    event.preventDefault();
    if (!aiQuestion.trim() || asking) return;
    const question = aiQuestion.trim();
    setAsking(true);
    try {
      const response = await liveLessonApi.askAi(lessonId, question);
      setAiTurns((current) => [...current, { question, response }]);
      setAiQuestion('');
    } catch (error) {
      triggerToast?.(getUserFacingError(error), 'error');
    } finally {
      setAsking(false);
    }
  };

  const changeStatus = async (action) => {
    try {
      const next = action === 'start'
        ? await liveLessonApi.startPlayback(lessonId)
        : await liveLessonApi.end(lessonId);
      setLesson(next);
      setSnapshot(playbackSnapshotFromLesson(next));
    } catch (error) {
      triggerToast?.(getUserFacingError(error), 'error');
    }
  };

  const syncPlayback = async ({ paused, positionSeconds }) => {
    if (!isTeacher || !liveRef.current) return;
    const nextPaused = Boolean(paused);
    const seconds = Math.max(0, Number(positionSeconds) || 0);
    const capturedAtMs = Date.now();
    setLesson((current) => (current ? {
      ...current,
      playbackPaused: nextPaused,
      playbackElapsedSeconds: seconds,
      playbackClockEpochMs: capturedAtMs,
    } : current));
    setSnapshot({
      playbackActive: true,
      paused: nextPaused,
      positionSeconds: seconds,
      capturedAtMs,
      clockAtMs: capturedAtMs,
    });
    try {
      const next = await liveLessonApi.syncPlayback(lessonId, { paused: nextPaused, positionSeconds: seconds });
      setLesson(next);
      setSnapshot(playbackSnapshotFromLesson(next));
    } catch (error) {
      triggerToast?.(getUserFacingError(error), 'error');
    }
  };

  if (loading && !lesson) {
    return <p>Đang mở phòng học...</p>;
  }

  if (!lesson) {
    return <p>Không tìm thấy buổi live này.</p>;
  }

  const canStudentChat = lesson.status !== 'ENDED';
  const selfUserId = String(currentUser?.userId || currentUser?.id || '');
  const speakingNames = voice.speaking.map((peer) => rosterName(peer));
  const roster = sortRoster(voice.participants);

  return (
    <div className="portal-section live-classroom">
      <PageHeader
        eyebrow={lesson.courseId}
        title={lesson.topic}
        description={`${lesson.className || lesson.classId} · ${formatLessonTime(lesson.startsAt)} · ${STATUS_LABEL[lesson.status] || lesson.status}`}
        actions={(
          <div className="live-lesson-actions">
            <button type="button" className="live-btn ghost" onClick={goBack}>Danh sách</button>
            {isTeacher && !playbackActive && lesson.status !== 'ENDED' && (
              <button type="button" className="live-btn" onClick={() => changeStatus('start')}>Bắt đầu video</button>
            )}
            {isTeacher && playbackActive && (
              <button type="button" className="live-btn danger" onClick={() => changeStatus('end')}>Kết thúc</button>
            )}
            {isTeacher && (
              <button type="button" className="live-btn secondary" onClick={shareReplayLink}>Gửi link xem lại</button>
            )}
          </div>
        )}
      />

      <div className="live-classroom-layout">
        <section className="live-classroom-stage">
          <div className="live-classroom-player">
            {playbackActive ? (
              <LiveSyncedPlayer
                lesson={lesson}
                snapshot={snapshot}
                isTeacher={isTeacher}
                onControl={syncPlayback}
              />
            ) : (
              <div className="live-waiting">
                <div>
                  <strong>{lesson.status === 'ENDED' ? 'Buổi học đã kết thúc' : 'Chờ giảng viên bắt đầu'}</strong>
                  <p>{waitingCopy(lesson)}</p>
                </div>
              </div>
            )}
          </div>
          {lesson.status !== 'ENDED' && (
            <div className="live-voice-bar" onClick={voice.playRemote}>
              {!isTeacher && (
                <button type="button" className="live-btn ghost" onClick={voice.playRemote}>
                  Mở loa
                </button>
              )}
              {!isTeacher && !voice.canSpeak && (
                <button
                  type="button"
                  className={`live-btn ${voice.handRaised ? 'danger' : 'secondary'}`}
                  onClick={voice.handRaised ? voice.lowerHand : voice.raiseHand}
                >
                  <Hand size={16} />
                  {voice.handRaised ? 'Hạ tay' : 'Giơ tay'}
                </button>
              )}
              {(isTeacher || voice.canSpeak) && (
                <button
                  type="button"
                  className={`live-btn ${voice.muted ? 'secondary' : 'danger'}`}
                  onClick={voice.toggleMic}
                >
                  {voice.muted ? <MicOff size={16} /> : <Mic size={16} />}
                  {voice.muted ? 'Bật mic' : 'Tắt mic'}
                </button>
              )}
              <p>
                {voiceHelpText({
                  connected: voice.connected,
                  isTeacher,
                  canSpeak: voice.canSpeak,
                  muted: voice.muted,
                  handRaised: voice.handRaised,
                  speakingNames,
                })}
              </p>
            </div>
          )}
          <p className="live-hint">
            {isTeacher
              ? 'Video chỉ điều khiển bằng thanh Phát / Tạm dừng. Sinh viên xin nói bằng giơ tay; bạn cho phép từng người ở tab Người tham gia.'
              : 'Video do giảng viên điều khiển. Giơ tay để xin nói. Câu hỏi riêng gửi ở tab Hỏi AI, không cần mốc phút.'}
          </p>
        </section>

        <aside className="live-classroom-side">
          <div className="live-classroom-tabs">
            <button type="button" className={tab === 'class' ? 'active' : ''} onClick={() => setTab('class')}>
              Chat lớp
            </button>
            {isTeacher ? (
              <button type="button" className={tab === 'people' ? 'active' : ''} onClick={() => setTab('people')}>
                Người tham gia{roster.length ? ` (${roster.length})` : ''}
              </button>
            ) : (
              <button type="button" className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>
                Hỏi AI
              </button>
            )}
          </div>

          {tab === 'class' && (
            <>
              <div className="live-classroom-messages">
                {messages.length === 0 && <p>Chưa có tin nhắn. Hãy chào giảng viên và cả lớp.</p>}
                {messages.map((item) => (
                  <article key={item.id} className="live-chat-item">
                    <strong>
                      {item.senderName || item.senderId}
                      {item.senderRole === 'TEACHER' ? ' · GV' : ''}
                    </strong>
                    <span>{item.content}</span>
                  </article>
                ))}
              </div>
              {(isTeacher || canStudentChat) && (
                <form className="live-classroom-composer" onSubmit={sendClassChat}>
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={isTeacher ? 'Nhắn với lớp, hoặc gửi link xem lại...' : 'Nhắn với giảng viên và cả lớp...'}
                    maxLength={2000}
                  />
                  <button className="live-btn" type="submit" disabled={sending || !draft.trim()}>Gửi</button>
                </form>
              )}
            </>
          )}

          {tab === 'people' && isTeacher && (
            <div className="live-people-panel">
              <p className="live-ai-intro">
                Sinh viên giơ tay xin nói. Tắt mic cả lớp, rồi bật mic đúng người bạn cho phép.
              </p>
              <div className="live-people-toolbar">
                <button type="button" className="live-btn danger" onClick={voice.muteAll}>
                  Tắt mic tất cả
                </button>
              </div>
              <div className="live-people-list">
                {roster.length === 0 && <p className="live-empty">Chưa có ai vào phòng.</p>}
                {roster.map((person) => {
                  const mine = String(person.userId) === selfUserId;
                  const staff = isStaffRole(person.role);
                  return (
                    <article
                      key={person.userId}
                      className={`live-person${person.handRaised ? ' raised' : ''}${person.muted === false ? ' speaking' : ''}`}
                    >
                      <div>
                        <strong>
                          {rosterName(person)}
                          {mine ? ' · Bạn' : ''}
                          {staff ? ' · GV' : ''}
                        </strong>
                        <span>{personStatus(person)}</span>
                      </div>
                      {!staff && !mine && (
                        <div className="live-person-actions">
                          <button
                            type="button"
                            className="live-btn"
                            onClick={() => voice.allowSpeak(person.userId)}
                          >
                            Cho nói
                          </button>
                          <button
                            type="button"
                            className="live-btn secondary"
                            onClick={() => voice.muteUser(person.userId)}
                          >
                            Tắt mic
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'ai' && !isTeacher && (
            <div className="live-ai-panel">
              <p className="live-ai-intro">
                Câu hỏi này chỉ bạn thấy. AI giải thích từ tài liệu môn, không trừ quota chat 1-1.
              </p>
              <div className="live-ai-thread">
                {aiTurns.map((turn, index) => (
                  <article key={`${turn.question}-${index}`} className="live-ai-turn">
                    <strong>Bạn hỏi</strong>
                    <p>{turn.question}</p>
                    <AiAnswer markdown={turn.response?.answer} hideSourceSection />
                    <AnswerEvidence message={turn.response} />
                  </article>
                ))}
              </div>
              <form className="live-ai-form" onSubmit={askAi}>
                <label>
                  Đoạn bạn chưa hiểu
                  <textarea
                    value={aiQuestion}
                    onChange={(event) => setAiQuestion(event.target.value)}
                    placeholder="Ví dụ: phần kế thừa trong OOP thầy đang giảng..."
                    maxLength={4000}
                  />
                </label>
                <button className="live-btn" type="submit" disabled={asking || !aiQuestion.trim()}>
                  {asking ? 'Đang hỏi...' : 'Hỏi AI'}
                </button>
              </form>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
