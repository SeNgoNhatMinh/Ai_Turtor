import PageHeader from '../../../components/common/PageHeader';
import { uiCopy } from '../../../constants/uiCopy';
import SupportConversationDetail from './components/SupportConversationDetail';
import SupportTicketList from './components/SupportTicketList';

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

  return (
    <div className="portal-section mentor-review-page">
      <PageHeader eyebrow="Hỗ trợ học tập" title={uiCopy.student.support.title} description={uiCopy.student.support.subtitle} />

      <div className="mentor-review-layout">
        <SupportTicketList
          tickets={safeTickets}
          selectedTicket={selectedTicket}
          isLoading={isEscalationsLoading}
          error={escalationsError}
          onReload={loadEscalations}
          onSelect={onSelectEscalation}
        />
        <SupportConversationDetail
          ticket={selectedTicket}
          isLoading={isEscalationDetailLoading}
          error={escalationDetailError}
          currentUser={currentUser}
          onEscalationChange={onEscalationChange}
        />
      </div>
    </div>
  );
}

export default MentorSupport;
