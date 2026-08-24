import { memo, useMemo, useState } from 'react';
import { Button, Empty, Segmented, Tag, Input } from 'antd';
import {
  CheckCircle2,
  Clock3,
  Inbox,
  MessageCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import ActionButton from '../../../components/common/ActionButton';
import { confirmDanger } from '../../../components/common/confirmDialog';
import StatusLabel from '../../../components/common/StatusLabel';
import SupportChatRoom from '../../../components/support/SupportChatRoom';
import TeacherAnswerModeSelector from './TeacherAnswerModeSelector';
import KnowledgeAnswerComposer from './KnowledgeAnswerComposer';
import KnowledgeImageGallery from './KnowledgeImageGallery';
import './ReviewWorkspace.css';
import './TeacherSupportInbox.css';

const HISTORY_STATUSES = new Set(['COMPLETED', 'CLOSED', 'CANCELLED']);
const TICKET_BATCH_SIZE = 40;

const getStatus = (item) => String(item?.status || '').trim().toUpperCase();
const isHistoryItem = (item) => {
  const status = getStatus(item);
  return HISTORY_STATUSES.has(status) || status.includes('ANSWERED');
};

const SupportTicketButton = memo(function SupportTicketButton({ item, selected, onSelect, onDelete, deleting }) {
  const requestDelete = (event) => {
    event.stopPropagation();
    const anchorRect = event.currentTarget.getBoundingClientRect();
    confirmDanger({
      title: 'Xoá ticket khỏi hộp thư?',
      content: 'Ticket chỉ bị ẩn khỏi hộp thư của bạn. Sinh viên vẫn giữ và xem được toàn bộ lịch sử hỗ trợ.',
      okText: 'Xoá khỏi hộp thư',
      cancelText: 'Huỷ',
      anchorRect,
      onOk: () => onDelete?.(item.id),
    });
  };

  return (
    <article
      className={`teacher-support-ticket ${selected ? 'is-selected' : ''}`}
    >
      <button
        type="button"
        className="teacher-support-ticket__select"
        onClick={() => onSelect(item)}
        aria-pressed={selected}
      >
        <span className="teacher-support-ticket__icon" aria-hidden="true">
          <MessageCircle size={16} />
        </span>
        <span className="teacher-support-ticket__body">
          <span className="teacher-support-ticket__topline">
            <strong>{item.student || 'Sinh viên'}</strong>
          </span>
          <p>{item.title || item.question || 'Yêu cầu hỗ trợ'}</p>
          <span className="teacher-support-ticket__context">{item.context || 'Chưa có thông tin môn học'}</span>
          <span className="teacher-support-ticket__footer">
            <StatusLabel status={item.status} className="teacher-support-ticket__status" />
            <time><Clock3 size={12} /> {item.time ? new Date(item.time).toLocaleString('vi-VN') : '—'}</time>
          </span>
        </span>
      </button>
      <ActionButton
        intent="text"
        danger
        className="teacher-support-ticket__delete"
        icon={<Trash2 size={14} />}
        loading={deleting}
        disabled={deleting}
        aria-label="Xoá ticket khỏi hộp thư"
        title={`Xoá ticket của ${item.student || 'sinh viên'} khỏi hộp thư teacher`}
        onClick={requestDelete}
      />
    </article>
  );
});

export default function TeacherSupportInbox({
  currentUser,
  loading = false,
  escalations = [],
  selectedEscalation,
  onSelectEscalation,
  onRefresh,
  onSearch,
  onDeleteEscalation,
  deletingEscalationIds = [],
  reply,
  onReplyChange,
  replyImages = [],
  onReplyImagesChange,
  onSubmitAnswer,
  onAnswerIndexed,
  isSubmitting = false,
  createKnowledgeCandidate,
  onCreateKnowledgeCandidateChange,
  candidateType,
  onCandidateTypeChange,
}) {
  const [view, setView] = useState('active');
  const [visibleLimit, setVisibleLimit] = useState(TICKET_BATCH_SIZE);
  const grouped = useMemo(() => ({
    active: escalations.filter((item) => !isHistoryItem(item)),
    history: escalations.filter(isHistoryItem),
  }), [escalations]);
  const selectedView = selectedEscalation && isHistoryItem(selectedEscalation) ? 'history' : 'active';
  const effectiveView = selectedEscalation && !grouped[view].some((item) => item.id === selectedEscalation.id)
    ? selectedView
    : view;
  const visibleTickets = grouped[effectiveView];
  const renderedTickets = visibleTickets.slice(0, visibleLimit);
  const selectedStatus = getStatus(selectedEscalation);
  const isHistorySelection = Boolean(selectedEscalation && isHistoryItem(selectedEscalation));
  const isChatActive = ['IN_CHAT', 'CHAT_ACTIVE', 'MENTOR_SELECTED'].includes(selectedStatus);
  const hasChatHistory = Boolean(selectedEscalation?.chatRoomId);

  const changeView = (nextView) => {
    setView(nextView);
    setVisibleLimit(TICKET_BATCH_SIZE);
    if (!grouped[nextView].some((item) => item.id === selectedEscalation?.id)) {
      onSelectEscalation?.(grouped[nextView][0] || null);
    }
  };

  return (
    <section className="teacher-support-workspace" aria-labelledby="teacher-support-heading">
      <div className="teacher-support-workspace__heading">
        <div className="teacher-support-heading-copy">
          <span className="teacher-support-heading-icon" aria-hidden="true"><Inbox size={20} /></span>
          <div>
            <span className="teacher-review-eyebrow">Trung tâm trao đổi</span>
            <h2 id="teacher-support-heading">Hộp thư hỗ trợ</h2>
            <p>
              {grouped.active.length
                ? `${grouped.active.length} yêu cầu cần theo dõi và phản hồi`
                : 'Không có yêu cầu đang mở. Bạn có thể xem lại lịch sử đã xử lý.'}
            </p>
          </div>
        </div>
        <div className="teacher-support-toolbar">
          <Input.Search
            placeholder="Tìm sinh viên hoặc nội dung yêu cầu"
            allowClear
            onSearch={(value) => onSearch?.(String(value || '').trim())}
            className="teacher-support-search"
            aria-label="Tìm sinh viên hoặc nội dung yêu cầu"
          />
          <ActionButton icon={<RefreshCw size={15} />} loading={loading} onClick={onRefresh}>
            Làm mới
          </ActionButton>
        </div>
      </div>

      <div className="teacher-support-layout">
        <aside className="teacher-support-master" aria-label="Danh sách yêu cầu hỗ trợ">
          <div className="teacher-support-master__header">
            <div>
              <strong>Danh sách yêu cầu</strong>
              <span>{visibleTickets.length} ticket</span>
            </div>
            <Segmented
              block
              value={effectiveView}
              onChange={changeView}
              options={[
                { label: `Đang mở ${grouped.active.length}`, value: 'active' },
                { label: `Đã xử lý ${grouped.history.length}`, value: 'history' },
              ]}
            />
          </div>
          <div className="teacher-support-ticket-list">
            {visibleTickets.length ? (
              <>
                {renderedTickets.map((item) => (
                  <SupportTicketButton
                    key={item.id}
                    item={item}
                    selected={item.id === selectedEscalation?.id}
                    onSelect={onSelectEscalation}
                    onDelete={onDeleteEscalation}
                    deleting={deletingEscalationIds.includes(item.id)}
                  />
                ))}
                {renderedTickets.length < visibleTickets.length && (
                  <button
                    type="button"
                    className="teacher-support-ticket-list__more"
                    onClick={() => setVisibleLimit((current) => current + TICKET_BATCH_SIZE)}
                  >
                    Xem thêm {Math.min(TICKET_BATCH_SIZE, visibleTickets.length - renderedTickets.length)} ticket
                  </button>
                )}
              </>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={effectiveView === 'active' ? 'Không có yêu cầu nào cần xử lý.' : 'Chưa có lịch sử trao đổi.'}
              />
            )}
          </div>
        </aside>

        <div className="teacher-support-detail">
          {!selectedEscalation ? (
            <div className="teacher-support-detail__empty">
              <span className="teacher-support-detail__empty-icon"><MessageCircle size={25} /></span>
              <strong>Chọn ticket để bắt đầu</strong>
              <span>Xem câu hỏi, trao đổi với sinh viên hoặc đọc lại lịch sử hỗ trợ tại đây.</span>
            </div>
          ) : (
            <>
              <header className="teacher-support-detail__header">
                <div className="teacher-support-detail__title">
                  <span className="teacher-support-detail__question-icon" aria-hidden="true"><MessageCircle size={18} /></span>
                  <div>
                    <span className="teacher-review-eyebrow">Câu hỏi của sinh viên</span>
                    <h3>{selectedEscalation.question || selectedEscalation.title}</h3>
                    <p>{selectedEscalation.student || 'Sinh viên'} · {selectedEscalation.context || '—'}</p>
                  </div>
                </div>
                <div className="teacher-support-detail__badges">
                  <StatusLabel status={selectedEscalation.status} />
                  <Tag icon={<MessageCircle size={13} />} color={hasChatHistory ? 'blue' : 'default'}>
                    {hasChatHistory ? 'Có lịch sử chat' : 'Chưa tạo ChatRoom'}
                  </Tag>
                </div>
              </header>

              {hasChatHistory ? (
                <SupportChatRoom
                  chatRoomId={selectedEscalation.chatRoomId}
                  currentUser={currentUser}
                  compact
                  readOnly={!isChatActive}
                  onAnswerIndexed={onAnswerIndexed}
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
                    <p>Nếu đã dùng nút “Gửi + gửi senior duyệt” trong chat thì không cần viết lại phần này. Form này vẫn dùng khi muốn chốt đáp án ngoài khung chat.</p>
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
