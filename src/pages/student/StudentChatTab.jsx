import { Button } from 'antd';
import { PanelLeft } from 'lucide-react';
import ChatSessionsPanel from './ChatSessionsPanel';
import ChatWorkspace from './ChatWorkspace';

function StudentChatTab({
  isHistoryDrawerOpen,
  setIsHistoryDrawerOpen,
  sessions,
  isSessionsLoading,
  sessionMutationKey,
  isCreatingSession,
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
  courseOptions,
  classOptions,
  isStudentEnrollmentsLoading,
  hasLoadedStudentEnrollments,
  hasStudentEnrollments,
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
  studentName,
  currentUser,
  activeSessionQuestionCount,
  activeSessionMaxTurnsReached,
  turnLimitNotice,
  onTurnLimitBack,
  onDismissTurnLimitNotice,
  triggerToast,
  courseMaterials,
  onAnalyzeStudyTip,
  onStudySuggestion,
  onCreateQuizFromSuggestion,
  onDownloadSource,
  onOpenMentorReview,
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
            sessionMutationKey={sessionMutationKey}
            isCreatingSession={isCreatingSession}
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
            courseOptions={courseOptions}
            classOptions={classOptions}
            isStudentEnrollmentsLoading={isStudentEnrollmentsLoading}
            hasLoadedStudentEnrollments={hasLoadedStudentEnrollments}
            hasStudentEnrollments={hasStudentEnrollments}
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
            studentName={studentName}
            currentUser={currentUser}
            activeSessionId={activeSessionId}
            activeSessionQuestionCount={activeSessionQuestionCount}
            activeSessionMaxTurnsReached={activeSessionMaxTurnsReached}
            turnLimitNotice={turnLimitNotice}
            onTurnLimitBack={onTurnLimitBack}
            onDismissTurnLimitNotice={onDismissTurnLimitNotice}
            triggerToast={triggerToast}
            courseMaterials={courseMaterials}
            onAnalyzeStudyTip={onAnalyzeStudyTip}
            onStudySuggestion={onStudySuggestion}
            onCreateQuizFromSuggestion={onCreateQuizFromSuggestion}
            onDownloadSource={onDownloadSource}
            onOpenMentorReview={onOpenMentorReview}
          />
        </div>
      </div>
    </div>
  );
}

export default StudentChatTab;
