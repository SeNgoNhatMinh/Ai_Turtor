import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mic, MicOff } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import AiAnswer from '../../components/AiAnswer';
import AnswerEvidence from '../student/chat/components/AnswerEvidence';
import { liveLessonApi } from '../../services/liveLessonApi';
import { getUserFacingError } from '../../services/httpClient';
import { youtubeWatchUrl } from '../../utils/youtubeVideo';
import { useRealtimeEvent } from '../realtime/realtimeContext';
import { formatLessonTime, STATUS_LABEL, waitingCopy } from './liveLessonUtils';
import { followPlaybackSeconds, mergePlaybackSnapshot, playbackSnapshotFromLesson } from './playbackClock';
import LiveSyncedPlayer from './LiveSyncedPlayer';
import { useLiveLessonVoice } from './useLiveLessonVoice';
import './live-lesson.css';

const POLL_MS = 4000;

export default function LiveClassroomPage({
  currentUser,
  role = 'student',
  triggerToast,
}) {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const [lesson, setLesson] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [tab, setTab] = useState('class');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [aiTurns, setAiTurns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [asking, setAsking] = useState(false);
  const isTeacher = role === 'teacher';
  const displayName = currentUser?.fullName || currentUser?.name || currentUser?.email || '';
  const playbackActive = Boolean(lesson?.playbackActive);
  const voice = useLiveLessonVoice({
    lessonId,
    currentUser,
    enabled: Boolean(lessonId && lesson && lesson.status !== 'ENDED'),
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

  useRealtimeEvent(['LIVE_LESSON_PLAYBACK', 'LIVE_LESSON_STARTED'], (event) => {
    if (String(event.entityId) !== String(lessonId)) return;
    const paused = event.data?.paused ?? event.data?.playbackPaused;
    const position = event.data?.positionSeconds;
    setLesson((current) => {
      if (!current) return current;
      return {
        ...current,
        playbackActive: current.playbackActive || event.type === 'LIVE_LESSON_STARTED',
        status: event.type === 'LIVE_LESSON_STARTED' ? 'LIVE' : current.status,
        playbackPaused: paused == null ? current.playbackPaused : Boolean(paused),
        playbackElapsedSeconds: position == null ? current.playbackElapsedSeconds : Number(position),
      };
    });
    if (position != null || paused != null) {
      setSnapshot((current) => {
        const next = {
          playbackActive: true,
          paused: Boolean(paused),
          positionSeconds: Number(position) || 0,
          capturedAtMs: Date.now(),
        };
        if (!current) return next;
        const pauseChanged = Boolean(current.paused) !== next.paused;
        const jumped = Math.abs(followPlaybackSeconds(current) - next.positionSeconds) > 2.5;
        return pauseChanged || jumped ? next : current;
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
      const response = await liveLessonApi.askAi(lessonId, question, timestamp.trim());
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
    if (!isTeacher) return;
    try {
      const next = await liveLessonApi.syncPlayback(lessonId, { paused, positionSeconds });
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
  const speakingNames = voice.speaking.map((peer) => peer.displayName || peer.userId);

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
            <div className="live-voice-bar">
              <button
                type="button"
                className={`live-btn ${voice.muted ? 'secondary' : 'danger'}`}
                onClick={voice.toggleMic}
              >
                {voice.muted ? <MicOff size={16} /> : <Mic size={16} />}
                {voice.muted ? 'Bật mic' : 'Tắt mic'}
              </button>
              <p>
                {voice.connected
                  ? (speakingNames.length
                    ? `Đang nói: ${speakingNames.join(', ')}`
                    : 'Mic đang tắt. Bật mic để nói với lớp.')
                  : 'Đang nối mic lớp...'}
              </p>
            </div>
          )}
          <p className="live-hint">
            Video chạy theo giảng viên: phát, tạm dừng và tua thì cả lớp đi cùng một mốc.
            Sinh viên không tự bấm play. Mic chỉ truyền tiếng, không bật camera.
          </p>
        </section>

        <aside className="live-classroom-side">
          <div className="live-classroom-tabs">
            <button type="button" className={tab === 'class' ? 'active' : ''} onClick={() => setTab('class')}>
              Chat lớp
            </button>
            <button type="button" className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>
              Hỏi AI
            </button>
          </div>

          {tab === 'class' ? (
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
          ) : (
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
                <div className="live-ai-form-row">
                  <label>
                    Mốc phút (tuỳ chọn)
                    <input
                      value={timestamp}
                      onChange={(event) => setTimestamp(event.target.value)}
                      placeholder="12:30"
                    />
                  </label>
                  <button className="live-btn" type="submit" disabled={asking || !aiQuestion.trim()}>
                    {asking ? 'Đang hỏi...' : 'Hỏi AI'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
