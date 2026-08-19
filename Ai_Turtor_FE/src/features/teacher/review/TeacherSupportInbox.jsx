import { useMemo, useState } from 'react';
import { Button, Empty, Segmented, Tag, Input } from 'antd';
import { CheckCircle2, Clock3, MessageCircle, RefreshCw } from 'lucide-react';
import StatusLabel from '../../../components/common/StatusLabel';
import SupportChatRoom from '../../../components/support/SupportChatRoom';
import TeacherAnswerModeSelector from './TeacherAnswerModeSelector';
import KnowledgeAnswerComposer from './KnowledgeAnswerComposer';
import KnowledgeImageGallery from './KnowledgeImageGallery';
import './ReviewWorkspace.css';
import './TeacherSupportInbox.css';

const HISTORY_STATUSES = new Set(['COMPLETED', 'CLOSED', 'CANCELLED']);

const getStatus = (item) => String(item?.status || '').trim().toUpperCase();
const isHistoryItem = (item) => {
  const status = getStatus(item);
  return HISTORY_STATUSES.has(status) || status.includes('ANSWERED');
};

function SupportTicketButton({ item, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`teacher-support-ticket ${selected ? 'is-selected' : ''}`}
      onClick={() => onSelect(item)}
      aria-pressed={selected}
    >
      <div className="teacher-support-ticket__topline">
        <strong>{item.student || 'Sinh viên'}</strong>
        <StatusLabel status={item.status} />
      </div>
      <p>{item.title || item.question || 'Yêu cầu hỗ trợ'}</p>
      <div className="teacher-support-ticket__meta">
        <span>{item.context || '—'}</span>
        <time><Clock3 size={12} /> {item.time ? new Date(item.time).toLocaleString('vi-VN') : '—'}</time>
      </div>
    </button>
  );
}

export default function TeacherSupportInbox({
  currentUser,
  loading = false,
  escalations = [],
  selectedEscalation,
  onSelectEscalation,
  onRefresh,
  onSearch,
  reply,
  onReplyChange,
  replyImages = [],
  onReplyImagesChange,
  onSubmitAnswer,
  isSubmitting = false,
  createKnowledgeCandidate,
  onCreateKnowledgeCandidateChange,
  candidateType,
  onCandidateTypeChange,
}) {
  const [view, setView] = useState('active');
  const grouped = useMemo(() => ({
    active: escalations.filter((item) => !isHistoryItem(item)),
    history: escalations.filter(isHistoryItem),
  }), [escalations]);
  const selectedView = selectedEscalation && isHistoryItem(selectedEscalation) ? 'history' : 'active';
  const effectiveView = selectedEscalation && !grouped[view].some((item) => item.id === selectedEscalation.id)
    ? selectedView
    : view;
  const visibleTickets = grouped[effectiveView];
  const selectedStatus = getStatus(selectedEscalation);
  const isHistorySelection = Boolean(selectedEscalation && isHistoryItem(selectedEscalation));
  const isChatActive = ['IN_CHAT', 'CHAT_ACTIVE', 'MENTOR_SELECTED'].includes(selectedStatus);
  const hasChatHistory = Boolean(selectedEscalation?.chatRoomId);

  const changeView = (nextView) => {
    setView(nextView);
    if (!grouped[nextView].some((item) => item.id === selectedEscalation?.id)) {
      onSelectEscalation?.(grouped[nextView][0] || null);
    }
  };

  return (
    <section className="teacher-support-workspace" aria-labelledby="teacher-support-heading">
      <div className="teacher-support-workspace__heading">
        <div>
          <span className="teacher-review-eyebrow">Hỗ trợ trực tiếp</span>
          <h2 id="teacher-support-heading">Trao đổi với sinh viên</h2>
          <p>Tiếp nhận yêu cầu, trao đổi trong ChatRoom và xem lại toàn bộ lịch sử sau khi đóng.</p>
        </div>
        <div className="teacher-support-toolbar">
          <Input.Search
            placeholder="Tìm kiếm yêu cầu (tên sinh viên hoặc nội dung)..."
            allowClear
            onSearch={(value) => onSearch?.(String(value || '').trim())}
            className="teacher-support-search"
          />
          <Button icon={<RefreshCw size={15} />} loading={loading} onClick={onRefresh}>
            Làm mới
          </Button>
        </div>
      </div>

      <div className="teacher-support-layout">
        <aside className="teacher-support-master" aria-label="Danh sách yêu cầu hỗ trợ">
          <Segmented
            block
            value={effectiveView}
            onChange={changeView}
            options={[
              { label: `Cần xử lý (${grouped.active.length})`, value: 'active' },
              { label: `Lịch sử (${grouped.history.length})`, value: 'history' },
            ]}
          />
          <div className="teacher-support-ticket-list">
            {visibleTickets.length ? visibleTickets.map((item) => (
              <SupportTicketButton
                key={item.id}
                item={item}
                selected={item.id === selectedEscalation?.id}
                onSelect={onSelectEscalation}
              />
            )) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={effectiveView === 'active' ? 'Không có yêu cầu nào cần xử lý.' : 'Chưa có lịch sử trao đổi.'}
              />
            )}
          </div>
        </aside>

        <div className="teacher-support-detail">
          {!selectedEscalation ? (
            <Empty description="Chọn một yêu cầu để xem chi tiết." />
          ) : (
            <>
              <header className="teacher-support-detail__header">
                <div>
                  <span className="teacher-review-eyebrow">Câu hỏi của sinh viên</span>
                  <h3>{selectedEscalation.question || selectedEscalation.title}</h3>
                  <p>{selectedEscalation.student || 'Sinh viên'} · {selectedEscalation.context || '—'}</p>
                </div>
                <Tag icon={<MessageCircle size={13} />} color={hasChatHistory ? 'blue' : 'default'}>
                  {hasChatHistory ? 'Có lịch sử chat' : 'Chưa tạo ChatRoom'}
                </Tag>
              </header>

              {hasChatHistory ? (
                <SupportChatRoom
                  chatRoomId={selectedEscalation.chatRoomId}
                  currentUser={currentUser}
                  compact
                  readOnly={!isChatActive}
                />
              ) : isHistorySelection ? (
                <div className="teacher-support-history">
                  <div className="teacher-support-history__summary">
                    <CheckCircle2 size={20} />
                    <div>
                      <strong>Yêu cầu đã được xử lý</strong>
                      <p>
                        {selectedEscalation.resolvedAt
                          ? `Hoàn tất lúc ${new Date(selectedEscalation.resolvedAt).toLocaleString('vi-VN')}`
                          : 'Bạn đang xem lại một yêu cầu trong lịch sử.'}
                      </p>
                    </div>
                  </div>
                  <section>
                    <span className="teacher-review-eyebrow">Câu hỏi ban đầu</span>
                    <p>{selectedEscalation.originalQuestion || selectedEscalation.question || 'Không có nội dung câu hỏi.'}</p>
                  </section>
                  {selectedEscalation.aiResponse && (
                    <section>
                      <span className="teacher-review-eyebrow">Phản hồi AI trước khi chuyển hỗ trợ</span>
                      <p>{selectedEscalation.aiResponse}</p>
                    </section>
                  )}
                  <section className="teacher-support-history__answer">
                    <span className="teacher-review-eyebrow">Câu trả lời chính thức</span>
                    <p>{selectedEscalation.mentorAnswer || 'Backend chưa trả nội dung câu trả lời chính thức cho bản ghi này.'}</p>
                    <KnowledgeImageGallery images={selectedEscalation.mentorAnswerImages} />
                    {selectedEscalation.assignedMentorName && <small>Giảng viên: {selectedEscalation.assignedMentorName}</small>}
                  </section>
                </div>
              ) : (
                <div className="teacher-support-detail__notice">
                  <strong>Đang chờ sinh viên chọn giảng viên</strong>
                  <p>ChatRoom chỉ được tạo sau khi sinh viên chọn một giảng viên phù hợp.</p>
                </div>
              )}

              {isChatActive && (
                <form className="teacher-final-answer" onSubmit={onSubmitAnswer}>
                  <div>
                    <span className="teacher-review-eyebrow">Kết luận chính thức</span>
                    <h3>Chốt câu trả lời sau khi trao đổi</h3>
                    <p>Phần này khác tin nhắn chat thông thường và sẽ cập nhật trạng thái escalation.</p>
                  </div>
                  <label htmlFor="teacher-final-answer">Câu trả lời cuối sau khi trao đổi:</label>
                  <KnowledgeAnswerComposer
                    id="teacher-final-answer"
                    value={reply}
                    images={replyImages}
                    required
                    disabled={isSubmitting}
                    placeholder="Viết câu trả lời đầy đủ cho sinh viên. Có thể dán hoặc tải hình minh họa cho sơ đồ, mô hình..."
                    onChange={onReplyChange}
                    onImagesChange={onReplyImagesChange}
                  />
                  <TeacherAnswerModeSelector
                    createKnowledgeCandidate={createKnowledgeCandidate}
                    candidateType={candidateType}
                    setCreateKnowledgeCandidate={onCreateKnowledgeCandidateChange}
                    setCandidateType={onCandidateTypeChange}
                    disabled={isSubmitting}
                  />
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={isSubmitting}
                    disabled={isSubmitting || !reply.trim()}
                    aria-label={isSubmitting ? 'Đang gửi câu trả lời...' : 'Gửi câu trả lời chính thức'}
                  >
                    {isSubmitting ? 'Đang gửi câu trả lời...' : 'Gửi câu trả lời chính thức'}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
