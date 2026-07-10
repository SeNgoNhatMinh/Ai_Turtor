import { Button } from 'antd';
import { PanelLeft } from 'lucide-react';
import ChatSessionsPanel from './ChatSessionsPanel';
import ChatWorkspace from './ChatWorkspace';

function StudentChatTab({
  isHistoryDrawerOpen,
  setIsHistoryDrawerOpen,
  sessions,
  isSessionsLoading,
  activeSessionId,
  activeSessionTitle,
  editingSessionId,
  editingSessionTitle,
  setEditingSessionId,
  setEditingSessionTitle,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
  onSaveRename,
  courseId,
  onCourseChange,
  classId,
  setClassId,
  courseOptions,
  classOptions,
  isDarkMode,
  messages,
  chatInput,
  setChatInput,
  onSendQuery,
  onStopQuery,
  onPromptStarter,
  onAnswerAction,
  isAiLoading,
  messagesEndRef,
  handleStudentReviewAnswer,
  userId,
  activeSessionQuestionCount,
  activeSessionMaxTurnsReached,
  turnLimitNotice,
  onTurnLimitBack,
  onDismissTurnLimitNotice,
  triggerToast,
  courseMaterials,
  onAnalyzeStudyTip,
  onDownloadSource,
}) {
  return (
    <div className="portal-section student-chat-section student-chat-section--minimal">
      <div className="student-chat-layout student-chat-layout--chatgpt">
        <Button
          type="text"
          className="student-chat-history-toggle"
          icon={<PanelLeft size={16} />}
          onClick={() => setIsHistoryDrawerOpen(true)}
        >
          Chat history
        </Button>
        {isHistoryDrawerOpen && (
          <button
            type="button"
            className="student-chat-history-backdrop"
            aria-label="Close chat history"
            onClick={() => setIsHistoryDrawerOpen(false)}
          />
        )}
        <div className={`student-chat-history-pane ${isHistoryDrawerOpen ? 'is-open' : ''}`}>
          <ChatSessionsPanel
            sessions={sessions}
            isLoading={isSessionsLoading}
            activeSessionId={activeSessionId}
            onCreate={() => {
              onCreateSession();
              setIsHistoryDrawerOpen(false);
            }}
            onSelect={(sessionId, title) => {
              onSelectSession(sessionId, title);
              setIsHistoryDrawerOpen(false);
            }}
            onDelete={onDeleteSession}
            editingSessionId={editingSessionId}
            editingSessionTitle={editingSessionTitle}
            setEditingSessionId={setEditingSessionId}
            setEditingSessionTitle={setEditingSessionTitle}
            onSaveRename={onSaveRename}
            style={{ height: '100%' }}
          />
        </div>
        <div className="student-chat-main-pane">
          <ChatWorkspace
            activeSessionTitle={activeSessionTitle}
            courseId={courseId}
            onCourseChange={onCourseChange}
            classId={classId}
            setClassId={setClassId}
            courseOptions={courseOptions}
            classOptions={classOptions}
            isDarkMode={isDarkMode}
            messages={messages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            onSendQuery={onSendQuery}
            onStopQuery={onStopQuery}
            onPromptStarter={onPromptStarter}
            onAnswerAction={onAnswerAction}
            isAiLoading={isAiLoading}
            messagesEndRef={messagesEndRef}
            style={{ height: '100%' }}
            handleStudentReviewAnswer={handleStudentReviewAnswer}
            userId={userId}
            activeSessionId={activeSessionId}
            activeSessionQuestionCount={activeSessionQuestionCount}
            activeSessionMaxTurnsReached={activeSessionMaxTurnsReached}
            turnLimitNotice={turnLimitNotice}
            onTurnLimitBack={onTurnLimitBack}
            onDismissTurnLimitNotice={onDismissTurnLimitNotice}
            triggerToast={triggerToast}
            courseMaterials={courseMaterials}
            onAnalyzeStudyTip={onAnalyzeStudyTip}
            onDownloadSource={onDownloadSource}
          />
        </div>
      </div>
    </div>
  );
}

export default StudentChatTab;
