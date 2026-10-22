import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Empty, Input, Progress, Select, Spin, Tag, Tooltip } from 'antd';
import { Activity, BookOpenCheck, CheckCircle2, ChevronRight, ClipboardList, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import { teacherReviewApi } from '../../../services/teacherReviewApi';
import { useRealtimeEvent } from '../../realtime/realtimeContext';
import './AdaptiveLearningReviewPanel.css';

const { TextArea } = Input;
const EMPTY_REVIEWS = [];
const LEVEL_LABELS = {
  HIGH_SUPPORT: 'Hỗ trợ cao',
  STANDARD: 'Tiêu chuẩn',
  CHALLENGE: 'Thử thách',
};
const STATUS_LABELS = {
  PENDING: 'Chờ nhận xét',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
};

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
  // New evidence has exactly 3 kinds; legacy QUIZ_* kinds still render.
  const isStudentAnswer = kind === 'STUDENT_ANSWER' || kind.startsWith('QUIZ');
  const quizWrong = kind === 'QUIZ_WRONG' || (kind === 'STUDENT_ANSWER' && item?.correct === false);
  const quizCorrect = kind === 'QUIZ_CORRECT' || (kind === 'STUDENT_ANSWER' && item?.correct === true);
  const quizSkipped = isStudentAnswer && !quizWrong && !quizCorrect
    && (item?.skipped === true || item?.correct == null || !item?.selectedKey);
  const title = isStudentAnswer
    ? 'Đáp án của sinh viên'
    : student ? 'Câu hỏi của sinh viên' : 'Câu trả lời của AI';
  return (
    <article className="adaptive-review-evidence">
      <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className={`adaptive-review-evidence__dot ${student ? 'is-student' : 'is-ai'}`} />
        <span className="adaptive-review-evidence__body">
          <strong>{title}{isStudentAnswer && item?.quizIndex != null ? ` · Câu kiểm tra ${Number(item.quizIndex) + 1}` : ''} · Bằng chứng {index + 1}</strong>
          <small>{item?.topic || 'Chủ đề chưa xác định'}{item?.createdAt ? ` · ${new Date(item.createdAt).toLocaleString('vi-VN')}` : ''}</small>
          {isStudentAnswer ? (
            quizSkipped ? (
              <span>{item?.quizQuestion || ''}{' — Sinh viên bỏ qua, không trả lời câu này'}</span>
            ) : (
              <span>
                {item?.quizQuestion || ''}
                {' — Sinh viên chọn '}
                <b>{item?.selectedKey || '—'}</b>
                {', đáp án đúng '}
                <b>{item?.correctKey || '—'}</b>
              </span>
            )
          ) : (
            <span>{String(item?.content || '').slice(0, 150)}{String(item?.content || '').length > 150 ? '…' : ''}</span>
          )}
        </span>
        {isStudentAnswer && (
          <Tag color={quizWrong ? 'red' : quizCorrect ? 'green' : 'gold'}>
            {quizWrong ? 'Trả lời sai' : quizCorrect ? 'Trả lời đúng' : 'Bỏ qua'}
          </Tag>
        )}
        <ChevronRight size={16} className={expanded ? 'is-expanded' : ''} />
      </button>
      {expanded && (
        <div className="adaptive-review-evidence__detail">
          {isStudentAnswer ? (
            <>
              <p><strong>Câu hỏi kiểm tra:</strong> {item?.quizQuestion || '—'}</p>
              {(item?.quizOptions || []).map((option) => (
                <p key={option.key}>
                  <strong>{option.key}.</strong> {option.text}
                  {option.key === item?.correctKey ? ' ✓ đáp án đúng' : ''}
                  {option.key === item?.selectedKey ? ' ← sinh viên chọn' : ''}
                </p>
              ))}
              {item?.quizExplanation ? <p><strong>Giải thích:</strong> {item.quizExplanation}</p> : null}
              <p>{item?.content || ''}</p>
            </>
          ) : (
            <p>{item?.content || 'Không có nội dung log.'}</p>
          )}
          <small>Message ID: {item?.messageId || '—'} · Session ID: {item?.sessionId || '—'}</small>
        </div>
      )}
    </article>
  );
}

const EMPTY_ROSTER = [];

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
          <p>AI đọc toàn bộ lịch sử chat của sinh viên trong môn này (mọi buổi học): đã hỏi gì, làm câu kiểm tra đúng/sai/bỏ qua ra sao, tiến bộ thế nào và mức hỗ trợ đã thay đổi qua các chu kỳ. Bản tóm tắt chỉ để giảng viên quan sát — mức hỗ trợ vẫn do chu kỳ đánh giá 10 câu hỏi (hoặc đánh giá sớm khi sai nhiều) quyết định và có thể chuyển lên/xuống linh hoạt ở mỗi mốc.</p>
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
              {' '}· đang ở {data.questionsInCurrentCycle ?? 0}/{data.cycleSize ?? 10} của chu kỳ</span>
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
                  {entry.triggerType === 'EARLY_REPEATED_MISTAKES' ? ' (đánh giá sớm do sai lặp lại)' : ' (đánh giá chu kỳ 10 câu)'}
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
  const [feedback, setFeedback] = useState('');
  const [decision, setDecision] = useState('APPROVE');
  const [supportLevel, setSupportLevel] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
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
  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setFeedback(selected.teacherFeedback || '');
    setSupportLevel(selected.suggestedSupportLevel || 'STANDARD');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

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

 
  const submitDecision = async () => {
    if (!selected || saving) return;
    if (decision !== 'REJECT' && !feedback.trim()) {
      triggerToastRef.current?.('Hãy nhập nhận xét hoặc chỉ dẫn giảng dạy trước khi duyệt.');
      return;
    }
    setSaving(true);
    try {
      const updated = await teacherReviewApi.decideAdaptiveLearningReview(selected.id, {
        decision,
        teacherFeedback: feedback.trim(),
        supportLevel: decision === 'MODIFY' ? (supportLevel || selected.suggestedSupportLevel) : selected.suggestedSupportLevel,
      });
      queryClient.setQueryData(queryKey, (current = []) => current.map((item) => item.id === selected.id ? updated : item));
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
        description="Chọn đúng môn học và lớp đang phụ trách để xem các đánh giá tiến bộ sau mỗi 10 câu hỏi học trong môn."
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
              <p>AI tổng hợp quá trình học của từng sinh viên trong môn này (đánh giá định kỳ sau mỗi 10 câu hỏi, hoặc sớm hơn khi sai nhiều câu kiểm tra liên tiếp), tự đổi mức hỗ trợ và đính kèm bằng chứng gồm câu hỏi của sinh viên cùng từng câu kiểm tra đã làm đúng/sai để giảng viên xem lại, chỉnh sửa hoặc thu hồi.</p>
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
          {loading ? <Spin /> : filteredRoster.length === 0 ? <Empty description="Lớp chưa có sinh viên" /> : (
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
                        : `${item.courseId} · Đã hỏi ${item.questionsInCurrentCycle ?? 0}/${item.cycleSize ?? 10} câu tới chu kỳ đánh giá · 0%`}
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
            </div>

            {selected.evaluationError && <Alert type="warning" showIcon message="Đánh giá tự động chưa hoàn tất" description={selected.evaluationError} />}
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
              <strong>Chiến lược giảng dạy đề xuất</strong>
              <ul>{(selected.teachingRecommendations || []).map((item, i) => <li key={i}>{item}</li>)}</ul>
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
                <div><h4>Bằng chứng từ log trò chuyện</h4><p>{(selected.evidence || []).length} mục — câu hỏi của sinh viên và từng câu kiểm tra đã trả lời (ghi rõ đúng/sai, đáp án đã chọn và đáp án đúng)</p></div>
              </div>
              {(selected.evidence || []).length ? selected.evidence.map((item, i) => <EvidenceItem key={item.messageId || i} item={item} index={i} />)
                : <Empty description="Không có log bằng chứng" />}
            </section>

            {selected.status === 'PENDING' ? (
              <section className="adaptive-review-decision">
                <h4>Nhận xét và quyết định của giảng viên</h4>
                <TextArea value={feedback} onChange={(event) => setFeedback(event.target.value)} maxLength={5000}
                  showCount rows={4} placeholder="Nhập nhận xét, hướng dẫn cách giảng hoặc mục tiêu cần ưu tiên..." />
                <div className="adaptive-review-decision__choices">
                  <label>Quyết định
                    <Select value={decision} onChange={setDecision} options={[
                      { value: 'APPROVE', label: 'Duyệt và áp dụng chỉ dẫn' },
                      { value: 'MODIFY', label: 'Sửa mức hỗ trợ rồi áp dụng' },
                      { value: 'REJECT', label: 'Từ chối và thu hồi mức AI đã áp dụng' },
                    ]} />
                  </label>
                  {decision === 'MODIFY' && <label>Mức hỗ trợ
                    <Select value={supportLevel || selected.suggestedSupportLevel || 'STANDARD'} onChange={setSupportLevel} options={Object.entries(LEVEL_LABELS).map(([value, label]) => ({ value, label }))} />
                  </label>}
                </div>
                <Tooltip title="Chỉ dẫn đã duyệt sẽ được lưu thành chỉ dẫn sư phạm và dùng trong các phiên tiếp theo.">
                  <Button type="primary" block loading={saving} onClick={submitDecision}>Lưu nhận xét và quyết định</Button>
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
              message="AI đánh giá sau mỗi 10 câu hỏi, hoặc sớm hơn khi sai nhiều câu kiểm tra"
              description={`Sinh viên đã hỏi ${selectedStudent.totalQuestions ?? 0} câu trong môn này, trong đó ${selectedStudent.questionsInCurrentCycle ?? 0}/${selectedStudent.cycleSize ?? 10} câu thuộc chu kỳ hiện tại. Đủ ${selectedStudent.cycleSize ?? 10} câu — hoặc sai từ 3 câu kiểm tra (hay 2 câu cùng một khái niệm) — AI sẽ tự tổng hợp bằng chứng và đổi mức hỗ trợ ngay; giảng viên xem lại tại đây và có thể sửa hoặc thu hồi.`}
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
