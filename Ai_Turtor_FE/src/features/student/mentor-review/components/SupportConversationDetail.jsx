import { Alert, Spin } from 'antd';
import { Bot, Clock3, GraduationCap, ShieldCheck } from 'lucide-react';
import AsyncState from '../../../../components/common/AsyncState';
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

function ReviewBlock({ label, children, tone = 'default', icon = null }) {
  return (
    <section className={`mentor-review-block mentor-review-block--${tone}`}>
      <span>{icon}{label}</span>
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
      <section className="mentor-review-detail-card">
        <AsyncState
          empty
          emptyTitle={uiCopy.student.support.detailEmpty}
          emptyDescription="Chọn một yêu cầu ở danh sách bên trái để xem toàn bộ tiến trình và trao đổi với giảng viên."
        />
      </section>
    );
  }

  const mentorAnswer = getMentorAnswer(ticket);
  const assignedMentor = getAssignedMentor(ticket);
  const aiSnapshot = getAiSnapshot(ticket);
  const status = normalizeSupportStatus(ticket.status);
  const isChatActive = ['IN_CHAT', 'CHAT_ACTIVE', 'MENTOR_SELECTED'].includes(status);

  return (
    <section className="mentor-review-detail-card">
      <div className="mentor-review-detail">
        <div className="mentor-review-detail__header">
          <div>
            <span className="mentor-review-detail__eyebrow">Chi tiết yêu cầu</span>
            <h2>{getQuestionText(ticket)}</h2>
            <p className="mentor-review-detail__hint">Theo dõi câu trả lời và trao đổi trực tiếp với giảng viên.</p>
            <div className="mentor-review-detail__meta">
              {ticket.courseId && <span>Môn {ticket.courseId}</span>}
              {ticket.classId && <span>Lớp {ticket.classId}</span>}
              {assignedMentor && <span>Giảng viên {assignedMentor}</span>}
            </div>
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
              <span className="mentor-review-state-hint">Đang tải nội dung đầy đủ...</span>
            </div>
          )}

          {aiSnapshot && (
            <ReviewBlock label="Câu trả lời AI trước đó" tone="ai" icon={<Bot size={15} />}>
              <div className="mentor-review-markdown">
                <MarkdownRenderer markdown={aiSnapshot} />
              </div>
            </ReviewBlock>
          )}

          {mentorAnswer ? (
            <ReviewBlock
              label={assignedMentor ? `Câu trả lời từ ${assignedMentor}` : 'Câu trả lời của giảng viên'}
              tone="answer"
              icon={<GraduationCap size={15} />}
            >
              <p className="mentor-review-answer-text">{mentorAnswer}</p>
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
                  <Clock3 size={19} aria-hidden="true" />
                  <div>
                    <h3>Đang chờ bắt đầu hỗ trợ</h3>
                    <p>
                      Hệ thống cần tìm giảng viên phụ trách môn/lớp, sau đó bạn chọn giảng viên để mở cuộc trò chuyện hai chiều.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mentor-review-learning-note" role="note">
            <ShieldCheck size={18} aria-hidden="true" />
            <div>
              <strong>Kiểm soát tri thức AI</strong>
              <span>Câu trả lời của giảng viên chỉ được đưa vào RAG sau khi Senior Mentor hoặc Admin phê duyệt.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default SupportConversationDetail;
