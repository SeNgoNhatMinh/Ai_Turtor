import { useState } from 'react';
import { Button, Empty, Segmented } from 'antd';
import { RefreshCw } from 'lucide-react';
import AnswerReviewCard from './AnswerReviewCard';
import GroupedAnswerReviewCard from './GroupedAnswerReviewCard';
import KnowledgeCandidateReviewList from './KnowledgeCandidateReviewList';
import './ReviewWorkspace.css';
import './AnswerReviewWorkspace.css';

export default function AnswerReviewWorkspace({
  mode = 'mentor',
  loading = false,
  resolvedLoading = false,
  groups = [],
  reviews = [],
  resolvedReviews = [],
  onRefresh,
  onRefreshResolved,
  pendingReviewIds = [],
  onResolveReview,
  candidates = [],
  candidateNotes = {},
  onCandidateNoteChange,
  onApproveCandidate,
  onRejectCandidate,
  pendingCandidateIds = [],
  currentReviewerId = '',
}) {
  const [view, setView] = useState('pending');
  const [seniorDrafts, setSeniorDrafts] = useState({});
  const isSenior = mode === 'senior' || mode === 'admin';

  const updateSeniorDraft = (reviewId, patch) => {
    setSeniorDrafts((current) => ({
      ...current,
      [reviewId]: {
        notes: '',
        correctedAnswer: '',
        candidateType: 'ACADEMIC_KNOWLEDGE',
        ...current[reviewId],
        ...patch,
      },
    }));
  };

  const resolveSeniorReview = async (reviewId, decision) => {
    const draft = seniorDrafts[reviewId] || {};
    const succeeded = await onResolveReview?.(
      reviewId,
      decision,
      String(draft.notes || '').trim(),
      String(draft.correctedAnswer || '').trim(),
      draft.candidateType || 'ACADEMIC_KNOWLEDGE',
    );
    if (succeeded) {
      setSeniorDrafts((current) => {
        const next = { ...current };
        delete next[reviewId];
        return next;
      });
    }
  };

  const pendingCount = groups.length || reviews.length;
  const visibleItems = view === 'resolved' ? resolvedReviews : groups;

  return (
    <section className="answer-review-workspace" aria-labelledby="answer-review-heading">
      <div className="teacher-support-workspace__heading">
        <div>
          <span className="teacher-review-eyebrow">{isSenior ? 'Kiểm duyệt cấp cao' : 'Xác minh chuyên môn'}</span>
          <h2 id="answer-review-heading">{isSenior ? 'Phản hồi AI nghiêm trọng' : 'Phản hồi AI cần giảng viên kiểm tra'}</h2>
          <p>{isSenior
            ? 'Xác minh phản hồi 1 sao, xung đột nguồn hoặc sai kiến thức trước khi đề xuất tri thức tái sử dụng.'
            : 'Kiểm tra các nhóm phản hồi 2–3 sao có đủ bằng chứng từ sinh viên.'}</p>
        </div>
        <Button
          icon={<RefreshCw size={15} />}
          loading={view === 'resolved' ? resolvedLoading : loading}
          onClick={view === 'resolved' ? onRefreshResolved : onRefresh}
        >
          Làm mới
        </Button>
      </div>

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { label: `Đang chờ (${pendingCount})`, value: 'pending' },
          { label: `Đã xử lý (${resolvedReviews.length})`, value: 'resolved' },
        ]}
      />

      <div className="answer-review-list">
        {(view === 'resolved' ? resolvedLoading : loading) ? (
          <div className="no-data-text">Đang tải phản hồi...</div>
        ) : visibleItems.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={view === 'resolved'
              ? 'Chưa có phản hồi nào đã xử lý.'
              : 'Không có phản hồi nào đang chờ kiểm tra.'}
          />
        ) : view === 'resolved' ? (
          resolvedReviews.map((review) => (
            <AnswerReviewCard key={review.id} review={review} queue="history" />
          ))
        ) : (
          groups.map((group) => {
            const reviewId = group.representativeReviewId || group.id;
            return (
              <GroupedAnswerReviewCard
                key={group.answerFingerprint || reviewId}
                group={group}
                queue={isSenior ? 'senior' : 'mentor'}
                draft={seniorDrafts[reviewId]}
                isPending={pendingReviewIds.includes(reviewId)}
                onDraftChange={(patch) => updateSeniorDraft(reviewId, patch)}
                onResolve={(decision) => resolveSeniorReview(reviewId, decision)}
              />
            );
          })
        )}
      </div>

      {isSenior && (
        <section className="knowledge-review-section" aria-labelledby="knowledge-candidate-heading">
          <div>
            <span className="teacher-review-eyebrow">Cửa kiểm soát RAG</span>
            <h2 id="knowledge-candidate-heading">Tri thức đề xuất</h2>
            <p>Chỉ candidate được phê duyệt ở bước này mới được đưa vào RAG.</p>
          </div>
          <KnowledgeCandidateReviewList
            candidates={candidates}
            candidateNotes={candidateNotes}
            canReviewKnowledgeCandidates
            handleNoteChange={onCandidateNoteChange}
            handleApproveCandidate={onApproveCandidate}
            handleRejectCandidate={onRejectCandidate}
            pendingActionIds={pendingCandidateIds}
            currentReviewerId={currentReviewerId}
          />
        </section>
      )}
    </section>
  );
}
