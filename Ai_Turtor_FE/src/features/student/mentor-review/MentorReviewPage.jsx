import MentorSupport from './MentorSupport';
import { useSearchParams } from 'react-router-dom';
import { useStudentSupport } from '../../../hooks/useStudentSupport';

export default function MentorReviewPage({ currentUser, studentId }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedEscalationId = searchParams.get('ticket');
  const support = useStudentSupport({
    activeTab: 'student-escalation',
    userId: currentUser?.userId || currentUser?.id || studentId,
    selectedEscalationId,
  });

  const selectTicket = (ticket) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (ticket?.id) next.set('ticket', ticket.id);
      else next.delete('ticket');
      return next;
    });
  };

  return (
    <MentorSupport
      escalations={support.escalations}
      selectedEscalation={support.selectedEscalation}
      isEscalationsLoading={support.isEscalationsLoading}
      isEscalationDetailLoading={support.isEscalationDetailLoading}
      escalationsError={support.escalationsError}
      escalationDetailError={support.escalationDetailError}
      loadEscalations={support.loadEscalations}
      onSelectEscalation={selectTicket}
      isDetailOpen={Boolean(selectedEscalationId)}
      onCloseDetail={() => selectTicket(null)}
      onEscalationChange={support.handleEscalationChange}
      currentUser={currentUser}
    />
  );
}
