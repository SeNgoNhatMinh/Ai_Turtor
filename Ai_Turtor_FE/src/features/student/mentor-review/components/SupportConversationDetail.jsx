import { Alert, Card, Empty, Space, Spin, Tag, Typography } from 'antd';
import StatusTag from '../../../../components/common/StatusTag';
import MarkdownRenderer from '../../../../components/markdown/MarkdownRenderer';
import StudentMentorFlow from '../../../../components/support/StudentMentorFlow';
import KnowledgeImageGallery from '../../../teacher/review/KnowledgeImageGallery';
import { uiCopy } from '../../../../constants/uiCopy';
import {
  getAiSnapshot,
  getAssignedMentor,
  getMentorAnswer,
  getQuestionText,
  normalizeSupportStatus,
} from '../mentorSupportUtils';

const { Paragraph, Text, Title } = Typography;

function ReviewBlock({ label, children, tone = 'default' }) {
  return (
    <section className={`mentor-review-block mentor-review-block--${tone}`}>
      <span>{label}</span>
      <div>{children}</div>
    </section>
  );
}

function SupportConversationDetail({
  ticket,
  isLoading,
  error,
  currentUser,
  onEscalationChange,
}) {
  if (!ticket) {
    return (
      <Card className="mentor-review-detail-card" styles={{ body: { padding: 0 } }}>
        <Empty description={uiCopy.student.support.detailEmpty} className="mentor-review-detail-empty">
          <Text type="secondary">
            Chọn một yêu cầu để xem câu hỏi, câu trả lời AI trước đó, phản hồi của giảng viên và trạng thái kiểm duyệt.
          </Text>
        </Empty>
      </Card>
    );
  }

  const mentorAnswer = getMentorAnswer(ticket);
  const assignedMentor = getAssignedMentor(ticket);
  const aiSnapshot = getAiSnapshot(ticket);
  const status = normalizeSupportStatus(ticket.status);
  const isChatActive = ['IN_CHAT', 'CHAT_ACTIVE', 'MENTOR_SELECTED'].includes(status);

  return (
    <Card className="mentor-review-detail-card" styles={{ body: { padding: 0 } }}>
      <div className="mentor-review-detail">
        <div className="mentor-review-detail__header">
          <div>
            <Title level={4}>{ticket.questionPreview || 'Chi tiết yêu cầu hỗ trợ'}</Title>
            <Space size={[8, 8]} wrap>
              {ticket.courseId && <Tag>Môn {ticket.courseId}</Tag>}
              {ticket.classId && <Tag>Lớp {ticket.classId}</Tag>}
              {assignedMentor && <Tag>Giảng viên {assignedMentor}</Tag>}
            </Space>
          </div>
          <StatusTag status={ticket.status} />
        </div>

        <div className="mentor-review-content">
          {error && (
            <Alert
              type="warning"
              showIcon
              title="Không thể tải đầy đủ yêu cầu"
              description={error}
            />
          )}
          {isLoading && (
            <div className="mentor-review-detail-loading">
              <Spin size="small" />
              <Text type="secondary">Đang tải nội dung đầy đủ...</Text>
            </div>
          )}

          <ReviewBlock label="Câu hỏi của sinh viên" tone="question">
            <Paragraph className="mentor-review-question-text">{getQuestionText(ticket)}</Paragraph>
          </ReviewBlock>

          {aiSnapshot && (
            <ReviewBlock label="Câu trả lời AI trước đó" tone="ai">
              <div className="mentor-review-markdown">
                <MarkdownRenderer markdown={aiSnapshot} />
              </div>
            </ReviewBlock>
          )}

          {mentorAnswer ? (
            <ReviewBlock
              label={assignedMentor ? `Câu trả lời từ ${assignedMentor}` : 'Câu trả lời của giảng viên'}
              tone="answer"
            >
              <Paragraph>{mentorAnswer}</Paragraph>
              <KnowledgeImageGallery images={ticket.mentorAnswerImages} />
            </ReviewBlock>
          ) : (
            <>
              <StudentMentorFlow
                key={ticket.id}
                escalation={ticket}
                currentUser={currentUser}
                onEscalationChange={onEscalationChange}
              />
              {!isChatActive && (
                <div className="mentor-review-waiting">
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

          <div className="mentor-review-learning-note" role="note">
            <strong>Về tri thức AI</strong>
            <span>Câu trả lời của giảng viên chỉ được đưa vào RAG sau khi Senior Mentor hoặc Admin phê duyệt.</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default SupportConversationDetail;
