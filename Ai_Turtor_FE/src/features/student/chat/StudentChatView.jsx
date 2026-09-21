import { useState } from 'react';
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
  chatMode,
  setChatMode,
  onSendQuery,
  onResendMessage,
  onStopQuery,
  onPromptStarter,
  onLockUnderstandingAnswer,
  onAnswerAction,
  isAiLoading,
  messagesEndRef,
  handleStudentReviewAnswer,
  userId,
  studentName,
  currentUser,
  activeSessionQuestionCount,
  activeSessionMaxTurnsReached,
  courseDailyQuota,
  courseDailyQuotaExhausted,
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
}) {
  const [pendingCourseId, setPendingCourseId] = useState('');
  const pendingCourseLabel = courseOptions.find((item) => item.value === pendingCourseId)?.label;
  const handleCourseSelect = (nextCourseId) => {
    if (!nextCourseId || nextCourseId === courseId) return;
    if (!courseId) {
      onCourseChange(nextCourseId, { confirmed: true });
      return;
    }
    setPendingCourseId(nextCourseId);
  };
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
            onDelete={onDeleteSession}
            editingSessionId={editingSessionId}
            editingSessionTitle={editingSessionTitle}
            setEditingSessionId={setEditingSessionId}
            setEditingSessionTitle={setEditingSessionTitle}
            onSaveRename={onSaveRename}
            isHistoryOpen={isHistoryDrawerOpen}
            onToggleHistory={() => setIsHistoryDrawerOpen((open) => !open)}
            courseOptions={courseOptions}
            selectedCourseValue={courseId}
            isStudentEnrollmentsLoading={isStudentEnrollmentsLoading}
            isDarkMode={isDarkMode}
            onCourseSelect={handleCourseSelect}
            pendingCourseId={pendingCourseId}
            pendingCourseLabel={pendingCourseLabel}
            onConfirmCourseSwitch={() => {
              onCourseChange(pendingCourseId, { confirmed: true });
              setPendingCourseId('');
            }}
            onCancelCourseSwitch={() => setPendingCourseId('')}
            tutorSession={tutorSession}
            style={{ height: '100%' }}
          />
        </div>
        <div className="student-chat-main-pane">
          <ChatWorkspace
            activeSessionTitle={activeSessionTitle}
            isHistoryOpen={isHistoryDrawerOpen}
            courseId={courseId}
            classId={classId}
            courseOptions={courseOptions}
            classOptions={classOptions}
            isStudentEnrollmentsLoading={isStudentEnrollmentsLoading}
            hasLoadedStudentEnrollments={hasLoadedStudentEnrollments}
            hasStudentEnrollments={hasStudentEnrollments}
            messages={messages}
            chatInput={chatInput}
            setChatInput={setChatInput}
            chatMode={chatMode}
            setChatMode={setChatMode}
            onSendQuery={onSendQuery}
            onResendMessage={onResendMessage}
            onStopQuery={onStopQuery}
            onPromptStarter={onPromptStarter}
            onLockUnderstandingAnswer={onLockUnderstandingAnswer}
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
            courseDailyQuota={courseDailyQuota}
            courseDailyQuotaExhausted={courseDailyQuotaExhausted}
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
          />
        </div>
      </div>
    </div>
  );
}

export default StudentChatView;
