import ChatSessionsPanel from './components/ChatSessionsPanel';
import ChatWorkspace from './components/ChatWorkspace';
import { isMobileViewport } from '../../../hooks/useResponsiveViewport';

function StudentChatView({
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
  onResendMessage,
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
  mentorRequests,
  onStudySuggestion,
  onCreateQuizFromSuggestion,
  onDownloadSource,
  onOpenMentorReview,
  onMentorRequestCreated,
  tutorSession,
  tutorSessionSummary,
  isTutorSessionLoading,
  onStartNextTutorSession,
}) {
  const closeHistoryOnMobile = () => {
    if (isMobileViewport()) setIsHistoryDrawerOpen(false);
  };

  return (
    <div className="portal-section student-chat-section student-chat-section--minimal">
      <div className="student-chat-layout student-chat-layout--chatgpt">
        {isHistoryDrawerOpen && (
          <button
            type="button"
            className="student-chat-history-backdrop"
            aria-label="Đóng lịch sử chat"
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
              closeHistoryOnMobile();
            }}
            onSelect={(sessionId, title) => {
              onSelectSession(sessionId, title);
              closeHistoryOnMobile();
            }}
            onClose={() => setIsHistoryDrawerOpen(false)}
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
            isHistoryOpen={isHistoryDrawerOpen}
            onToggleHistory={() => setIsHistoryDrawerOpen((open) => !open)}
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
            onResendMessage={onResendMessage}
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
            mentorRequests={mentorRequests}
            onStudySuggestion={onStudySuggestion}
            onCreateQuizFromSuggestion={onCreateQuizFromSuggestion}
            onDownloadSource={onDownloadSource}
            onOpenMentorReview={onOpenMentorReview}
            onMentorRequestCreated={onMentorRequestCreated}
            tutorSession={tutorSession}
            tutorSessionSummary={tutorSessionSummary}
            isTutorSessionLoading={isTutorSessionLoading}
            onStartNextTutorSession={onStartNextTutorSession}
          />
        </div>
      </div>
    </div>
  );
}

export default StudentChatView;
