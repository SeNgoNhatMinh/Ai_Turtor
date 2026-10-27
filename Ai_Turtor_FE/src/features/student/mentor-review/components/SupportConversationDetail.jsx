import { Alert, Skeleton } from 'antd';
import { Bot, Clock3, GraduationCap, MessageSquareText, ShieldCheck } from 'lucide-react';
import AsyncState from '../../../../components/common/AsyncState';
import StatusTag from '../../../../components/common/StatusTag';
import MarkdownRenderer from '../../../../components/markdown/MarkdownRenderer';
import StudentMentorFlow from '../../../../components/support/StudentMentorFlow';
import KnowledgeImageGallery from '../../../teacher/review/KnowledgeImageGallery';
import { uiCopy } from '../../../../constants/uiCopy';
import {
  describeSupportQuestion,
  getAiSnapshot,
  getAssignedMentor,
  getMentorAnswer,
  getSupportTicketStatus,
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

function QuizItemSummary({ item, index, total }) {
  return (
    <article className="mentor-review-quiz-item">
      <h4>{total > 1 ? `Câu ${index + 1}` : 'Câu kiểm tra'}</h4>
      <div className="mentor-review-markdown">
        <MarkdownRenderer markdown={item.question} />
      </div>
      {item.options.length > 0 && (
        <ul className="mentor-review-quiz-item__options">
          {item.options.map((option) => <li key={option}>{option}</li>)}
        </ul>
      )}
      <dl className="mentor-review-quiz-item__result">
        {item.chosen && (<><dt>Bạn chọn</dt><dd className="is-wrong">{item.chosen}</dd></>)}
        {item.correct && (<><dt>Đáp án đúng</dt><dd className="is-correct">{item.correct}</dd></>)}
        {item.reason && (<><dt>Giải thích</dt><dd>{item.reason}</dd></>)}
      </dl>
    </article>
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
          loading={isLoading}
          loadingLabel="Đang tải yêu cầu hỗ trợ..."
          error={error}
          empty={!isLoading && !error}
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
  const question = describeSupportQuestion(ticket);

  return (
    <section className="mentor-review-detail-card">
      <div className="mentor-review-detail">
        <div className="mentor-review-detail__header">
          <div>
            <span className="mentor-review-detail__eyebrow">Chi tiết yêu cầu</span>
            <h2>{question.title}</h2>
            <p className="mentor-review-detail__hint">Theo dõi câu trả lời và trao đổi trực tiếp với giảng viên.</p>
            <div className="mentor-review-detail__meta">
              {ticket.courseId && <span>Môn {ticket.courseId}</span>}
              {ticket.classId && <span>Lớp {ticket.classId}</span>}
              {assignedMentor && <span>Giảng viên {assignedMentor}</span>}
            </div>
          </div>
          <StatusTag status={getSupportTicketStatus(ticket)} />
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
              <Skeleton active paragraph={{ rows: 3 }} />
            </div>
          )}

          {(question.body || question.quizItems.length > 0) && (
            <ReviewBlock label="Câu hỏi của bạn" icon={<MessageSquareText size={15} />}>
              {question.quizItems.length > 0 ? (
                <div className="mentor-review-quiz-list">
                  {question.quizItems.map((item, index) => (
                    <QuizItemSummary
                      key={`${index}-${item.question}`}
                      item={item}
                      index={index}
                      total={question.quizItems.length}
                    />
                  ))}
                </div>
              ) : (
                <p className="mentor-review-question-text">{question.body}</p>
              )}
            </ReviewBlock>
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
              <div className="mentor-review-markdown">
                <MarkdownRenderer markdown={mentorAnswer} />
              </div>
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
