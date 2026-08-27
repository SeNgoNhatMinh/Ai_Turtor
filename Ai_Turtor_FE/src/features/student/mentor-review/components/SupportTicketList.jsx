import { useDeferredValue, useMemo, useState } from 'react';
import { Alert, Card, Empty, Input, Spin, Typography } from 'antd';
import { BookOpen, CalendarClock, RefreshCw, Search } from 'lucide-react';
import ActionButton from '../../../../components/common/ActionButton';
import StatusTag from '../../../../components/common/StatusTag';
import { uiCopy } from '../../../../constants/uiCopy';
import {
  formatSupportDateTime,
  getQuestionText,
  isAnsweredTicket,
} from '../mentorSupportUtils';

const { Text } = Typography;

const FILTER_OPTIONS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'waiting', label: 'Đang xử lý' },
  { value: 'answered', label: 'Đã phản hồi' },
];

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
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase('vi'));
  const filteredTickets = useMemo(() => tickets.filter((ticket) => {
    const answered = isAnsweredTicket(ticket);
    if (filter === 'waiting' && answered) return false;
    if (filter === 'answered' && !answered) return false;
    if (!deferredQuery) return true;
    return [
      ticket?.questionPreview,
      ticket?.question,
      ticket?.courseId,
      ticket?.classId,
      ticket?.status,
    ].filter(Boolean).join(' ').toLocaleLowerCase('vi').includes(deferredQuery);
  }), [deferredQuery, filter, tickets]);

  return (
    <Card
      title={(
        <div className="mentor-ticket-list-title">
          <span>{uiCopy.student.support.listTitle}</span>
          <span>{tickets.length}</span>
        </div>
      )}
      extra={(
        <ActionButton
          size="small"
          icon={<RefreshCw size={15} />}
          onClick={onReload}
          loading={isLoading}
          aria-label="Làm mới danh sách yêu cầu"
        >Làm mới</ActionButton>
      )}
      className="mentor-review-list-card"
      styles={{ body: { padding: 0 } }}
    >
      {!error && !isLoading && tickets.length > 0 && (
        <div className="mentor-ticket-toolbar">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            prefix={<Search size={16} aria-hidden="true" />}
            placeholder="Tìm theo câu hỏi, môn hoặc lớp"
            allowClear
            aria-label="Tìm yêu cầu hỗ trợ"
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

      {error ? (
        <Alert
          type="error"
          showIcon
          title="Không thể tải yêu cầu hỗ trợ"
          description={error}
          className="mentor-review-inline-alert"
        />
      ) : isLoading ? (
        <div className="mentor-review-loading"><Spin description="Đang tải yêu cầu..." /></div>
      ) : filteredTickets.length ? (
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
      ) : tickets.length ? (
        <Empty
          description="Không tìm thấy yêu cầu phù hợp"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          className="mentor-review-empty mentor-review-empty--filtered"
        >
          <Text type="secondary">Thử đổi từ khóa hoặc bộ lọc trạng thái.</Text>
        </Empty>
      ) : (
        <Empty
          description={uiCopy.student.support.emptyTitle}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          className="mentor-review-empty"
        >
          <Text type="secondary">{uiCopy.student.support.emptyDescription}</Text>
        </Empty>
      )}
    </Card>
  );
}

export default SupportTicketList;
