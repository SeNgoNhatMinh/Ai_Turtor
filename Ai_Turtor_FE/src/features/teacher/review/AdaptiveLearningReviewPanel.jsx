import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Empty, Input, Progress, Select, Spin, Tag, Tooltip } from 'antd';
import { Activity, BookOpenCheck, CheckCircle2, ChevronRight, ClipboardList, RefreshCw, ShieldAlert } from 'lucide-react';
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
  return (
    <article className="adaptive-review-evidence">
      <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
        <span className={`adaptive-review-evidence__dot ${student ? 'is-student' : 'is-ai'}`} />
        <span className="adaptive-review-evidence__body">
          <strong>{student ? 'Sinh viên' : 'AI Tutor'} · Bằng chứng {index + 1}</strong>
          <small>{item?.topic || 'Chủ đề chưa xác định'}{item?.createdAt ? ` · ${new Date(item.createdAt).toLocaleString('vi-VN')}` : ''}</small>
          <span>{String(item?.content || '').slice(0, 150)}{String(item?.content || '').length > 150 ? '…' : ''}</span>
        </span>
        <ChevronRight size={16} className={expanded ? 'is-expanded' : ''} />
      </button>
      {expanded && (
        <div className="adaptive-review-evidence__detail">
          <p>{item?.content || 'Không có nội dung log.'}</p>
          <small>Message ID: {item?.messageId || '—'} · Session ID: {item?.sessionId || '—'}</small>
        </div>
      )}
    </article>
  );
}

export default function AdaptiveLearningReviewPanel({ courseId, classId, triggerToast }) {
  const [selectedId, setSelectedId] = useState('');
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
  const loading = reviewsQuery.isFetching;
  const load = () => reviewsQuery.refetch();

  useRealtimeEvent(['ADAPTIVE_LEARNING_REVIEW_CREATED'], (event) => {
    const data = event?.data || {};
    if ((!data.courseId || data.courseId === courseId) && (!data.classId || data.classId === classId)) {
      reviewsQuery.refetch();
      triggerToastRef.current?.('Có đánh giá tiến bộ học tập mới cần nhận xét.');
    }
  });

  const filteredReviews = useMemo(() => statusFilter === 'ALL'
    ? reviews
    : reviews.filter((item) => item.status === statusFilter), [reviews, statusFilter]);
  const selected = reviews.find((item) => item.id === selectedId) || filteredReviews[0] || null;
  const pendingCount = reviews.filter((item) => item.status === 'PENDING').length;
  const approvedCount = reviews.filter((item) => item.status === 'APPROVED').length;
  const rejectedCount = reviews.filter((item) => item.status === 'REJECTED').length;

 
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
        description="Chọn đúng môn học và lớp đang phụ trách để xem các đánh giá tiến bộ sau mỗi 10 phiên học."
      />
    );
  }

  return (
    <section className="adaptive-review-panel">
      <header className="adaptive-review-panel__header">
        <div>
          <span className="adaptive-review-eyebrow"><Activity size={14} /> HỌC TẬP THÍCH ỨNG</span>
          <h2>Đánh giá tiến bộ của AI</h2>
          <p>AI tổng hợp 10 phiên học gần nhất, đề xuất mức hỗ trợ và đính kèm log làm bằng chứng để giảng viên duyệt.</p>
        </div>
        <Button icon={<RefreshCw size={15} />} onClick={load} loading={loading}>Làm mới</Button>
      </header>

      <div className="adaptive-review-stats">
        <div><span><ClipboardList size={17} /></span><strong>{reviews.length}</strong><small>Tổng đánh giá</small></div>
        <div><span className="is-pending"><ShieldAlert size={17} /></span><strong>{pendingCount}</strong><small>Chờ nhận xét</small></div>
        <div><span className="is-approved"><CheckCircle2 size={17} /></span><strong>{approvedCount}</strong><small>Đã duyệt</small></div>
        <div><span className="is-rejected"><BookOpenCheck size={17} /></span><strong>{rejectedCount}</strong><small>Đã từ chối</small></div>
      </div>

      <div className="adaptive-review-layout">
        <aside className="adaptive-review-list">
          <div className="adaptive-review-list__toolbar">
            <h3>Yêu cầu nhận xét</h3>
            <Select value={statusFilter} onChange={setStatusFilter} options={[
              { value: 'ALL', label: 'Tất cả trạng thái' },
              { value: 'PENDING', label: 'Chờ nhận xét' },
              { value: 'APPROVED', label: 'Đã duyệt' },
              { value: 'REJECTED', label: 'Đã từ chối' },
            ]} size="small" />
          </div>
          {loading ? <Spin /> : filteredReviews.length === 0 ? <Empty description="Chưa có yêu cầu đánh giá" /> : (
            <div className="adaptive-review-list__items">
              {filteredReviews.map((item) => (
                <button type="button" key={item.id} className={`adaptive-review-list__item ${selected?.id === item.id ? 'is-selected' : ''}`}
                  onClick={() => { setSelectedId(item.id); setFeedback(item.teacherFeedback || ''); setDecision('APPROVE'); setSupportLevel(item.suggestedSupportLevel || 'STANDARD'); }}>
                  <span className="adaptive-review-list__avatar">{String(item.studentName || item.studentId || 'SV').slice(0, 2).toUpperCase()}</span>
                  <span className="adaptive-review-list__copy">
                    <strong>{item.studentName || `Sinh viên ${item.studentId || ''}`}</strong>
                    <small>{item.courseId} · Chu kỳ {item.completedSessionCount || 0} phiên</small>
                    <span>{item.createdAt ? new Date(item.createdAt).toLocaleString('vi-VN') : '—'}</span>
                  </span>
                  <Tag color={item.status === 'PENDING' ? 'gold' : item.status === 'APPROVED' ? 'green' : 'default'}>
                    {STATUS_LABELS[item.status] || item.status}
                  </Tag>
                </button>
              ))}
            </div>
          )}
        </aside>

        {selected ? (
          <main className="adaptive-review-detail">
            <div className="adaptive-review-detail__student">
              <div>
                <span className="adaptive-review-eyebrow">CHU KỲ {selected.completedSessionCount} PHIÊN HỌC</span>
                <h3>{selected.studentName || `Sinh viên ${selected.studentId}`}</h3>
                <p>{selected.courseId} {selected.classId ? `· Lớp ${selected.classId}` : ''}</p>
              </div>
              <Tag color={selected.status === 'PENDING' ? 'gold' : selected.status === 'APPROVED' ? 'green' : 'default'}>
                {STATUS_LABELS[selected.status] || selected.status}
              </Tag>
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
              <div><small>Mức hiện tại</small><strong>{LEVEL_LABELS[selected.currentSupportLevel] || selected.currentSupportLevel}</strong></div>
              <div><small>AI đề xuất</small><strong className="is-suggested">{LEVEL_LABELS[selected.suggestedSupportLevel] || selected.suggestedSupportLevel}</strong></div>
            </div>

            <section className="adaptive-review-logs">
              <div className="adaptive-review-section-heading">
                <div><h4>Bằng chứng từ log trò chuyện</h4><p>{(selected.evidence || []).length} mục bằng chứng được lưu trong chu kỳ này</p></div>
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
                      { value: 'REJECT', label: 'Từ chối, giữ mức hiện tại' },
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
        ) : (
          <main className="adaptive-review-detail"><Empty description="Chọn một yêu cầu để xem đánh giá và log trò chuyện" /></main>
        )}
      </div>
    </section>
  );
}
