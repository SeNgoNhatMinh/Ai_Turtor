import MentorSupport from './MentorSupport';

function StudentSupportTab({
  escalations,
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
  return (
    <MentorSupport
      escalations={escalations}
      selectedEscalation={selectedEscalation}
      isEscalationsLoading={isEscalationsLoading}
      isEscalationDetailLoading={isEscalationDetailLoading}
      escalationsError={escalationsError}
      escalationDetailError={escalationDetailError}
      loadEscalations={loadEscalations}
      onSelectEscalation={onSelectEscalation}
      onEscalationChange={onEscalationChange}
      currentUser={currentUser}
    />
  );
}

export default StudentSupportTab;
