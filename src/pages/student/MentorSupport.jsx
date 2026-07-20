import { Alert, Button, Card, Empty, Space, Spin, Tag, Typography } from 'antd';
import {
  ReloadOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import StatusTag from '../../components/common/StatusTag';
import StudentMentorFlow from '../../components/support/StudentMentorFlow';
import { uiCopy } from '../../constants/uiCopy';

const { Paragraph, Text, Title } = Typography;

const getMentorAnswer = (ticket) => (
  ticket?.mentorAnswer
  || ticket?.answer
  || ticket?.teacherAnswer
  || ticket?.response
  || ticket?.mentorResponse
  || ''
);

const getAssignedMentor = (ticket) => (
  ticket?.assignedMentorName
  || ticket?.mentorName
  || ticket?.teacherName
  || ''
);

const getQuestionText = (ticket) => (
  ticket?.originalQuestion
  || ticket?.question
  || ticket?.questionPreview
  || ticket?.title
  || 'Không có nội dung câu hỏi.'
);

const getAiSnapshot = (ticket) => (
  ticket?.aiResponse
  || ticket?.aiAnswer
  || ticket?.answerSnapshot
  || ticket?.aiSnapshot
  || ''
);

const formatDateTime = (value) => {
  if (!value) return 'Chưa có thời gian';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có thời gian';
  return date.toLocaleString('vi-VN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const normalizeStatus = (status) => String(status || '').toUpperCase();

const isAnsweredTicket = (ticket) => {
  const status = normalizeStatus(ticket?.status);
  return Boolean(getMentorAnswer(ticket))
    || status.includes('ANSWERED')
    || status.includes('COMPLETED')
    || status.includes('CLOSED');
};

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
        <Text strong ellipsis className="mentor-ticket-title">
          {preview}
        </Text>
      </div>
      <Paragraph ellipsis={{ rows: 2 }} className="mentor-ticket-question">
        {preview}
      </Paragraph>
      <div className="mentor-ticket-meta">
        <span>{formatDateTime(ticket?.updatedAt || ticket?.createdAt)}</span>
        {meta.map((item) => <span key={item}>{item}</span>)}
      </div>
      <div className="mentor-ticket-footer">
        <StatusTag status={ticket?.status} />
        {answered ? <Tag color="green">Đã trả lời</Tag> : <Tag color="orange">Đang chờ</Tag>}
      </div>
    </button>
  );
}

function ReviewBlock({ label, children, tone = 'default' }) {
  return (
    <section className={`mentor-review-block mentor-review-block--${tone}`}>
      <span>{label}</span>
      <div>{children}</div>
    </section>
  );
}

function MentorSupport({
  escalations = [],
  selectedEscalation,
  isEscalationsLoading,
  isEscalationDetailLoading,
  escalationsError,
  escalationDetailError,
  loadEscalations,
  onSelectEscalation,
  onEscalationChange,
  currentUser,
}) {
  const safeTickets = Array.isArray(escalations) ? escalations : [];
  const selectedTicket = selectedEscalation || safeTickets[0] || null;
  const mentorAnswer = getMentorAnswer(selectedTicket);
  const assignedMentor = getAssignedMentor(selectedTicket);

  return (
    <div className="portal-section mentor-review-page">
      <PageHeader title={uiCopy.student.support.title} description={uiCopy.student.support.subtitle} />

      <div className="mentor-review-layout">
        <Card
          title={uiCopy.student.support.listTitle}
          extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadEscalations} loading={isEscalationsLoading}>Làm mới</Button>}
          className="mentor-review-list-card"
          styles={{ body: { padding: 0 } }}
        >
          {escalationsError ? (
            <Alert
              type="error"
              showIcon
              title="Không thể tải yêu cầu hỗ trợ"
              description={escalationsError}
              className="mentor-review-inline-alert"
            />
          ) : isEscalationsLoading ? (
            <div className="mentor-review-loading"><Spin description="Đang tải yêu cầu..." /></div>
          ) : safeTickets.length ? (
            <div className="mentor-ticket-list">
              {safeTickets.map((ticket) => (
                <TicketPreview
                  key={ticket.id}
                  ticket={ticket}
                  isActive={selectedTicket?.id === ticket.id}
                  onSelect={onSelectEscalation}
                />
              ))}
            </div>
          ) : (
            <Empty description={uiCopy.student.support.emptyTitle} image={Empty.PRESENTED_IMAGE_SIMPLE} className="mentor-review-empty">
              <Text type="secondary">{uiCopy.student.support.emptyDescription}</Text>
            </Empty>
          )}
        </Card>

        <Card className="mentor-review-detail-card" styles={{ body: { padding: 0 } }}>
          {selectedTicket ? (
            <div className="mentor-review-detail">
              <div className="mentor-review-detail__header">
                <div>
                  <span className="mentor-review-eyebrow">Yêu cầu hỗ trợ</span>
                  <Title level={4}>{selectedTicket.questionPreview || 'Chi tiết yêu cầu hỗ trợ'}</Title>
                  <Space size={[8, 8]} wrap>
                    {selectedTicket.courseId && <Tag color="blue">Môn {selectedTicket.courseId}</Tag>}
                    {selectedTicket.classId && <Tag>Lớp {selectedTicket.classId}</Tag>}
                    {assignedMentor && <Tag color="green">Giảng viên {assignedMentor}</Tag>}
                  </Space>
                </div>
                <StatusTag status={selectedTicket.status} />
              </div>

              <div className="mentor-review-content">
                {escalationDetailError && (
                  <Alert
                    type="warning"
                    showIcon
                    title="Không thể tải đầy đủ yêu cầu"
                    description={escalationDetailError}
                  />
                )}
                {isEscalationDetailLoading && (
                  <div className="mentor-review-detail-loading">
                    <Spin size="small" />
                    <Text type="secondary">Đang tải nội dung đầy đủ...</Text>
                  </div>
                )}
                <ReviewBlock label="Câu hỏi của sinh viên" tone="question">
                  <Paragraph className="mentor-review-question-text">
                    {getQuestionText(selectedTicket)}
                  </Paragraph>
                </ReviewBlock>

                {getAiSnapshot(selectedTicket) && (
                  <ReviewBlock label="Câu trả lời AI trước đó">
                    <Paragraph>{getAiSnapshot(selectedTicket)}</Paragraph>
                  </ReviewBlock>
                )}

                {mentorAnswer ? (
                  <ReviewBlock label={assignedMentor ? `Câu trả lời từ ${assignedMentor}` : 'Câu trả lời của giảng viên'} tone="answer">
                    <Paragraph>{mentorAnswer}</Paragraph>
                  </ReviewBlock>
                ) : (
                  <>
                    <StudentMentorFlow
                      key={selectedTicket.id}
                      escalation={selectedTicket}
                      currentUser={currentUser}
                      onEscalationChange={onEscalationChange}
                    />
                    {!['IN_CHAT', 'CHAT_ACTIVE', 'MENTOR_SELECTED'].includes(normalizeStatus(selectedTicket?.status)) && (
                      <div className="mentor-review-waiting">
                        <RobotOutlined />
                        <div>
                          <Title level={5}>Đang chờ bắt đầu hỗ trợ</Title>
                          <Paragraph>
                            Hệ thống cần tìm giảng viên phụ trách môn/lớp, sau đó bạn chọn giảng viên để mở cuộc trò chuyện hai chiều.
                          </Paragraph>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <Alert
                  type="success"
                  showIcon
                  className="mentor-review-learning-note"
                  title="Tri thức AI được kiểm soát"
                  description="Câu trả lời của giảng viên không tự động được thêm vào AI. Chỉ Knowledge Candidate được Senior Mentor hoặc Admin phê duyệt mới được đưa vào RAG của môn học."
                />
              </div>
            </div>
          ) : (
            <Empty description={uiCopy.student.support.detailEmpty} className="mentor-review-detail-empty">
              <Text type="secondary">Chọn một yêu cầu để xem câu hỏi, câu trả lời AI trước đó, phản hồi của giảng viên và trạng thái kiểm duyệt.</Text>
            </Empty>
          )}
        </Card>
      </div>
    </div>
  );
}

export default MentorSupport;
