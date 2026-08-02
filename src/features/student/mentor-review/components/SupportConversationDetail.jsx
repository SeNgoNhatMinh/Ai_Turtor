import { Alert, Card, Empty, Space, Spin, Tag, Typography } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import StatusTag from '../../../../components/common/StatusTag';
import StudentMentorFlow from '../../../../components/support/StudentMentorFlow';
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
            <span className="mentor-review-eyebrow">Yêu cầu hỗ trợ</span>
            <Title level={4}>{ticket.questionPreview || 'Chi tiết yêu cầu hỗ trợ'}</Title>
            <Space size={[8, 8]} wrap>
              {ticket.courseId && <Tag color="blue">Môn {ticket.courseId}</Tag>}
              {ticket.classId && <Tag>Lớp {ticket.classId}</Tag>}
              {assignedMentor && <Tag color="green">Giảng viên {assignedMentor}</Tag>}
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
            <ReviewBlock label="Câu trả lời AI trước đó">
              <Paragraph>{aiSnapshot}</Paragraph>
            </ReviewBlock>
          )}

          {mentorAnswer ? (
            <ReviewBlock
              label={assignedMentor ? `Câu trả lời từ ${assignedMentor}` : 'Câu trả lời của giảng viên'}
              tone="answer"
            >
              <Paragraph>{mentorAnswer}</Paragraph>
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
    </Card>
  );
}

export default SupportConversationDetail;
