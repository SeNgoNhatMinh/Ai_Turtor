import { useState } from 'react';
import { Drawer } from 'antd';
import { uiCopy } from '../../../constants/uiCopy';
import { CheckCircle2, Clock3 } from 'lucide-react';
import PageHeader from '../../../components/common/PageHeader';
import useResponsiveViewport from '../../../hooks/useResponsiveViewport';
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
  const { isMobile } = useResponsiveViewport();
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const safeTickets = Array.isArray(escalations) ? escalations : [];
  const selectedTicket = selectedEscalation || safeTickets[0] || null;
  const answeredCount = safeTickets.filter(isAnsweredTicket).length;
  const waitingCount = Math.max(0, safeTickets.length - answeredCount);
  const handleSelectTicket = (ticket) => {
    onSelectEscalation(ticket);
    if (isMobile) setIsDetailOpen(true);
  };

  return (
    <div className="portal-section mentor-review-page">
      <PageHeader
        className="mentor-review-shared-header"
        eyebrow="Trung tâm hỗ trợ học tập"
        title={uiCopy.student.support.title}
        description={uiCopy.student.support.subtitle}
        actions={(
          <div className="mentor-review-summary" aria-label="Tổng quan yêu cầu hỗ trợ">
            <div>
              <Clock3 size={16} aria-hidden="true" />
              <span><strong>{waitingCount}</strong> đang xử lý</span>
            </div>
            <div>
              <CheckCircle2 size={16} aria-hidden="true" />
              <span><strong>{answeredCount}</strong> đã phản hồi</span>
            </div>
          </div>
        )}
      />

      <div className="mentor-review-layout">
        <SupportTicketList
          tickets={safeTickets}
          selectedTicket={selectedTicket}
          isLoading={isEscalationsLoading}
          error={escalationsError}
          onReload={loadEscalations}
          onSelect={handleSelectTicket}
        />
        {!isMobile && (
          <SupportConversationDetail
            ticket={selectedTicket}
            isLoading={isEscalationDetailLoading}
            error={escalationDetailError}
            currentUser={currentUser}
            onEscalationChange={onEscalationChange}
          />
        )}
      </div>
      {isMobile && (
        <Drawer
          open={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          placement="right"
          size={420}
          title="Chi tiết yêu cầu hỗ trợ"
          rootClassName="mentor-review-mobile-detail-drawer"
          styles={{ body: { padding: 0 } }}
        >
          <SupportConversationDetail
            ticket={selectedTicket}
            isLoading={isEscalationDetailLoading}
            error={escalationDetailError}
            currentUser={currentUser}
            onEscalationChange={onEscalationChange}
          />
        </Drawer>
      )}
    </div>
  );
}

export default MentorSupport;
