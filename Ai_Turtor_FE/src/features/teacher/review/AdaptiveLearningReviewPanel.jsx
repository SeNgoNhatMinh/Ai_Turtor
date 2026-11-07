import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Checkbox, Empty, Input, Progress, Select, Skeleton, Tag, Tooltip } from 'antd';
import { Activity, BookOpenCheck, CheckCircle2, ChevronRight, ClipboardList, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import { teacherReviewApi } from '../../../services/teacherReviewApi';
import { useRealtimeEvent } from '../../realtime/realtimeContext';
import { BEHAVIOR_DOMAINS, MAX_BEHAVIOR_LENGTH, SHARE_SCOPE_OPTIONS } from '../behaviors/behaviorConstants';
import './AdaptiveLearningReviewPanel.css';

const { TextArea } = Input;
const EMPTY_REVIEWS = [];
const LEVEL_LABELS = {
  HIGH_SUPPORT: 'Hỗ trợ cao',
  STANDARD: 'Tiêu chuẩn',
  CHALLENGE: 'Thử thách',
};
const TRIGGER_HISTORY_LABELS = {
  EARLY_REPEATED_MISTAKES: ' (đánh giá sớm do sai lặp lại)',
  EARLY_CONSISTENT_SUCCESS: ' (đánh giá sớm do làm đúng liên tục)',
};

const STATUS_LABELS = {
  PENDING: 'Chờ nhận xét',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
};

function formatEvidenceDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function previewText(value, limit = 160) {
  const text = String(value || '');
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function enrichEvidence(evidence) {
  const latestQuestionByConversation = new Map();
  return (Array.isArray(evidence) ? evidence : []).map((item) => {
    const kind = String(item?.kind || '').toUpperCase();
    const conversationId = String(item?.conversationId || '');
    if (kind === 'STUDENT_QUESTION') {
      const question = String(item?.content || '');
      latestQuestionByConversation.set(conversationId, question);
      return {
        ...item,
        topic: item?.topic || previewText(question, 120),
        aiAssessment: item?.aiAssessment
          || 'AI lưu câu hỏi làm ngữ cảnh học tập; việc đặt câu hỏi tự nó không phải bằng chứng sinh viên yếu kiến thức.',
      };
    }
    if (kind !== 'STUDENT_ANSWER' && !kind.startsWith('QUIZ')) return item;

    const studentQuestion = item?.studentQuestion || latestQuestionByConversation.get(conversationId) || '';
    const quizQuestion = String(item?.quizQuestion || '');
    const topic = item?.topic || studentQuestion || quizQuestion;
    const knownResult = kind === 'QUIZ_WRONG' || kind === 'QUIZ_CORRECT'
      || typeof item?.correct === 'boolean';
    const skipped = item?.skipped === true || (!knownResult && item?.correct == null) || !item?.selectedKey;
    const aiAssessment = item?.aiAssessment || (skipped
      ? 'AI chưa chấm mục này vì sinh viên chưa chọn đáp án; không tính là trả lời sai.'
      : item?.correct === true || kind === 'QUIZ_CORRECT'
        ? `AI ghi nhận sinh viên trả lời đúng câu kiểm tra này (${item?.selectedKey}). Đây chưa phải bằng chứng làm chủ toàn bộ chủ đề.`
        : `AI ghi nhận sinh viên trả lời sai: chọn ${item?.selectedKey}, đáp án đúng ${item?.correctKey || 'chưa có dữ liệu'}. Một lần sai riêng lẻ chưa đủ kết luận lỗ hổng lặp lại.`);
    return { ...item, studentQuestion, topic, aiAssessment };
  });
}

function PercentMetric({ label, value, color }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="adaptive-review-metric">
      <div className="adaptive-review-metric__label"><span>{label}</span><strong>{safeValue}%</strong></div>
      <Progress percent={safeValue} showInfo={false} strokeColor={color} trailColor="#edf2f8" />
    </div>
  );
}

function EvidenceItem({ item, index }) {
  const [expanded, setExpanded] = useState(false);
  const role = String(item?.role || '').toUpperCase();
  const student = role === 'STUDENT';
  const kind = String(item?.kind || '').toUpperCase();
  const isStudentAnswer = kind === 'STUDENT_ANSWER' || kind.startsWith('QUIZ');
  const quizWrong = kind === 'QUIZ_WRONG' || (kind === 'STUDENT_ANSWER' && item?.correct === false);
  const quizCorrect = kind === 'QUIZ_CORRECT' || (kind === 'STUDENT_ANSWER' && item?.correct === true);
  const quizSkipped = isStudentAnswer && !quizWrong && !quizCorrect
    && (item?.skipped === true || item?.correct == null || !item?.selectedKey);
  const evidenceDate = formatEvidenceDate(isStudentAnswer
    ? item?.eventAt || item?.answeredAt || item?.createdAt
    : item?.createdAt);
  const selectedAnswer = [item?.selectedKey, item?.selectedText].filter(Boolean).join('. ');
  const correctAnswer = [item?.correctKey, item?.correctText].filter(Boolean).join('. ');
  const status = isStudentAnswer
    ? (quizWrong ? 'Sai' : quizCorrect ? 'Đúng' : 'Bỏ qua')
    : student ? 'Câu hỏi' : 'AI';
  const tone = quizWrong ? 'wrong' : quizCorrect ? 'correct' : quizSkipped ? 'skipped' : student ? 'question' : 'ai';
  const headline = isStudentAnswer
    ? (item?.quizQuestion || 'Câu kiểm tra')
    : (item?.content || 'Không có nội dung');
  const quizLabel = isStudentAnswer && item?.quizIndex != null
    ? `Kiểm tra ${Number(item.quizIndex) + 1}`
    : null;
  const resultLine = isStudentAnswer
    ? (quizSkipped
      ? 'Sinh viên chưa chọn đáp án'
      : `Chọn ${item?.selectedKey || '—'} · Đáp án ${item?.correctKey || '—'}`)
    : null;
  return (
    <article className={`adaptive-review-evidence is-${tone}`}>
      <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className="adaptive-review-evidence__index">{index + 1}</span>
        <span className="adaptive-review-evidence__body">
          <span className="adaptive-review-evidence__topline">
            <span className={`adaptive-review-evidence__status is-${tone}`}>{status}</span>
            {quizLabel ? <span className="adaptive-review-evidence__chip">{quizLabel}</span> : null}
            {item?.recheck ? <span className="adaptive-review-evidence__chip">Kiểm tra lại</span> : null}
            {evidenceDate ? <time>{evidenceDate}</time> : null}
          </span>
          <strong>{previewText(headline, 180)}</strong>
          {resultLine ? <small>{resultLine}</small> : null}
        </span>
        <ChevronRight size={16} className={expanded ? 'is-expanded' : ''} />
      </button>
      {expanded && (
        <div className="adaptive-review-evidence__detail">
          {isStudentAnswer && item?.studentQuestion ? (
            <div className="adaptive-review-evidence__block">
              <span>Câu hỏi trong chat</span>
              <p>{item.studentQuestion}</p>
            </div>
          ) : null}
          {isStudentAnswer ? (
            <div className="adaptive-review-evidence__block">
              <span>Câu kiểm tra</span>
              <p>{item?.quizQuestion || '—'}</p>
            </div>
          ) : (
            <div className="adaptive-review-evidence__block">
              <span>{student ? 'Câu hỏi của sinh viên' : 'Nội dung'}</span>
              <p>{item?.content || 'Không có nội dung log.'}</p>
            </div>
          )}
          {isStudentAnswer && (item?.quizOptions || []).length > 0 ? (
            <ul className="adaptive-review-evidence__choices">
              {(item.quizOptions || []).map((option) => {
                const picked = option.key === item?.selectedKey;
                const right = option.key === item?.correctKey;
                return (
                  <li key={option.key} className={`${picked ? 'is-picked' : ''} ${right ? 'is-right' : ''}`.trim()}>
                    <b>{option.key}</b>
                    <span>{option.text}</span>
                    {right ? <em>Đáp án</em> : null}
                    {picked ? <em>{quizCorrect ? 'Đã chọn' : 'Sinh viên chọn'}</em> : null}
                  </li>
                );
              })}
            </ul>
          ) : isStudentAnswer ? (
            <div className="adaptive-review-evidence__pair">
              <div><span>Sinh viên chọn</span><strong>{quizSkipped ? 'Chưa trả lời' : selectedAnswer || '—'}</strong></div>
              {!quizSkipped ? <div><span>Đáp án đúng</span><strong>{correctAnswer || '—'}</strong></div> : null}
            </div>
          ) : null}
          {item?.quizExplanation ? (
            <div className="adaptive-review-evidence__block">
              <span>Giải thích đáp án</span>
              <p>{item.quizExplanation}</p>
            </div>
          ) : null}
          {item?.aiAssessment ? (
            <div className="adaptive-review-evidence__assessment">
              <strong>AI ghi nhận</strong>
              <p>{item.aiAssessment}</p>
            </div>
          ) : null}
        </div>
      )}
    </article>
  );
}

const EMPTY_ROSTER = [];

/**
 * The AI's suggested strategies as checkboxes. While the review is PENDING the
 * AI already teaches with all of them; the teacher keeps the checked ones,
 * adds an own strategy under "Khác" and may share them to the library.
 */
function StrategyChooser({ review, value, onChange }) {
  const recommendations = review.teachingRecommendations || [];
  const pending = review.status === 'PENDING';

  if (!pending) {
    const applied = review.status === 'REJECTED'
      ? []
      : (review.teacherSelectedStrategies ?? recommendations);
    return (
      <div className="adaptive-review-strategies">
        <strong>Phong cách diễn giải đề xuất</strong>
        <ul className="adaptive-review-strategies__result">
          {recommendations.map((item) => (
            <li key={item} className={applied.includes(item) ? 'is-applied' : 'is-skipped'}>
              {applied.includes(item) ? '✓' : '✕'} {item}
            </li>
          ))}
          {review.status !== 'REJECTED' && review.teacherCustomStrategy && (
            <li className="is-applied">✓ Khác: {review.teacherCustomStrategy}</li>
          )}
        </ul>
        {review.status === 'REJECTED' && (
          <Alert type="info" showIcon message="Đã về cách giảng mặc định"
            description="Giảng viên đã từ chối nên AI không dùng các chiến lược của đánh giá này nữa." />
        )}
      </div>
    );
  }

  const update = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="adaptive-review-strategies">
      <strong>Phong cách diễn giải đề xuất</strong>
      <Alert type="info" showIcon className="adaptive-review-strategies__notice"
        message="AI đang dùng các phong cách này ở câu trả lời tiếp theo"
        description="Mỗi dòng là một cách diễn giải. Bỏ tick hoặc Từ chối nếu không muốn AI dùng tiếp." />
      {recommendations.length > 0 ? (
        <Checkbox.Group
          className="adaptive-review-strategies__list"
          value={value.selected}
          onChange={(selected) => update({ selected })}
          options={recommendations.map((item) => ({ value: item, label: item }))}
        />
      ) : <p className="adaptive-review-strategies__empty">AI chưa đề xuất chiến lược nào.</p>}
      <Checkbox checked={value.otherEnabled} onChange={(event) => update({ otherEnabled: event.target.checked })}>
        Khác (ghi phong cách diễn giải bạn muốn AI dùng)
      </Checkbox>
      {value.otherEnabled && (
        <TextArea value={value.custom} onChange={(event) => update({ custom: event.target.value })}
          maxLength={MAX_BEHAVIOR_LENGTH} showCount rows={2} aria-label="Chiến lược khác"
          placeholder="Ví dụ: Ví dụ thực tế trước, rồi mới bảng so sánh hai khái niệm gần nhau" />
      )}
      <div className="adaptive-review-strategies__share">
        <label>Chia sẻ lên kho RAG behavior
          <Select value={value.shareScope} onChange={(shareScope) => update({ shareScope })}
            options={SHARE_SCOPE_OPTIONS} aria-label="Chia sẻ lên kho" />
        </label>
        {value.shareScope === 'DOMAIN' && (
          <label>Domain
            <Select value={value.shareDomain || undefined} onChange={(shareDomain) => update({ shareDomain })}
              options={BEHAVIOR_DOMAINS} placeholder="Chọn domain" aria-label="Domain chia sẻ" />
          </label>
        )}
      </div>
    </div>
  );
}

function initialStrategyChoice(review) {
  return {
    selected: review?.teacherSelectedStrategies ?? [...(review?.teachingRecommendations || [])],
    otherEnabled: Boolean(review?.teacherCustomStrategy),
    custom: review?.teacherCustomStrategy || '',
    shareScope: '',
    shareDomain: '',
  };
}

/**
 * On-demand AI reading of the student's ENTIRE chat history in this course:
 * quiz outcomes (correct / wrong / skipped kept separate), difficult concepts
 * and the support-level change history, so the teacher can observe progress
 * without opening every conversation. Generating it never changes the level.
 */
function StudentCourseSummary({ studentId, courseId, classId }) {
  const [requested, setRequested] = useState(false);
  const summaryQuery = useQuery({
    queryKey: ['teacher', 'student-course-summary', studentId, courseId, classId],
    queryFn: ({ signal }) => teacherReviewApi.getStudentCourseSummary(studentId, courseId, classId, { signal }),
    enabled: requested && Boolean(studentId && courseId),
    staleTime: 60_000,
  });
  const data = summaryQuery.data;
  const levelLabel = (level) => LEVEL_LABELS[level] || level || 'Tiêu chuẩn';
  return (
    <section className="adaptive-course-summary">
      <div className="adaptive-review-section-heading">
        <div>
          <h4><Sparkles size={15} /> Tóm tắt toàn bộ lịch sử học trong môn</h4>
          <p>AI đọc toàn bộ lịch sử chat của sinh viên trong môn này (mọi buổi học): đã hỏi gì, làm câu kiểm tra đúng/sai/bỏ qua ra sao, tiến bộ thế nào và mức hỗ trợ đã thay đổi qua các chu kỳ. Bản tóm tắt chỉ để giảng viên quan sát — mức hỗ trợ do đánh giá định kỳ mỗi 5 câu hỏi (hoặc đánh giá sớm khi sai lặp lại / làm đúng liên tục) quyết định và có thể chuyển lên/xuống ở mỗi mốc.</p>
        </div>
        <Button
          size="small"
          loading={summaryQuery.isFetching}
          onClick={() => { if (data) summaryQuery.refetch(); else setRequested(true); }}
        >
          {data ? 'Tạo lại tóm tắt' : 'AI tóm tắt toàn bộ lịch sử'}
        </Button>
      </div>
      {summaryQuery.isError && (
        <Alert type="error" showIcon message="Không tạo được tóm tắt"
          description={summaryQuery.error?.message || 'Thử lại sau ít phút.'} />
      )}
      {data && (
        <>
          <div className="adaptive-course-summary__stats">
            <span><strong>{data.totalQuestions ?? 0}</strong> câu hỏi đã hỏi</span>
            <span><strong>{data.quizAnswered ?? 0}</strong> câu kiểm tra đã trả lời
              {' '}(đúng {data.quizCorrect ?? 0} · sai {data.quizWrong ?? 0})</span>
            <span><strong>{data.quizSkipped ?? 0}</strong> câu kiểm tra bỏ qua</span>
            <span>Tỉ lệ đúng <strong>{data.quizCorrectPercent ?? 0}%</strong></span>
            <span>Mức hỗ trợ hiện tại <strong>{levelLabel(data.currentSupportLevel)}</strong>
              {' '}· đang ở {data.questionsInCurrentCycle ?? 0}/{data.cycleSize ?? 5} của chu kỳ</span>
          </div>
          <p className="adaptive-course-summary__text">{data.aiSummary}</p>
          {!data.modelGenerated && (
            <Alert type="warning" showIcon message="Đây là tóm tắt theo số liệu thô vì AI tạm thời không khả dụng." />
          )}
          {(data.strengths?.length > 0 || data.knowledgeGaps?.length > 0 || data.teachingRecommendations?.length > 0) && (
            <div className="adaptive-review-summary__columns">
              {data.strengths?.length > 0 && (
                <div><h5>Điểm mạnh</h5><ul>{data.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>
              )}
              {data.knowledgeGaps?.length > 0 && (
                <div><h5>Cần củng cố</h5><ul>{data.knowledgeGaps.map((item) => <li key={item}>{item}</li>)}</ul></div>
              )}
              {data.teachingRecommendations?.length > 0 && (
                <div><h5>Gợi ý cho giảng viên</h5><ul>{data.teachingRecommendations.map((item) => <li key={item}>{item}</li>)}</ul></div>
              )}
            </div>
          )}
          {data.difficultConcepts?.length > 0 && (
            <div className="adaptive-course-summary__concepts">
              <h5>Khái niệm hay sai / hay bỏ qua</h5>
              {data.difficultConcepts.map((concept) => (
                <p key={concept.concept}>
                  <strong>{concept.concept}</strong>
                  {concept.wrongCount > 0 ? ` — sai ${concept.wrongCount} lần` : ''}
                  {concept.skippedCount > 0 ? ` — bỏ qua ${concept.skippedCount} lần` : ''}
                </p>
              ))}
            </div>
          )}
          {data.levelHistory?.length > 0 && (
            <div className="adaptive-course-summary__history">
              <h5>Lịch sử đổi mức hỗ trợ</h5>
              {data.levelHistory.map((entry) => (
                <p key={entry.reviewId}>
                  Sau {entry.questionCount ?? 0} câu hỏi: {levelLabel(entry.fromLevel)} → <strong>{levelLabel(entry.toLevel)}</strong>
                  {TRIGGER_HISTORY_LABELS[entry.triggerType] || ' (đánh giá theo chu kỳ)'}
                  {entry.createdAt ? ` · ${new Date(entry.createdAt).toLocaleString('vi-VN')}` : ''}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function AdaptiveLearningReviewPanel({ courseId, classId, triggerToast, embedded = false, forcedStudentId = '' }) {
  const [selectedId, setSelectedId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [decision, setDecision] = useState('APPROVE');
  const [supportLevel, setSupportLevel] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [strategyChoice, setStrategyChoice] = useState(() => initialStrategyChoice(null));
  const triggerToastRef = useRef(triggerToast);
  useEffect(() => { triggerToastRef.current = triggerToast; }, [triggerToast]);

  const queryClient = useQueryClient();
  const queryKey = ['teacher', 'adaptive-learning-reviews', courseId, classId];
  const reviewsQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => teacherReviewApi.getAdaptiveLearningReviews(courseId, classId, { signal }),
    enabled: Boolean(courseId && classId),
    staleTime: 15_000,
  });
  const reviews = reviewsQuery.data ?? EMPTY_REVIEWS;
  const rosterQuery = useQuery({
    queryKey: ['teacher', 'adaptive-learning-roster', courseId, classId],
    queryFn: ({ signal }) => teacherReviewApi.getAdaptiveStudentRoster(courseId, classId, { signal }),
    enabled: Boolean(courseId && classId),
    staleTime: 15_000,
  });
  const roster = rosterQuery.data ?? EMPTY_ROSTER;
  const loading = reviewsQuery.isFetching || rosterQuery.isFetching;
  const load = () => { reviewsQuery.refetch(); rosterQuery.refetch(); };

  useRealtimeEvent(['ADAPTIVE_LEARNING_REVIEW_CREATED', 'STUDENT_QUESTION_ANSWERED'], (event) => {
    const data = event?.data || {};
    if ((!data.courseId || data.courseId === courseId) && (!data.classId || data.classId === classId)) {
      // Question progress (x/10) and new labels refresh live.
      reviewsQuery.refetch();
      rosterQuery.refetch();
      if (event.type === 'ADAPTIVE_LEARNING_REVIEW_CREATED') {
        triggerToastRef.current?.('Có đánh giá tiến bộ học tập mới cần nhận xét.');
      }
    }
  });

  const filteredRoster = useMemo(() => {
    if (statusFilter === 'ALL') return roster;
    if (statusFilter === 'UNLABELED') return roster.filter((item) => !item.labeled);
    return roster.filter((item) => item.labeled && item.reviewStatus === statusFilter);
  }, [roster, statusFilter]);
  const selectedStudent = (forcedStudentId
    ? roster.find((item) => item.studentId === forcedStudentId) : null)
    || roster.find((item) => item.studentId === selectedStudentId)
    || (embedded ? null : filteredRoster[0])
    || null;
  const selected = selectedStudent?.latestReviewId
    ? (reviews.find((item) => item.id === selectedStudent.latestReviewId)
      || reviews.find((item) => item.id === selectedId)
      || null)
    : null;
  const selectedEvidence = enrichEvidence(selected?.evidence || EMPTY_REVIEWS);
  const wrongEvidenceCount = selectedEvidence.filter((item) => (
    item?.kind === 'QUIZ_WRONG'
    || (item?.kind === 'STUDENT_ANSWER' && item?.correct === false)
  )).length;
  useEffect(() => {
    if (!selected) return undefined;
    const timer = window.setTimeout(() => {
      setSelectedId(selected.id);
      setFeedback(selected.teacherFeedback || '');
      setSupportLevel(selected.suggestedSupportLevel || 'STANDARD');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selected]);
  // Reset the checkboxes only when another review (or its status) is shown, not on every refetch.
  const strategyKey = selected ? `${selected.id}:${selected.status}` : '';
  const [strategyChoiceKey, setStrategyChoiceKey] = useState('');
  if (strategyKey !== strategyChoiceKey) {
    setStrategyChoiceKey(strategyKey);
    setStrategyChoice(initialStrategyChoice(selected));
  }

  const pendingCount = reviews.filter((item) => item.status === 'PENDING').length;
  const approvedCount = reviews.filter((item) => item.status === 'APPROVED').length;
  const unlabeledCount = roster.filter((item) => !item.labeled).length;

  const selectStudent = (student) => {
    setSelectedStudentId(student.studentId);
    if (student.latestReviewId) {
      const review = reviews.find((item) => item.id === student.latestReviewId);
      setSelectedId(student.latestReviewId);
      setFeedback(review?.teacherFeedback || '');
      setDecision('APPROVE');
      setSupportLevel(review?.suggestedSupportLevel || student.suggestedSupportLevel || 'STANDARD');
    }
  };

 
  const retryEvaluation = async ({ silent = false } = {}) => {
    if (!selected?.id || retrying) return;
    setRetrying(true);
    try {
      const updated = await teacherReviewApi.retryAdaptiveLearningReview(selected.id);
      queryClient.setQueryData(queryKey, (current = []) => (
        current.map((item) => (item.id === selected.id ? updated : item))
      ));
      await load();
      if (!silent) {
        if (updated?.evaluationError) {
          triggerToastRef.current?.('Hệ thống vẫn đang hoàn tất đánh giá tự động. Thử lại sau ít phút.');
        } else {
          triggerToastRef.current?.('Đánh giá tự động đã sẵn sàng để bạn đọc và nhận xét.');
        }
      }
    } catch (error) {
      if (!silent) triggerToastRef.current?.(error?.message || 'Không chạy lại được đánh giá.');
    } finally {
      setRetrying(false);
    }
  };

  // One automatic repair attempt when opening an incomplete review; background scheduler keeps trying.
  const autoRetriedRef = useRef('');
  useEffect(() => {
    if (!selected?.id || selected.status !== 'PENDING' || !selected.evaluationError || retrying) return undefined;
    if (autoRetriedRef.current === selected.id) return undefined;
    autoRetriedRef.current = selected.id;
    const timer = window.setTimeout(() => {
      retryEvaluation({ silent: true });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [selected?.id, selected?.status, selected?.evaluationError, retrying]);

  const submitDecision = async () => {
    if (!selected || saving) return;
    if (selected.evaluationError) {
      triggerToastRef.current?.('Đánh giá tự động chưa xong. Hệ thống đang chạy lại — đợi kết quả rồi nhận xét.');
      retryEvaluation({ silent: true });
      return;
    }
    const customStrategy = strategyChoice.otherEnabled ? strategyChoice.custom.trim() : '';
    if (decision !== 'REJECT') {
      if (strategyChoice.otherEnabled && !customStrategy) {
        triggerToastRef.current?.('Hãy ghi nội dung cho mục Khác hoặc bỏ tick mục này.');
        return;
      }
      if (strategyChoice.shareScope === 'DOMAIN' && !strategyChoice.shareDomain) {
        triggerToastRef.current?.('Hãy chọn domain để chia sẻ chiến lược.');
        return;
      }
    }
    setSaving(true);
    try {
      const strategyPayload = decision === 'REJECT' ? {} : {
        selectedStrategies: strategyChoice.selected,
        customStrategy: customStrategy || undefined,
        shareScope: strategyChoice.shareScope || undefined,
        shareDomain: strategyChoice.shareScope === 'DOMAIN' ? strategyChoice.shareDomain : undefined,
      };
      const updated = await teacherReviewApi.decideAdaptiveLearningReview(selected.id, {
        decision,
        teacherFeedback: feedback.trim(),
        supportLevel: decision === 'MODIFY' ? (supportLevel || selected.suggestedSupportLevel) : selected.suggestedSupportLevel,
        ...strategyPayload,
      });
      queryClient.setQueryData(queryKey, (current = []) => current.map((item) => item.id === selected.id ? updated : item));
      queryClient.invalidateQueries({ queryKey: ['teacher', 'student-teaching-rag'] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'teaching-behaviors'] });
      triggerToastRef.current?.('Đã lưu quyết định và nhận xét của giảng viên.');
      await load();
    } catch (error) {
      triggerToastRef.current?.(error?.message || 'Không lưu được nhận xét.');
    } finally {
      setSaving(false);
    }
  };

  if (!courseId || !classId) {
    return (
      <Alert
        type="info"
        showIcon
        message="Chọn môn học và lớp"
        description="Chọn đúng môn học và lớp đang phụ trách để xem các đánh giá tiến bộ sau mỗi 5 câu hỏi học trong môn."
      />
    );
  }

  return (
    <section className={`adaptive-review-panel${embedded ? ' adaptive-review-panel--embedded' : ''}`}>
      {!embedded && (
        <>
          <header className="adaptive-review-panel__header">
            <div>
              <span className="adaptive-review-eyebrow"><Activity size={14} /> HỌC TẬP THÍCH ỨNG</span>
              <h2>Đánh giá tiến bộ của AI</h2>
              <p>AI tự đánh giá, tự đổi mức hỗ trợ và đề xuất chiến lược. Bạn chỉ cần đọc bằng chứng rồi duyệt / chỉnh / từ chối.</p>
            </div>
            <Button icon={<RefreshCw size={15} />} onClick={load} loading={loading}>Làm mới</Button>
          </header>

          <div className="adaptive-review-stats">
            <div><span><ClipboardList size={17} /></span><strong>{roster.length}</strong><small>Sinh viên trong lớp</small></div>
            <div><span className="is-pending"><ShieldAlert size={17} /></span><strong>{pendingCount}</strong><small>Chờ nhận xét</small></div>
            <div><span className="is-approved"><CheckCircle2 size={17} /></span><strong>{approvedCount}</strong><small>Đã duyệt</small></div>
            <div><span className="is-rejected"><BookOpenCheck size={17} /></span><strong>{unlabeledCount}</strong><small>Chưa đánh giá</small></div>
          </div>
        </>
      )}

      <div className={`adaptive-review-layout${embedded ? ' adaptive-review-layout--embedded' : ''}`}>
        {!embedded && (
        <aside className="adaptive-review-list">
          <div className="adaptive-review-list__toolbar">
            <h3>Sinh viên trong lớp</h3>
            <Select value={statusFilter} onChange={setStatusFilter} options={[
              { value: 'ALL', label: 'Tất cả trạng thái' },
              { value: 'PENDING', label: 'Chờ nhận xét' },
              { value: 'APPROVED', label: 'Đã duyệt' },
              { value: 'REJECTED', label: 'Đã từ chối' },
              { value: 'UNLABELED', label: 'Chưa đánh giá' },
            ]} size="small" />
          </div>
          {loading ? <div style={{ padding: '8px 0' }}><Skeleton active avatar paragraph={{ rows: 1 }} /><Skeleton active avatar paragraph={{ rows: 1 }} /><Skeleton active avatar paragraph={{ rows: 1 }} /></div> : filteredRoster.length === 0 ? <Empty description="Lớp chưa có sinh viên" /> : (
            <div className="adaptive-review-list__items">
              {filteredRoster.map((item) => (
                <button type="button" key={item.studentId} className={`adaptive-review-list__item ${selectedStudent?.studentId === item.studentId ? 'is-selected' : ''}`}
                  onClick={() => selectStudent(item)}>
                  <span className="adaptive-review-list__avatar">{String(item.studentName || item.studentId || 'SV').slice(0, 2).toUpperCase()}</span>
                  <span className="adaptive-review-list__copy">
                    <strong>{item.studentName || `Sinh viên ${item.studentId || ''}`}</strong>
                    <small>
                      {item.labeled
                        ? `${item.courseId} · Sau ${item.reviewQuestionCount ?? 0} câu hỏi · ${item.overallPercent ?? 0}%`
                        : `${item.courseId} · Đã hỏi ${item.questionsInCurrentCycle ?? 0}/${item.cycleSize ?? 5} câu tới chu kỳ đánh giá · 0%`}
                    </small>
                    <span>{item.labeled && item.reviewCreatedAt ? new Date(item.reviewCreatedAt).toLocaleString('vi-VN') : 'Chưa có đánh giá của AI'}</span>
                  </span>
                  {item.labeled ? (
                    <Tag color={item.reviewStatus === 'PENDING' ? 'gold' : item.reviewStatus === 'APPROVED' ? 'green' : 'default'}>
                      {STATUS_LABELS[item.reviewStatus] || item.reviewStatus}
                    </Tag>
                  ) : (
                    <Tag>Chưa đánh giá</Tag>
                  )}
                </button>
              ))}
            </div>
          )}
        </aside>
        )}

        {selected ? (
          <main className="adaptive-review-detail">
            <div className="adaptive-review-detail__student">
              <div>
                <span className="adaptive-review-eyebrow">SAU {selected.questionCount ?? selected.completedSessionCount ?? 0} CÂU HỎI HỌC TRONG MÔN</span>
                <h3>{selected.studentName || `Sinh viên ${selected.studentId}`}</h3>
                <p>{selected.courseId} {selected.classId ? `· Lớp ${selected.classId}` : ''}</p>
              </div>
              <Tag color={selected.status === 'PENDING' ? 'gold' : selected.status === 'APPROVED' ? 'green' : 'default'}>
                {STATUS_LABELS[selected.status] || selected.status}
              </Tag>
              {selected.triggerType === 'EARLY_REPEATED_MISTAKES' && (
                <Tag color="red">Đánh giá sớm · lỗi lặp lại</Tag>
              )}
              {selected.triggerType === 'EARLY_CONSISTENT_SUCCESS' && (
                <Tag color="green">Đánh giá sớm · làm đúng liên tục</Tag>
              )}
            </div>

            {selected.evaluationError && (
              <Alert
                type="info"
                showIcon
                message="Đang hoàn tất đánh giá tự động"
                description={(
                  <div className="adaptive-review-eval-error">
                    <p>Hệ thống đang tự chạy lại đánh giá. Bạn chỉ cần đợi rồi đọc kết quả và nhận xét — không cần thao tác thêm.</p>
                    {retrying && <p>Đang cập nhật…</p>}
                  </div>
                )}
              />
            )}
            <div className="adaptive-review-score">
              <div className="adaptive-review-score__overall">
                <Progress type="circle" percent={selected.overallPercent || 0} size={112} strokeColor="#6558f5" />
                <strong>Mức tổng hợp</strong>
                <small>Ước lượng AI; xem kèm bằng chứng</small>
              </div>
              <div className="adaptive-review-score__metrics">
                <PercentMetric label="Hiểu kiến thức" value={selected.knowledgePercent} color="#10b981" />
                <PercentMetric label="Kỹ năng thực hành" value={selected.practicePercent} color="#3b82f6" />
                <PercentMetric label="Mức độ độc lập" value={selected.independencePercent} color="#f59e0b" />
                <PercentMetric label="Độ đầy đủ bằng chứng" value={selected.confidencePercent} color="#8b5cf6" />
              </div>
            </div>

            <div className="adaptive-review-summary">
              <h4>Nhận định của AI</h4>
              <p>{selected.summary || 'Chưa có nhận định.'}</p>
              <div className="adaptive-review-summary__columns">
                <div><strong>Điểm mạnh</strong><ul>{(selected.strengths || []).map((item, i) => <li key={i}>{item}</li>)}</ul></div>
                <div><strong>Lỗ hổng cần củng cố</strong><ul>{(selected.knowledgeGaps || []).map((item, i) => <li key={i}>{item}</li>)}</ul></div>
              </div>
              <StrategyChooser review={selected} value={strategyChoice} onChange={setStrategyChoice} />
            </div>

            <div className="adaptive-review-levels">
              <div><small>Mức trước đánh giá</small><strong>{LEVEL_LABELS[selected.currentSupportLevel] || selected.currentSupportLevel}</strong></div>
              <div><small>AI đề xuất</small><strong className="is-suggested">{LEVEL_LABELS[selected.suggestedSupportLevel] || selected.suggestedSupportLevel}</strong></div>
            </div>
            {selected.appliedDirectiveId && selected.status === 'PENDING' && (
              <Alert
                type="info"
                showIcon
                message="AI đã tự áp dụng mức hỗ trợ này"
                description="Mức hỗ trợ của sinh viên đã được đổi ngay khi AI tạo đánh giá. Nhận xét và quyết định của bạn bên dưới sẽ thay thế; chọn Từ chối sẽ thu hồi mức AI đã áp dụng."
              />
            )}

            <section className="adaptive-review-logs">
              <div className="adaptive-review-section-heading">
                <div>
                  <h4>Bằng chứng</h4>
                  <p>{selectedEvidence.length} mục · {wrongEvidenceCount} câu sai. Mở từng mục để xem câu hỏi, lựa chọn và đáp án.</p>
                </div>
              </div>
              {selectedEvidence.length ? selectedEvidence.map((item, i) => (
                <EvidenceItem
                  key={`${item.messageId || i}-${item.kind || 'evidence'}-${item.quizIndex ?? i}`}
                  item={item}
                  index={i}
                />
              ))
                : <Empty description="Không có log bằng chứng" />}
            </section>

            {selected.status === 'PENDING' ? (
              <section className="adaptive-review-decision">
                <h4>Nhận xét của giảng viên</h4>
                <p className="adaptive-review-decision__hint">AI đã tự áp dụng. Bạn đọc xong rồi duyệt, chỉnh mức, hoặc từ chối. Nhận xét là tùy chọn.</p>
                <TextArea value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={5000}
                  showCount rows={3} placeholder="Ghi chú thêm (không bắt buộc)…" />
                <div className="adaptive-review-decision__choices">
                  <label>Quyết định
                    <Select value={decision} onChange={setDecision} options={[
                      { value: 'APPROVE', label: 'Đồng ý với AI' },
                      { value: 'MODIFY', label: 'Chỉnh mức hỗ trợ' },
                      { value: 'REJECT', label: 'Từ chối, về mặc định' },
                    ]} />
                  </label>
                  {decision === 'MODIFY' && <label>Mức hỗ trợ
                    <Select value={supportLevel || selected.suggestedSupportLevel || 'STANDARD'} onChange={setSupportLevel} options={Object.entries(LEVEL_LABELS).map(([value, label]) => ({ value, label }))} />
                  </label>}
                </div>
                <Tooltip title="Xác nhận sau khi bạn đã đọc đánh giá và bằng chứng.">
                  <Button type="primary" block loading={saving} disabled={Boolean(selected.evaluationError) || retrying} onClick={submitDecision}>
                    {decision === 'APPROVE' ? 'Đã đọc · Đồng ý' : decision === 'MODIFY' ? 'Đã đọc · Lưu mức mới' : 'Đã đọc · Từ chối'}
                  </Button>
                </Tooltip>
              </section>
            ) : (
              <Alert type="success" showIcon message={`Đã xử lý: ${STATUS_LABELS[selected.status] || selected.status}`}
                description={selected.teacherFeedback || 'Không có ghi chú giảng viên.'} />
            )}
          </main>
        ) : selectedStudent ? (
          <main className="adaptive-review-detail">
            <div className="adaptive-review-detail__student">
              <div>
                <span className="adaptive-review-eyebrow">CHƯA CÓ NHÃN AI TRONG MÔN NÀY</span>
                <h3>{selectedStudent.studentName || `Sinh viên ${selectedStudent.studentId}`}</h3>
                <p>{selectedStudent.courseId} {selectedStudent.classId ? `· Lớp ${selectedStudent.classId}` : ''}</p>
              </div>
              <Tag>Chưa đánh giá</Tag>
            </div>
            <div className="adaptive-review-score">
              <div className="adaptive-review-score__overall">
                <Progress type="circle" percent={0} size={112} strokeColor="#94a3b8" />
                <strong>Mức tổng hợp</strong>
                <small>AI chưa dán nhãn cho sinh viên này</small>
              </div>
              <div className="adaptive-review-score__metrics">
                <PercentMetric label="Hiểu kiến thức" value={0} color="#10b981" />
                <PercentMetric label="Kỹ năng thực hành" value={0} color="#3b82f6" />
                <PercentMetric label="Mức độ độc lập" value={0} color="#f59e0b" />
                <PercentMetric label="Độ đầy đủ bằng chứng" value={0} color="#8b5cf6" />
              </div>
            </div>
            <Alert
              type="info"
              showIcon
              message={`AI đánh giá sau mỗi ${selectedStudent.cycleSize ?? 5} câu hỏi, hoặc sớm hơn khi sai lặp lại hay làm đúng liên tục`}
              description={`Sinh viên đã hỏi ${selectedStudent.totalQuestions ?? 0} câu trong môn này, trong đó ${selectedStudent.questionsInCurrentCycle ?? 0}/${selectedStudent.cycleSize ?? 5} câu thuộc chu kỳ hiện tại. AI đọc lại cuộc trò chuyện và kết quả câu kiểm tra để đề xuất mức hỗ trợ: tăng hỗ trợ khi sai lặp lại (từ 3 câu, hoặc 2 câu cùng khái niệm), giảm hỗ trợ khi làm đúng liên tục (ít nhất 3 câu được chấm, đúng từ 70%). Mức mới được áp ngay, mỗi lần đổi 1 bậc; giảng viên xem lại tại đây và có thể sửa hoặc thu hồi.`}
            />
            <div className="adaptive-review-levels">
              <div><small>Mức hỗ trợ hiện tại</small><strong>{LEVEL_LABELS[selectedStudent.currentSupportLevel] || selectedStudent.currentSupportLevel || 'Tiêu chuẩn'}</strong></div>
              <div><small>AI đề xuất</small><strong className="is-suggested">Chưa có</strong></div>
            </div>
          </main>
        ) : (
          <main className="adaptive-review-detail"><Empty description={embedded ? 'Sinh viên này chưa có đánh giá tiến bộ của AI' : 'Chọn một sinh viên để xem đánh giá và log trò chuyện'} /></main>
        )}
      </div>
      {selectedStudent && (
        <StudentCourseSummary
          studentId={selectedStudent.studentId}
          courseId={courseId}
          classId={classId}
        />
      )}
    </section>
  );
}
