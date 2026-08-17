import { CloseOutlined } from '@ant-design/icons';
import { Button, Select, Space, Tooltip, Typography } from 'antd';
import { PanelLeft } from 'lucide-react';
import { uiCopy } from '../../../../constants/uiCopy';

const { Title } = Typography;

function ChatWorkspaceHeader({
  activeSessionMaxTurnsReached,
  activeSessionTitle,
  isHistoryOpen,
  canChat,
  chatContextMessage,
  courseOptions,
  hasLoadedStudentEnrollments,
  hasStudentEnrollments,
  isDarkMode,
  isNearTurnLimit,
  isStudentEnrollmentsLoading,
  onCancelCourseSwitch,
  onConfirmCourseSwitch,
  onCourseSelect,
  onToggleHistory,
  onDismissTurnLimitNotice,
  onTurnLimitBack,
  pendingCourseId,
  pendingCourseLabel,
  questionCount,
  selectedClassLabel,
  selectedCourseValue,
  turnLimitNotice,
}) {
  return (
    <>
      <div className="chat-workspace-header">
        <div className="chat-header-leading">
          <Tooltip title={isHistoryOpen ? 'Ẩn lịch sử trò chuyện' : 'Hiện lịch sử trò chuyện'}>
            <Button
              type="text"
              className="chat-header-history-button"
              icon={<PanelLeft size={18} />}
              onClick={onToggleHistory}
              aria-label={isHistoryOpen ? 'Ẩn lịch sử trò chuyện' : 'Hiện lịch sử trò chuyện'}
            />
          </Tooltip>
          <div className="chat-header-main">
            <Title level={4} title={activeSessionTitle}>{activeSessionTitle}</Title>
            <Tooltip title={activeSessionMaxTurnsReached ? uiCopy.student.chat.full : isNearTurnLimit ? uiCopy.student.chat.almostFull : ''}>
              <span className={`chat-turn-counter ${activeSessionMaxTurnsReached ? 'chat-turn-counter--full' : isNearTurnLimit ? 'chat-turn-counter--warning' : ''}`}>
                {uiCopy.student.chat.questionCounter(questionCount)}
              </span>
            </Tooltip>
          </div>
        </div>
        <Space wrap>
          <Select
            value={selectedCourseValue}
            onChange={onCourseSelect}
            style={{ width: 150 }}
            placeholder="Chọn môn học"
            aria-label="Chọn môn học"
            disabled={isStudentEnrollmentsLoading || courseOptions.length === 0}
            classNames={{
              popup: {
                root: `chat-course-select-popup ${isDarkMode ? 'chat-course-select-popup--dark' : ''}`,
              },
            }}
            options={courseOptions}
          />
          <div
            className={`chat-class-readonly-pill ${selectedClassLabel ? '' : 'chat-class-readonly-pill--empty'}`}
            title={selectedClassLabel || 'Lớp được xác định từ thông tin ghi danh'}
            aria-label="Lớp đã ghi danh"
          >
            <span>Lớp</span>
            <strong>{selectedClassLabel || 'Chưa xếp lớp'}</strong>
          </div>
        </Space>
      </div>

      {pendingCourseId && (
        <div className="chat-course-switch-banner" role="alert">
          <div>
            <strong>{uiCopy.student.chat.switchTitle}</strong>
            <span>
              Mỗi môn có lịch sử riêng. Chuyển sang {pendingCourseLabel || pendingCourseId} và mở lịch sử của môn này.
            </span>
          </div>
          <div className="chat-course-switch-banner__actions">
            <button type="button" onClick={onCancelCourseSwitch}>Hủy</button>
            <button type="button" className="primary" onClick={onConfirmCourseSwitch}>Đổi môn</button>
          </div>
        </div>
      )}

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
