import MentorSupport from './MentorSupport';

function StudentSupportView({
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

export default StudentSupportView;
