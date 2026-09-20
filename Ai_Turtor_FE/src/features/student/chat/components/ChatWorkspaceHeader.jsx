import { CloseOutlined } from '@ant-design/icons';
import { uiCopy } from '../../../../constants/uiCopy';

function ChatWorkspaceHeader({
  canChat,
  chatContextMessage,
  hasLoadedStudentEnrollments,
  hasStudentEnrollments,
  isStudentEnrollmentsLoading,
  onDismissTurnLimitNotice,
  onTurnLimitBack,
  turnLimitNotice,
}) {
  return (
    <>
      {!canChat && (
        <div className="chat-context-blocker" role="status">
          <strong>
            {isStudentEnrollmentsLoading || !hasLoadedStudentEnrollments
              ? 'Đang kiểm tra ghi danh'
              : !hasStudentEnrollments
                ? 'Cần ghi danh lớp học'
                : 'Cần chọn môn học'}
          </strong>
          <span>{chatContextMessage}</span>
        </div>
      )}

      {turnLimitNotice && (
        <div className="chat-turn-limit-banner" role="status">
          <div>
            <strong>{uiCopy.student.chat.newConversationTitle}</strong>
            <span>{turnLimitNotice.message || uiCopy.student.chat.rolloverMessage}</span>
          </div>
          <div className="chat-turn-limit-banner-actions">
            {turnLimitNotice.previousSessionId && (
              <button type="button" onClick={onTurnLimitBack}>{uiCopy.student.chat.previousConversation}</button>
            )}
            <button
              type="button"
              className="chat-turn-limit-banner-close"
              aria-label="Đóng thông báo"
              onClick={onDismissTurnLimitNotice}
            >
              <CloseOutlined />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default ChatWorkspaceHeader;
