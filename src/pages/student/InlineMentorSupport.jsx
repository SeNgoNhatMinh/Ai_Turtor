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
      const friendly = 'Missing student, course, class, or question context.';
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
      triggerToast?.('Teacher support request created.');
    } catch (requestError) {
      const friendly = getUserFacingError(requestError, 'Unable to create teacher support request.');
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
            <strong>{alreadySent ? 'This question has a teacher support request' : 'Need a teacher to explain this?'}</strong>
            <span>Create a request, choose the matched teacher, then continue in a private two-way chat.</span>
          </div>
        </div>
        <Button size="small" loading={isSubmitting} onClick={createSupportRequest}>
          {alreadySent ? 'Open support' : 'Ask a teacher'}
        </Button>
      </div>
    );
  }

  return (
    <div className="inline-mentor-card">
      <div className="inline-mentor-card__header">
        <div>
          <strong>Teacher support for this answer</strong>
          <span>Discuss this exact AI Tutor question before the teacher submits a final answer.</span>
        </div>
        <button type="button" className="inline-mentor-card__close" onClick={onClose} aria-label="Hide teacher support">
          <X size={16} />
        </button>
      </div>

      {error && <Alert type="error" showIcon message={error} />}

      <div className="inline-mentor-question">
        <span>Question from AI Tutor Chat</span>
        <p>{questionText || 'No question text available.'}</p>
      </div>

      {!alreadySent ? (
        <Alert
          type="info"
          showIcon
          message="Create a support request with this question"
          description="The backend stores the course, class, conversation, question, and previous AI answer before matching a teacher."
          action={<Button size="small" type="primary" loading={isSubmitting} onClick={createSupportRequest}>Create request</Button>}
        />
      ) : (
        <>
          <div className="inline-mentor-chat__toolbar">
            <Tag color="blue">Ticket {escalationId}</Tag>
            <Button size="small" onClick={onOpenReviewTab}>Open full support view</Button>
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
