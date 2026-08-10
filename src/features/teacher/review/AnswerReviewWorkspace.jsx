import { useMemo, useState } from 'react';
import { Button, Empty, Segmented } from 'antd';
import { CheckCheck, History, RefreshCw, ShieldCheck } from 'lucide-react';
import { CollectionPagination, CollectionSearch } from '../../../components/common/CollectionControls';
import { useCollectionView } from '../../../hooks/useCollectionView';
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
  candidatesLoading = false,
  reviewedCandidates = [],
  candidateHistoryLoading = false,
  candidateNotes = {},
  onCandidateNoteChange,
  onApproveCandidate,
  onRejectCandidate,
  pendingCandidateIds = [],
  currentReviewerId = '',
  onRefreshCandidates,
  onRefreshHistory,
}) {
  const [view, setView] = useState('pending');
  const [seniorSection, setSeniorSection] = useState('feedback');
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
  const pendingItems = groups.length ? groups : reviews;
  const activeSection = isSenior ? seniorSection : view;
  const isHistoryView = isSenior ? activeSection === 'history' : view === 'resolved';
  const historyLoading = resolvedLoading || candidateHistoryLoading;
  const activeLoading = activeSection === 'candidates'
    ? candidatesLoading
    : isHistoryView
      ? historyLoading
      : loading;
  const refreshActiveSection = activeSection === 'candidates'
    ? onRefreshCandidates
    : isHistoryView
      ? onRefreshHistory || onRefreshResolved
      : onRefresh;

  const historyItems = useMemo(() => [
    ...reviewedCandidates.map((record) => ({ kind: 'candidate', record })),
    ...resolvedReviews.map((record) => ({ kind: 'review', record })),
  ], [reviewedCandidates, resolvedReviews]);
  const activeCollectionItems = useMemo(() => {
    if (activeSection === 'candidates') return candidates;
    if (activeSection === 'history' || activeSection === 'resolved') return historyItems;
    return pendingItems;
  }, [activeSection, candidates, historyItems, pendingItems]);
  const collection = useCollectionView(activeCollectionItems, {
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 50],
  });
  const visibleHistoryCandidates = collection.visibleItems
    .filter((item) => item.kind === 'candidate')
    .map((item) => item.record);
  const visibleHistoryReviews = collection.visibleItems
    .filter((item) => item.kind === 'review')
    .map((item) => item.record);
  const searchPlaceholder = activeSection === 'candidates'
    ? 'Tìm câu hỏi, câu trả lời hoặc môn học'
    : isHistoryView
      ? 'Tìm trong lịch sử kiểm duyệt'
      : 'Tìm sinh viên, câu hỏi hoặc môn học';

  const selectSeniorSection = (section) => {
    setSeniorSection(section);
    collection.setQuery('');
  };

  const selectMentorView = (nextView) => {
    setView(nextView);
    collection.setQuery('');
  };

  const renderReviewList = (items, resolved = false) => (
    <div className="answer-review-list">
      {activeLoading ? (
        <div className="no-data-text">Đang tải dữ liệu kiểm duyệt...</div>
      ) : items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={resolved
            ? 'Chưa có phản hồi nào đã xử lý.'
            : 'Không có phản hồi nào đang chờ kiểm tra.'}
        />
      ) : resolved ? (
        items.map((review) => (
          <AnswerReviewCard key={review.id} review={review} queue="history" />
        ))
      ) : (
        items.map((group) => {
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
  );

  return (
    <section
      className={`answer-review-workspace ${isSenior ? 'answer-review-workspace--senior' : ''}`}
      aria-labelledby="answer-review-heading"
    >
      <div className="teacher-support-workspace__heading">
        <div>
          <span className="teacher-review-eyebrow">{isSenior ? 'Kiểm duyệt cấp cao' : 'Xác minh chuyên môn'}</span>
          <h2 id="answer-review-heading">{isSenior ? 'Hàng đợi kiểm duyệt' : 'Phản hồi AI cần giảng viên kiểm tra'}</h2>
          <p>{isSenior
            ? 'Xử lý phản hồi nghiêm trọng trước, sau đó phê duyệt riêng tri thức đủ tin cậy để đưa vào RAG.'
            : 'Kiểm tra các nhóm phản hồi 2–3 sao có đủ bằng chứng từ sinh viên.'}</p>
        </div>
        <Button
          icon={<RefreshCw size={15} />}
          loading={activeLoading}
          onClick={refreshActiveSection}
        >
          Làm mới
        </Button>
      </div>

      {isSenior ? (
        <>
          <nav className="senior-review-sections" aria-label="Các bước kiểm duyệt">
            <button
              type="button"
              className={`senior-review-section ${seniorSection === 'feedback' ? 'is-active' : ''}`}
              aria-pressed={seniorSection === 'feedback'}
              onClick={() => selectSeniorSection('feedback')}
            >
              <ShieldCheck size={18} />
              <span><strong>Phản hồi cần xử lý</strong><small>Xác minh sai sót và đề xuất nội dung đúng</small></span>
              <b>{pendingCount}</b>
            </button>
            <button
              type="button"
              className={`senior-review-section ${seniorSection === 'candidates' ? 'is-active' : ''}`}
              aria-pressed={seniorSection === 'candidates'}
              onClick={() => selectSeniorSection('candidates')}
            >
              <CheckCheck size={18} />
              <span><strong>Tri thức chờ duyệt</strong><small>Quyết định nội dung được đưa vào RAG</small></span>
              <b>{candidates.length}</b>
            </button>
            <button
              type="button"
              className={`senior-review-section ${seniorSection === 'history' ? 'is-active' : ''}`}
              aria-pressed={seniorSection === 'history'}
              onClick={() => selectSeniorSection('history')}
            >
              <History size={18} />
              <span><strong>Lịch sử</strong><small>Xem lại các phản hồi đã xử lý</small></span>
              <b>{resolvedReviews.length + reviewedCandidates.length}</b>
            </button>
          </nav>

          <CollectionSearch
            query={collection.query}
            onQueryChange={collection.setQuery}
            filteredCount={collection.filteredCount}
            totalCount={collection.totalCount}
            placeholder={searchPlaceholder}
          />

          {seniorSection === 'feedback' && (
            <section className="review-stage" aria-labelledby="senior-feedback-heading">
              <div className="review-stage__heading">
                <span className="review-stage__step">Bước 1</span>
                <div>
                  <h3 id="senior-feedback-heading">Xác minh phản hồi nghiêm trọng</h3>
                  <p>Đối chiếu câu hỏi, câu trả lời AI và bằng chứng từ sinh viên. Bước này chưa cập nhật RAG.</p>
                </div>
              </div>
              {renderReviewList(collection.visibleItems)}
            </section>
          )}

          {seniorSection === 'candidates' && (
            <section className="review-stage" aria-labelledby="knowledge-candidate-heading">
              <div className="review-stage__heading">
                <span className="review-stage__step">Bước 2</span>
                <div>
                  <h3 id="knowledge-candidate-heading">Phê duyệt tri thức cho RAG</h3>
                  <p>Chỉ nội dung đã đối chiếu và được phê duyệt ở đây mới trở thành tri thức của AI Tutor.</p>
                </div>
              </div>
              {candidatesLoading ? (
                <div className="no-data-text">Đang tải tri thức chờ duyệt...</div>
              ) : (
                <KnowledgeCandidateReviewList
                  candidates={collection.visibleItems}
                  candidateNotes={candidateNotes}
                  canReviewKnowledgeCandidates
                  handleNoteChange={onCandidateNoteChange}
                  handleApproveCandidate={onApproveCandidate}
                  handleRejectCandidate={onRejectCandidate}
                  pendingActionIds={pendingCandidateIds}
                  currentReviewerId={currentReviewerId}
                />
              )}
            </section>
          )}

          {seniorSection === 'history' && (
            <section className="review-stage" aria-labelledby="senior-history-heading">
              <div className="review-stage__heading">
                <span className="review-stage__step review-stage__step--neutral">Lịch sử</span>
                <div>
                  <h3 id="senior-history-heading">Phản hồi đã xử lý</h3>
                  <p>Dùng để đối chiếu quyết định trước đó; không thực hiện lại thao tác phê duyệt.</p>
                </div>
              </div>
              {historyLoading ? (
                <div className="no-data-text">Đang tải lịch sử kiểm duyệt...</div>
                  ) : collection.filteredCount === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={collection.query ? 'Không có lịch sử khớp từ khóa.' : 'Chưa có hoạt động kiểm duyệt nào.'}
                />
              ) : (
                <div className="review-history-sections">
                  {visibleHistoryCandidates.length > 0 && (
                    <section className="review-history-group" aria-labelledby="candidate-history-heading">
                      <div className="review-history-group__heading">
                        <h4 id="candidate-history-heading">Lịch sử tri thức RAG</h4>
                        <span>{visibleHistoryCandidates.length} trên trang này</span>
                      </div>
                      <KnowledgeCandidateReviewList
                        candidates={visibleHistoryCandidates}
                        history
                        currentReviewerId={currentReviewerId}
                      />
                    </section>
                  )}
                  {visibleHistoryReviews.length > 0 && (
                    <section className="review-history-group" aria-labelledby="feedback-history-heading">
                      <div className="review-history-group__heading">
                        <h4 id="feedback-history-heading">Phản hồi AI đã xử lý</h4>
                        <span>{visibleHistoryReviews.length} trên trang này</span>
                      </div>
                      {renderReviewList(visibleHistoryReviews, true)}
                    </section>
                  )}
                </div>
              )}
            </section>
          )}
          {!activeLoading && <CollectionPagination collection={collection} />}
        </>
      ) : (
        <>
          <Segmented
            value={view}
            onChange={selectMentorView}
            options={[
              { label: `Đang chờ (${pendingCount})`, value: 'pending' },
              { label: `Đã xử lý (${resolvedReviews.length})`, value: 'resolved' },
            ]}
          />
          <CollectionSearch
            query={collection.query}
            onQueryChange={collection.setQuery}
            filteredCount={collection.filteredCount}
            totalCount={collection.totalCount}
            placeholder={searchPlaceholder}
          />
          {view === 'resolved'
            ? renderReviewList(visibleHistoryReviews, true)
            : renderReviewList(collection.visibleItems)}
          {!activeLoading && <CollectionPagination collection={collection} />}
        </>
      )}
    </section>
  );
}
