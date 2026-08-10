import { Alert, Button, Card, Empty, Spin, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import StatusTag from '../../../../components/common/StatusTag';
import { uiCopy } from '../../../../constants/uiCopy';
import {
  formatSupportDateTime,
  getQuestionText,
  isAnsweredTicket,
} from '../mentorSupportUtils';

const { Text } = Typography;

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
    >
      <div className="mentor-ticket-item__top">
        <span className={`mentor-ticket-dot ${answered ? 'is-answered' : ''}`} />
        <Text strong ellipsis className="mentor-ticket-title">{preview}</Text>
      </div>
      <div className="mentor-ticket-meta">
        <span>{formatSupportDateTime(ticket?.updatedAt || ticket?.createdAt)}</span>
        {meta.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="mentor-ticket-footer">
        <StatusTag status={ticket?.status} />
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
  return (
    <Card
      title={uiCopy.student.support.listTitle}
      extra={(
        <Button size="small" icon={<ReloadOutlined />} onClick={onReload} loading={isLoading}>
          Làm mới
        </Button>
      )}
      className="mentor-review-list-card"
      styles={{ body: { padding: 0 } }}
    >
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
      ) : tickets.length ? (
        <div className="mentor-ticket-list">
          {tickets.map((ticket) => (
            <TicketPreview
              key={ticket.id}
              ticket={ticket}
              isActive={selectedTicket?.id === ticket.id}
              onSelect={onSelect}
            />
          ))}
        </div>
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
