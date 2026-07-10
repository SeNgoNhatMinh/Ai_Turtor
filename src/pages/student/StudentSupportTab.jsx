import MentorSupport from './MentorSupport';
import MentorSelectModal from './MentorSelectModal';

function StudentSupportTab({
  escalations,
  selectedEscalation,
  escChatMessages,
  escChatInput,
  setEscChatInput,
  escMessagesEndRef,
  isEscChatSending,
  userId,
  isEscalationsLoading,
  escalationsError,
  chatUnreadCount,
  chatRoomDetail,
  loadEscalations,
  onSelectEscalation,
  onSendEscalationMsg,
  onOpenMentorSelect,
  onCloseSupportChat,
  escModalVisible,
  escMentors,
  selectedMentorForEsc,
  setSelectedMentorForEsc,
  setEscModalVisible,
  onSelectMentor,
}) {
  return (
    <>
      <MentorSupport
        escalations={escalations}
        selectedEscalation={selectedEscalation}
        escChatMessages={escChatMessages}
        escChatInput={escChatInput}
        setEscChatInput={setEscChatInput}
        escMessagesEndRef={escMessagesEndRef}
        isEscChatSending={isEscChatSending}
        userId={userId}
        isEscalationsLoading={isEscalationsLoading}
        escalationsError={escalationsError}
        chatUnreadCount={chatUnreadCount}
        chatRoomDetail={chatRoomDetail}
        loadEscalations={loadEscalations}
        onSelectEscalation={onSelectEscalation}
        onSendEscalationMsg={onSendEscalationMsg}
        onOpenMentorSelect={onOpenMentorSelect}
        onCloseSupportChat={onCloseSupportChat}
      />
      <MentorSelectModal
        open={escModalVisible}
        mentors={escMentors}
        selectedMentorId={selectedMentorForEsc}
        setSelectedMentorId={setSelectedMentorForEsc}
        escalation={selectedEscalation}
        onCancel={() => setEscModalVisible(false)}
        onOk={onSelectMentor}
      />
    </>
  );
}

export default StudentSupportTab;
