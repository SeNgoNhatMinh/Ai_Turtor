import { useDeferredValue, useMemo, useState } from 'react';
import { BookOpen, CalendarClock, RefreshCw } from 'lucide-react';
import ActionButton from '../../../../components/common/ActionButton';
import AsyncState from '../../../../components/common/AsyncState';
import { CollectionSearch } from '../../../../components/common/CollectionControls';
import StatusTag from '../../../../components/common/StatusTag';
import { uiCopy } from '../../../../constants/uiCopy';
import { matchesCollectionQuery } from '../../../../hooks/useCollectionView';
import {
  formatSupportDateTime,
  getQuestionText,
  isAnsweredTicket,
} from '../mentorSupportUtils';

const FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'waiting', label: 'Đang xử lý' },
  { value: 'answered', label: 'Đã phản hồi' },
];

const TICKET_SEARCH_KEYS = Object.freeze([
  'questionPreview',
  'question',
  'courseId',
  'classId',
  'status',
]);

function TicketPreview({ ticket, isActive, onSelect }) {
  const question = getQuestionText(ticket);
  const preview = ticket?.questionPreview || ticket?.question || question;
  const answered = isAnsweredTicket(ticket);
  const meta = [
    ticket?.courseId && `Môn ${ticket.courseId}`,
    ticket?.classId && `Lớp ${ticket.classId}`,
  ].filter(Boolean);

  return (
    <button
      type="button"
      className={`mentor-ticket-item ${isActive ? 'is-active' : ''}`}
      onClick={() => onSelect(ticket)}
      aria-pressed={isActive}
    >
      <div className="mentor-ticket-item__top">
        <span className={`mentor-ticket-dot ${answered ? 'is-answered' : ''}`} />
        <span className="mentor-ticket-title">{preview}</span>
      </div>
      <div className="mentor-ticket-meta">
        <span><CalendarClock size={13} />{formatSupportDateTime(ticket?.updatedAt || ticket?.createdAt)}</span>
        {meta.map((item) => <span key={item}><BookOpen size={13} />{item}</span>)}
      </div>
      <div className="mentor-ticket-footer">
        <StatusTag status={ticket?.status} />
        <span className="mentor-ticket-open-label">Xem chi tiết <span aria-hidden="true">→</span></span>
      </div>
    </button>
  );
}

function SupportTicketList({
  tickets,
  selectedTicket,
  isLoading,
  error,
  onReload,
  onSelect,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const deferredQuery = useDeferredValue(query);
  const filteredTickets = useMemo(() => tickets.filter((ticket) => {
    const answered = isAnsweredTicket(ticket);
    if (filter === 'waiting' && answered) return false;
    if (filter === 'answered' && !answered) return false;
    if (!deferredQuery) return true;
    return matchesCollectionQuery(ticket, deferredQuery, TICKET_SEARCH_KEYS);
  }), [deferredQuery, filter, tickets]);

  return (
    <section className="mentor-review-list-card" aria-label={uiCopy.student.support.listTitle}>
      <header className="mentor-review-panel-header">
        <div className="mentor-ticket-list-title">
          <div>
            <strong>{uiCopy.student.support.listTitle}</strong>
            <small>Chọn một yêu cầu để xem tiến trình hỗ trợ</small>
          </div>
          <span>{tickets.length}</span>
        </div>
        <ActionButton
          size="small"
          icon={<RefreshCw size={15} />}
          onClick={onReload}
          loading={isLoading}
          aria-label="Làm mới danh sách yêu cầu"
        >Làm mới</ActionButton>
      </header>

      <div className="mentor-review-list-body">
        {!error && !isLoading && tickets.length > 0 && (
          <div className="mentor-ticket-toolbar">
            <CollectionSearch
              query={query}
              onQueryChange={setQuery}
              filteredCount={filteredTickets.length}
              totalCount={tickets.length}
              placeholder="Tìm theo câu hỏi, môn hoặc lớp"
            />
            <div className="mentor-ticket-filters" role="group" aria-label="Lọc yêu cầu hỗ trợ">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={filter === option.value ? 'is-active' : ''}
                  onClick={() => setFilter(option.value)}
                  aria-pressed={filter === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <AsyncState
          loading={isLoading}
          loadingLabel="Đang tải yêu cầu hỗ trợ..."
          error={error}
          empty={!isLoading && !error && filteredTickets.length === 0}
          emptyTitle={tickets.length ? 'Không tìm thấy yêu cầu phù hợp' : uiCopy.student.support.emptyTitle}
          emptyDescription={tickets.length ? 'Thử đổi từ khóa hoặc bộ lọc trạng thái.' : uiCopy.student.support.emptyDescription}
          onRetry={onReload}
          compact
        >
          <div className="mentor-ticket-list">
            {filteredTickets.map((ticket) => (
              <TicketPreview
                key={ticket.id}
                ticket={ticket}
                isActive={selectedTicket?.id === ticket.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        </AsyncState>
      </div>
    </section>
  );
}

export default SupportTicketList;
