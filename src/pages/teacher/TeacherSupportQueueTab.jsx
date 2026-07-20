import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import StatusLabel from '../../components/common/StatusLabel';
import { canReviewKnowledge } from '../../utils/permissions';
import KnowledgeCandidateReviewList from './KnowledgeCandidateReviewList';
import TeacherAnswerModeSelector from './TeacherAnswerModeSelector';
import SupportChatRoom from '../../components/support/SupportChatRoom';
import AnswerReviewCard from '../../features/teacher/review/AnswerReviewCard';

function TeacherSupportQueueTab({
  showEscalations = true,
  isTeacherInboxLoading,
  escalations = [],
  selectedEscalation,
  setSelectedEscalation,
  loadTeacherInbox,
  teacherEscReply,
  setTeacherEscReply,
  onAnswerEsc,
  isTeacherAnswerSubmitting = false,
  createKnowledgeCandidate,
  setCreateKnowledgeCandidate,
  candidateType,
  setCandidateType,
  answerReviews = [],
  isAnswerReviewsLoading = false,
  loadAnswerReviews,
  seniorAnswerReviews = [],
  resolvedAnswerReviews = [],
  isResolvedReviewsLoading = false,
  loadResolvedAnswerReviews,
  pendingCandidateActionIds = [],
  pendingSeniorReviewIds = [],
  handleSeniorResolveReview,
  candidates = [],
  candidateNotes = {},
  handleNoteChange,
  handleApproveCandidate,
  handleRejectCandidate,
  currentUserRole,
  currentUser,
}) {
  const [seniorResolutionDrafts, setSeniorResolutionDrafts] = useState({});
  const [reviewView, setReviewView] = useState('pending');
  const canReviewKnowledgeCandidates = canReviewKnowledge(currentUserRole);
  const selectedStatus = String(selectedEscalation?.status || '').toUpperCase();
  const isSelectedChatActive = ['IN_CHAT', 'CHAT_ACTIVE'].includes(selectedStatus);
  const isSelectedAnswered = selectedStatus.includes('ANSWERED') || ['COMPLETED', 'CLOSED'].includes(selectedStatus);
  const activeReviewQueue = canReviewKnowledgeCandidates ? seniorAnswerReviews : answerReviews;
  const activeQueueType = canReviewKnowledgeCandidates ? 'senior' : 'mentor';

  const updateSeniorDraft = (reviewId, patch) => {
    setSeniorResolutionDrafts((current) => ({
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
    const draft = seniorResolutionDrafts[reviewId] || {};
    const succeeded = await handleSeniorResolveReview(
      reviewId,
      decision,
      String(draft.notes || '').trim(),
      String(draft.correctedAnswer || '').trim(),
      draft.candidateType || 'ACADEMIC_KNOWLEDGE',
    );
    if (succeeded) {
      setSeniorResolutionDrafts((current) => {
        const next = { ...current };
        delete next[reviewId];
        return next;
      });
    }
  };

  return (
    <div className={`${showEscalations ? 'grid-2-cols' : 'teacher-review-single-column'} portal-view`}>
      {showEscalations && <div className="glass-card">
        <div className="card-header">
          <h3>Yêu cầu hỗ trợ của sinh viên</h3>
          <button
            type="button"
            className="btn-small-chat"
            onClick={loadTeacherInbox}
            disabled={isTeacherInboxLoading || !loadTeacherInbox}
          >
            <RefreshCw style={{ width: 12, height: 12 }} /> Làm mới
          </button>
        </div>
        {isTeacherInboxLoading ? (
          <p className="no-data-text">Đang tải hàng chờ hỗ trợ...</p>
        ) : escalations.length === 0 ? (
          <p className="no-data-text">Hiện không có yêu cầu hỗ trợ.</p>
        ) : (
          <div className="escalations-list">
            {escalations.map((esc) => (
              <button
                type="button"
                key={esc.id}
                className={`escalation-card-item ${selectedEscalation?.id === esc.id ? 'active-escalation' : ''}`}
                onClick={() => setSelectedEscalation(esc)}
                disabled={!setSelectedEscalation}
                aria-pressed={selectedEscalation?.id === esc.id}
              >
                <StatusLabel status={esc.status} />
                <h5>{esc.student}: {esc.title}</h5>
                <p className="esc-context">{esc.context}</p>
                <span className="esc-time">{esc.time ? new Date(esc.time).toLocaleString() : '-'}</span>
              </button>
            ))}
          </div>
        )}
        {selectedEscalation?.chatRoomId && isSelectedChatActive && (
          <div className="escalation-chat-reply-box">
            <h5>Trao đổi hỗ trợ trực tiếp</h5>
            <SupportChatRoom
              chatRoomId={selectedEscalation.chatRoomId}
              currentUser={currentUser}
              compact
            />
          </div>
        )}
        {selectedEscalation && !isSelectedChatActive && !isSelectedAnswered && (
          <div className="escalation-chat-reply-box">
            <h5>Đang chờ sinh viên chọn giảng viên</h5>
            <p className="no-data-text" style={{ textAlign: 'left' }}>
              Sinh viên cần chọn một giảng viên phù hợp trước khi backend tạo ChatRoom. Câu trả lời chính thức được gửi sau khi hai bên trao đổi.
            </p>
          </div>
        )}
        {selectedEscalation && isSelectedChatActive && (
          <form className="escalation-chat-reply-box" onSubmit={onAnswerEsc}>
            <h5>Câu trả lời chính thức</h5>
            <div className="escalation-meta-info">
              <strong>Câu hỏi:</strong> {selectedEscalation.question}
            </div>
            <div className="input-group">
              <label htmlFor="teacher-final-answer">Câu trả lời cuối sau khi trao đổi:</label>
              <textarea
                id="teacher-final-answer"
                value={teacherEscReply}
                onChange={(e) => setTeacherEscReply(e.target.value)}
                required
                disabled={isTeacherAnswerSubmitting}
              />
            </div>

            <TeacherAnswerModeSelector
              createKnowledgeCandidate={createKnowledgeCandidate}
              candidateType={candidateType}
              setCreateKnowledgeCandidate={setCreateKnowledgeCandidate}
              setCandidateType={setCandidateType}
              disabled={isTeacherAnswerSubmitting}
            />

            <button
              type="submit"
              className="btn-submit-form"
              disabled={isTeacherAnswerSubmitting || !teacherEscReply.trim()}
            >
              {isTeacherAnswerSubmitting ? 'Đang gửi câu trả lời...' : 'Gửi câu trả lời chính thức'}
            </button>
          </form>
        )}
      </div>}

      <div className="glass-card">
        <div className="card-header">
          <div>
            <h3>{canReviewKnowledgeCandidates ? 'Hàng chờ Senior Mentor kiểm tra' : 'Phản hồi AI cần giảng viên kiểm tra'}</h3>
            <p className="answer-review-section__subtitle">
              {canReviewKnowledgeCandidates
                ? 'Các lỗi nghiêm trọng về kiến thức, nguồn hoặc tài liệu cần Senior Mentor xác minh.'
                : 'Các phản hồi về câu trả lời AI trong môn học cần giảng viên xem xét.'}
            </p>
          </div>
          <button
            type="button"
            className="btn-small-chat"
            onClick={reviewView === 'resolved' ? loadResolvedAnswerReviews : loadAnswerReviews}
            disabled={reviewView === 'resolved'
              ? isResolvedReviewsLoading || !loadResolvedAnswerReviews
              : isAnswerReviewsLoading || !loadAnswerReviews}
            aria-label="Làm mới hàng chờ kiểm tra câu trả lời"
          >
            <RefreshCw style={{ width: 12, height: 12 }} />
          </button>
        </div>
        <div className="answer-review-view-switch" role="tablist" aria-label="Trạng thái phản hồi AI">
          <button
            type="button"
            role="tab"
            aria-selected={reviewView === 'pending'}
            className={reviewView === 'pending' ? 'active' : ''}
            onClick={() => setReviewView('pending')}
          >
            Đang chờ ({activeReviewQueue.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={reviewView === 'resolved'}
            className={reviewView === 'resolved' ? 'active' : ''}
            onClick={() => setReviewView('resolved')}
          >
            Đã xử lý ({resolvedAnswerReviews.length})
          </button>
        </div>
        <div className="answer-review-list">
          {(reviewView === 'resolved' ? isResolvedReviewsLoading : isAnswerReviewsLoading) ? (
            <div className="no-data-text">Đang tải phản hồi câu trả lời...</div>
          ) : (reviewView === 'resolved' ? resolvedAnswerReviews : activeReviewQueue).length === 0 ? (
            <div className="no-data-text">
              {reviewView === 'resolved'
                ? 'Chưa có phản hồi nào đã xử lý trong phạm vi môn học này.'
                : canReviewKnowledgeCandidates
                ? 'Không có lỗi nghiêm trọng đang chờ Senior Mentor.'
                : 'Không có phản hồi AI đang chờ giảng viên kiểm tra.'}
            </div>
          ) : (
            (reviewView === 'resolved' ? resolvedAnswerReviews : activeReviewQueue).map((review) => (
              <AnswerReviewCard
                key={review.id}
                review={review}
                queue={reviewView === 'resolved' ? 'history' : activeQueueType}
                draft={seniorResolutionDrafts[review.id]}
                isPending={pendingSeniorReviewIds.includes(review.id)}
                onDraftChange={(patch) => updateSeniorDraft(review.id, patch)}
                onResolve={(decision) => resolveSeniorReview(review.id, decision)}
              />
            ))
          )}
        </div>

        {canReviewKnowledgeCandidates && (
          <>
            <div className="card-header answer-review-candidate-header">
              <div>
                <h3>Knowledge Candidate</h3>
                <p className="answer-review-section__subtitle">
                  Phê duyệt để đưa vào RAG của môn học, hoặc từ chối mà không làm thay đổi AI.
                </p>
              </div>
            </div>
            <div className="candidates-list">
              <KnowledgeCandidateReviewList
                candidates={candidates}
                candidateNotes={candidateNotes}
                canReviewKnowledgeCandidates={canReviewKnowledgeCandidates}
                handleNoteChange={handleNoteChange}
                handleApproveCandidate={handleApproveCandidate}
                handleRejectCandidate={handleRejectCandidate}
                pendingActionIds={pendingCandidateActionIds}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default TeacherSupportQueueTab;
