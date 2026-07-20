import { useState } from 'react';
import { Alert, Button, Tag } from 'antd';
import { LifeBuoy, X } from 'lucide-react';
import StudentMentorFlow from '../../components/support/StudentMentorFlow';
import { supportChatApi } from '../../services/supportChatApi';
import { getUserFacingError } from '../../services/apiClient';

function InlineMentorSupport({
  message,
  userId,
  studentName,
  studentEmail,
  currentUser,
  courseId,
  classId,
  conversationId,
  isOpen,
  onOpen,
  onClose,
  onEscalationCreated,
  onOpenReviewTab,
  triggerToast,
}) {
  const [createdEscalationId, setCreatedEscalationId] = useState('');
  const [escalationState, setEscalationState] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const escalationId = message?.questionEscalationId || createdEscalationId;
  const questionText = String(message?.question || '').trim();
  const answerText = String(message?.rawAnswer || message?.answer || '').trim();
  const alreadySent = Boolean(escalationId);
  const accountUserId = currentUser?.userId || currentUser?.id || currentUser?._id || userId;
  const studentUser = currentUser || {
    id: accountUserId,
    userId: accountUserId,
    fullName: studentName,
    email: studentEmail,
    role: 'STUDENT',
  };

  const createSupportRequest = async () => {
    if (alreadySent) {
      onOpen?.();
      return;
    }
    if (!accountUserId || !courseId || !classId || !questionText) {
      const friendly = 'Thiếu thông tin sinh viên, môn học, lớp hoặc câu hỏi.';
      setError(friendly);
      triggerToast?.(friendly);
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const data = await supportChatApi.createEscalation({
        studentId: accountUserId,
        studentName: studentName || accountUserId,
        studentEmail: studentEmail || currentUser?.email || '',
        courseId,
        classId,
        conversationId: conversationId || message?.conversationId || '',
        question: questionText,
        aiResponse: answerText || 'Student requested teacher support from AI Tutor chat.',
        reason: 'Student requested teacher support for this AI Tutor answer.',
      });
      const nextId = data?.questionEscalationId || data?.id || data?.escalationId;
      if (!nextId) throw new Error('Backend did not return a support request id.');
      const nextEscalation = {
        ...data,
        id: nextId,
        questionEscalationId: nextId,
        status: data?.status || 'PENDING_OFFER',
        originalQuestion: questionText,
        aiResponse: answerText,
        courseId,
        classId,
      };
      setCreatedEscalationId(nextId);
      setEscalationState(nextEscalation);
      onEscalationCreated?.(nextId);
      onOpen?.();
      triggerToast?.('Đã tạo yêu cầu hỗ trợ từ giáo viên.');
    } catch (requestError) {
      const friendly = getUserFacingError(requestError, 'Không thể tạo yêu cầu hỗ trợ từ giáo viên.');
      setError(friendly);
      triggerToast?.(friendly);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="inline-mentor-card inline-mentor-card--collapsed">
        <div className="inline-mentor-card__summary">
          <LifeBuoy size={16} />
          <div>
            <strong>{alreadySent ? 'Câu hỏi này đã có yêu cầu hỗ trợ' : 'Bạn cần giáo viên giải thích?'}</strong>
            <span>Tạo yêu cầu, chọn giáo viên phù hợp và tiếp tục trao đổi riêng.</span>
          </div>
        </div>
        <Button size="small" loading={isSubmitting} onClick={createSupportRequest}>
          {alreadySent ? 'Mở hỗ trợ' : 'Hỏi giáo viên'}
        </Button>
      </div>
    );
  }

  return (
    <div className="inline-mentor-card">
      <div className="inline-mentor-card__header">
        <div>
          <strong>Giáo viên hỗ trợ câu trả lời này</strong>
          <span>Trao đổi về đúng câu hỏi này trước khi giáo viên gửi câu trả lời cuối cùng.</span>
        </div>
        <button type="button" className="inline-mentor-card__close" onClick={onClose} aria-label="Ẩn hỗ trợ từ giáo viên">
          <X size={16} />
        </button>
      </div>

      {error && <Alert type="error" showIcon title={error} />}

      <div className="inline-mentor-question">
        <span>Câu hỏi trong AI Tutor</span>
        <p>{questionText || 'Không có nội dung câu hỏi.'}</p>
      </div>

      {!alreadySent ? (
        <Alert
          type="info"
          showIcon
          title="Tạo yêu cầu hỗ trợ cho câu hỏi này"
          description="Hệ thống sẽ lưu môn học, lớp, cuộc trò chuyện, câu hỏi và câu trả lời AI trước khi tìm giáo viên phù hợp."
          action={<Button size="small" type="primary" loading={isSubmitting} onClick={createSupportRequest}>Tạo yêu cầu</Button>}
        />
      ) : (
        <>
          <div className="inline-mentor-chat__toolbar">
            <Tag color="blue">Mentor hỗ trợ</Tag>
            <Button size="small" onClick={onOpenReviewTab}>Mở trang hỗ trợ</Button>
          </div>
          <StudentMentorFlow
            key={escalationId}
            escalation={escalationState || {
              ...message,
              id: escalationId,
              questionEscalationId: escalationId,
            }}
            currentUser={studentUser}
            compact
            onEscalationChange={setEscalationState}
          />
        </>
      )}
    </div>
  );
}

export default InlineMentorSupport;
