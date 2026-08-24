import { uiCopy } from '../../../constants/uiCopy';
import { CheckCircle2, Clock3, MessagesSquare } from 'lucide-react';
import SupportConversationDetail from './components/SupportConversationDetail';
import SupportTicketList from './components/SupportTicketList';
import { isAnsweredTicket } from './mentorSupportUtils';

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
  const answeredCount = safeTickets.filter(isAnsweredTicket).length;
  const waitingCount = Math.max(0, safeTickets.length - answeredCount);

  return (
    <div className="portal-section mentor-review-page">
      <header className="mentor-review-page-header">
        <div className="mentor-review-page-header__identity">
          <span className="mentor-review-page-header__icon" aria-hidden="true">
            <MessagesSquare size={24} />
          </span>
          <div>
            <span className="mentor-review-page-header__eyebrow">Trung tâm hỗ trợ học tập</span>
            <h1>{uiCopy.student.support.title}</h1>
            <p>{uiCopy.student.support.subtitle}</p>
          </div>
        </div>

        <div className="mentor-review-page-header__stats" aria-label="Tổng quan yêu cầu hỗ trợ">
          <div>
            <Clock3 size={16} aria-hidden="true" />
            <span><strong>{waitingCount}</strong> đang xử lý</span>
          </div>
          <div>
            <CheckCircle2 size={16} aria-hidden="true" />
            <span><strong>{answeredCount}</strong> đã phản hồi</span>
          </div>
        </div>
      </header>

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
