import StudentSupportTab from '../../../pages/student/StudentSupportTab';
import { useStudentSupport } from '../../../hooks/useStudentSupport';

export default function MentorReviewPage({ currentUser, studentId, switchTab }) {
  const support = useStudentSupport({
    activeTab: 'student-escalation',
    userId: currentUser?.userId || currentUser?.id || studentId,
    onConversationResolved: () => switchTab?.('student-chat'),
  });

  return (
    <StudentSupportTab
      escalations={support.escalations}
      selectedEscalation={support.selectedEscalation}
      isEscalationsLoading={support.isEscalationsLoading}
      isEscalationDetailLoading={support.isEscalationDetailLoading}
      escalationsError={support.escalationsError}
      escalationDetailError={support.escalationDetailError}
      loadEscalations={support.loadEscalations}
      onSelectEscalation={support.handleSelectEscalation}
      onEscalationChange={support.handleEscalationChange}
      currentUser={currentUser}
    />
  );
}
