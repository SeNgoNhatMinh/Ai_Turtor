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
  || 'No question text available.'
);

const getAiSnapshot = (ticket) => (
  ticket?.aiResponse
  || ticket?.aiAnswer
  || ticket?.answerSnapshot
  || ticket?.aiSnapshot
  || ''
);

const formatDateTime = (value) => {
  if (!value) return 'No timestamp';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No timestamp';
  return date.toLocaleString('en-US', {
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
    ticket?.courseId && `Course ${ticket.courseId}`,
    ticket?.classId && `Class ${ticket.classId}`,
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
        {answered ? <Tag color="green">Answered</Tag> : <Tag color="orange">Waiting</Tag>}
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
          extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadEscalations} loading={isEscalationsLoading}>Refresh</Button>}
          className="mentor-review-list-card"
          styles={{ body: { padding: 0 } }}
        >
          {escalationsError ? (
            <Alert
              type="error"
              showIcon
              message="Unable to load mentor review tickets"
              description={escalationsError}
              className="mentor-review-inline-alert"
            />
          ) : isEscalationsLoading ? (
            <div className="mentor-review-loading"><Spin description="Loading tickets..." /></div>
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
                  <span className="mentor-review-eyebrow">Review ticket</span>
                  <Title level={4}>{selectedTicket.questionPreview || 'Mentor Review Ticket'}</Title>
                  <Space size={[8, 8]} wrap>
                    {selectedTicket.id && <Tag>Ticket {selectedTicket.id}</Tag>}
                    {selectedTicket.courseId && <Tag color="blue">Course {selectedTicket.courseId}</Tag>}
                    {selectedTicket.classId && <Tag>Class {selectedTicket.classId}</Tag>}
                    {assignedMentor && <Tag color="green">Mentor {assignedMentor}</Tag>}
                  </Space>
                </div>
                <StatusTag status={selectedTicket.status} />
              </div>

              <div className="mentor-review-content">
                {escalationDetailError && (
                  <Alert
                    type="warning"
                    showIcon
                    message="The complete ticket could not be loaded"
                    description={escalationDetailError}
                  />
                )}
                {isEscalationDetailLoading && (
                  <div className="mentor-review-detail-loading">
                    <Spin size="small" />
                    <Text type="secondary">Loading complete ticket...</Text>
                  </div>
                )}
                <ReviewBlock label="Student question" tone="question">
                  <Paragraph className="mentor-review-question-text">
                    {getQuestionText(selectedTicket)}
                  </Paragraph>
                </ReviewBlock>

                {getAiSnapshot(selectedTicket) && (
                  <ReviewBlock label="AI answer snapshot">
                    <Paragraph>{getAiSnapshot(selectedTicket)}</Paragraph>
                  </ReviewBlock>
                )}

                {mentorAnswer ? (
                  <ReviewBlock label={assignedMentor ? `Mentor answer from ${assignedMentor}` : 'Mentor answer'} tone="answer">
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
                          <Title level={5}>Teacher support is waiting to start</Title>
                          <Paragraph>
                            Find the teacher assigned to this course and class, then select them to open the two-way support chat.
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
                  message="AI learning is protected"
                  description="Mentor answers are not added to AI knowledge automatically. Only senior/admin-approved Knowledge Candidates are indexed into the course RAG knowledge base."
                />
              </div>
            </div>
          ) : (
            <Empty description={uiCopy.student.support.detailEmpty} className="mentor-review-detail-empty">
              <Text type="secondary">Choose a ticket to see the question, AI snapshot, mentor answer, and learning-review status.</Text>
            </Empty>
          )}
        </Card>
      </div>
    </div>
  );
}

export default MentorSupport;
