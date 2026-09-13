import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'antd';
import { ArrowUpRight, Check, GraduationCap, X } from 'lucide-react';
import ActionButton from '../../../../components/common/ActionButton';
import StatusTag from '../../../../components/common/StatusTag';
import MarkdownRenderer from '../../../../components/markdown/MarkdownRenderer';
import StudentMentorFlow from '../../../../components/support/StudentMentorFlow';
import { supportChatApi } from '../../../../services/supportChatApi';
import { getUserFacingError } from '../../../../services/apiClient';
import { queryKeys } from '../../../../app/queryKeys';
import { normalizeEscalationDetailResponse } from '../../../../services/normalizers';
import { getMentorAnswer, getSupportTicketStatus, isAnsweredTicket } from '../../mentor-review/mentorSupportUtils';

function InlineMentorSupport({
  message,
  escalation,
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
  const queryClient = useQueryClient();
  const [createdEscalationId, setCreatedEscalationId] = useState('');
  const [escalationState, setEscalationState] = useState(null);
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
  const detailQuery = useQuery({
    queryKey: queryKeys.studentMentorRequestDetail(escalationId),
    queryFn: async ({ signal }) => normalizeEscalationDetailResponse(
      await supportChatApi.getEscalationDetail(escalationId, { signal }),
    ),
    enabled: Boolean(escalationId && isOpen),
    staleTime: 10_000,
  });
  const ticket = {
    id: escalationId,
    originalQuestion: questionText,
    status: 'PENDING_OFFER',
    ...escalation,
    ...escalationState,
    ...detailQuery.data,
  };
  const mentorAnswer = getMentorAnswer(ticket);
  const answered = alreadySent && isAnsweredTicket(ticket);
  const currentStep = answered ? 2 : alreadySent ? 1 : 0;
  const createEscalationMutation = useMutation({
    mutationFn: () => supportChatApi.createEscalation({
      studentId: accountUserId,
      studentName: studentName || accountUserId,
      studentEmail: studentEmail || currentUser?.email || '',
      courseId,
      classId,
      conversationId: conversationId || message?.conversationId || '',
      question: questionText,
      aiResponse: answerText || 'Student requested teacher support from AI Tutor chat.',
      reason: 'Student requested teacher support for this AI Tutor answer.',
    }),
  });
  const isSubmitting = createEscalationMutation.isPending;

  const createSupportRequest = async () => {
    if (isSubmitting) return;
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
    try {
      const data = await createEscalationMutation.mutateAsync();
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
        conversationId: conversationId || message?.conversationId || '',
      };
      setCreatedEscalationId(nextId);
      setEscalationState(nextEscalation);
      queryClient.setQueryData(
        queryKeys.studentMentorRequestDetail(nextId),
        nextEscalation,
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.studentMentorRequests(accountUserId),
      });
      onEscalationCreated?.(nextId);
      onOpen?.();
      triggerToast?.('Đã tạo yêu cầu hỗ trợ từ giảng viên.');
    } catch (requestError) {
      const friendly = getUserFacingError(requestError, 'Không thể tạo yêu cầu hỗ trợ từ giảng viên.');
      setError(friendly);
      triggerToast?.(friendly);
    }
  };

  return (
    <section className={`inline-mentor-card ${!isOpen ? 'inline-mentor-card--collapsed' : ''}`} aria-label="Hỗ trợ từ giảng viên cho câu hỏi này">
      <div className="inline-mentor-card__header">
        <div className="inline-mentor-card__title">
          <span className="inline-mentor-card__title-icon" aria-hidden="true"><GraduationCap size={21} /></span>
          <div>
            <strong>Hỗ trợ từ giảng viên</strong>
            <span>{answered
              ? 'Giảng viên đã phản hồi câu hỏi của bạn.'
              : alreadySent
                ? 'Theo dõi yêu cầu và tiếp tục trao đổi với giảng viên.'
                : 'Cần giải thích thêm? Gửi câu hỏi này tới giảng viên.'}</span>
          </div>
        </div>
        {isOpen && (
          <button type="button" className="inline-mentor-card__close" onClick={onClose} aria-label="Thu gọn hỗ trợ từ giảng viên">
            <X size={18} />
          </button>
        )}
      </div>
      {error && <Alert type="error" showIcon title={error} />}
      {!isOpen ? (
        <div className="inline-mentor-card__actions">
          {alreadySent && <StatusTag status={getSupportTicketStatus(ticket)} />}
          <ActionButton onClick={onOpen} aria-expanded={false}>Xem hỗ trợ</ActionButton>
          {alreadySent && (
            <ActionButton icon={<ArrowUpRight size={15} />} onClick={() => onOpenReviewTab?.(escalationId)}>
              Mở ticket
            </ActionButton>
          )}
        </div>
      ) : (
        <>
          <ol className="inline-mentor-steps" aria-label="Tiến trình hỗ trợ">
            {['Gửi câu hỏi', 'Trao đổi', 'Nhận phản hồi'].map((label, index) => (
              <li key={label} className={index <= currentStep ? 'is-active' : ''} aria-current={index === currentStep ? 'step' : undefined}>
                <span aria-hidden="true">{index < currentStep ? <Check size={13} /> : index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <div className="inline-mentor-question">
            <span>Câu hỏi cần hỗ trợ</span>
            <p>{questionText || 'Không có nội dung câu hỏi.'}</p>
            <div className="inline-mentor-question__meta">
              {(ticket.courseId || courseId) && <span>Môn {ticket.courseId || courseId}</span>}
              {(ticket.classId || classId) && <span>Lớp {ticket.classId || classId}</span>}
            </div>
          </div>
          {!alreadySent ? (
            <div className="inline-mentor-card__request">
              <p>Giảng viên sẽ xem câu hỏi cùng câu trả lời AI để hỗ trợ bạn. Sau khi gửi, hãy chọn giảng viên để bắt đầu trao đổi.</p>
              <ActionButton intent="primary" loading={isSubmitting} onClick={createSupportRequest}>
                Gửi yêu cầu hỗ trợ
              </ActionButton>
            </div>
          ) : (
            <>
              <div className="inline-mentor-chat__toolbar">
                <StatusTag status={getSupportTicketStatus(ticket)} />
                <ActionButton icon={<ArrowUpRight size={15} />} onClick={() => onOpenReviewTab?.(escalationId)}>
                  Mở ticket
                </ActionButton>
              </div>
              {mentorAnswer ? (
                <div className="inline-mentor-answer">
                  <strong>Phản hồi từ giảng viên</strong>
                  <MarkdownRenderer markdown={mentorAnswer} />
                </div>
              ) : (
                <StudentMentorFlow
                  key={escalationId}
                  escalation={ticket}
                  currentUser={studentUser}
                  compact
                  onEscalationChange={setEscalationState}
                />
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}

export default InlineMentorSupport;
