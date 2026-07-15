import { lazy, Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Select, Space, Typography } from 'antd';
import { SendOutlined, StopOutlined, PushpinOutlined, CloseOutlined } from '@ant-design/icons';
import AnswerActionBar from './AnswerActionBar';
import AnswerEvidence from './AnswerEvidence';
import AnswerFeedbackControls from './AnswerFeedbackControls';
import AnswerImproveSuggestions from './AnswerImproveSuggestions';
import ChatLoadingSteps from './ChatLoadingSteps';
import InlineMentorSupport from './InlineMentorSupport';
import PromptStarters from './PromptStarters';
import { FEEDBACK_ACTIONS, getFeedbackAction } from '../../constants/answerReview';
import { normalizeReviewMode, validateChatInput, validateFeedbackText } from '../../utils/validators';
import { buildMaterialSourceMap } from '../../utils/sourceLabels';
import { classIdMatches } from '../../utils/academicIds';
import { conversationApi } from '../../services/conversationApi';
import { getUserFacingError } from '../../services/apiClient';
import './ChatWorkspace.css';

const { Title, Text } = Typography;
const { Option } = Select;
const CHAT_TURN_LIMIT = 10;
const AiAnswer = lazy(() => import('../../components/AiAnswer'));
const RobotHeadMascot = lazy(() => import('../../components/RobotHeadMascot'));

function MascotFallback({ size = 36 }) {
  return (
    <div
      className="chat-mascot-fallback"
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}

const getReviewMode = (message) => {
  return normalizeReviewMode(message?.mode);
};

const hashText = (value) => {
  const text = String(value || '');
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const getMessageKey = (message, index) => {
  if (message?.id || message?.messageId || message?.requestId) {
    return String(message.id || message.messageId || message.requestId);
  }
  const question = String(message?.question || '').trim();
  const answer = String(message?.answer || '').trim();
  const stableContent = `${question.slice(0, 500)}|${answer.slice(0, 500)}`;
  if (stableContent.trim()) {
    return `content-${hashText(stableContent)}-${index}`;
  }
  return `message-${index}`;
};

const getMessagePreview = (message) => {
  const text = message?.content || message?.question || message?.answer || '';
  return text.length > 82 ? `${text.slice(0, 82)}...` : text;
};

const getLegacyPinnedStorageKey = (userId, sessionId) => {
  if (!userId || !sessionId) return '';
  return `ai-tutor:pinned-chat-messages:${userId}:${sessionId}`;
};

const getPinTargetId = (message) => (
  message?.assistantMessageId
  || message?.aiMessageId
  || message?.responseMessageId
  || message?.messageId
  || message?.id
  || ''
);

const getPinnedMessageId = (message) => (
  message?.messageId
  || message?.id
  || message?._id
  || ''
);

const normalizePinnedMessages = (data) => {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.messages)
      ? data.messages
      : Array.isArray(data?.content)
        ? data.content
        : [];

  return list
    .map((item) => ({
      ...item,
      messageId: getPinnedMessageId(item),
      content: item?.content || item?.answer || item?.question || item?.message || '',
      role: item?.role || 'ASSISTANT',
      pinnedAt: item?.pinnedAt || item?.updatedAt || item?.createdAt || '',
    }))
    .filter((item) => item.messageId);
};

function ChatWorkspace({
  activeSessionTitle,
  courseId,
  onCourseChange,
  classId,
  courseOptions = [],
  classOptions = [],
  isStudentEnrollmentsLoading = false,
  hasLoadedStudentEnrollments = true,
  hasStudentEnrollments = true,
  messages,
  chatInput,
  setChatInput,
  onSendQuery,
  onStopQuery,
  onPromptStarter,
  onAnswerAction,
  isAiLoading = false,
  messagesEndRef,
  style,
  handleStudentReviewAnswer,
  userId,
  studentName,
  currentUser,
  activeSessionId,
  activeSessionQuestionCount = 0,
  activeSessionMaxTurnsReached = false,
  turnLimitNotice,
  onTurnLimitBack,
  onDismissTurnLimitNotice,
  isDarkMode = false,
  triggerToast,
  courseMaterials = [],
  onAnalyzeStudyTip,
  onStudySuggestion,
  onCreateQuizFromSuggestion,
  onDownloadSource,
  onOpenMentorReview,
}) {
  const [feedbackOpenIndex, setFeedbackOpenIndex] = useState(null);
  const [feedbackAction, setFeedbackAction] = useState(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false);
  const [pinnedMessagesFromServer, setPinnedMessagesFromServer] = useState([]);
  const [pinningMessageId, setPinningMessageId] = useState('');
  const [highlightedMessageKey, setHighlightedMessageKey] = useState('');
  const [pendingCourseId, setPendingCourseId] = useState('');
  const [openSupportCards, setOpenSupportCards] = useState({});
  const [localEscalationIds, setLocalEscalationIds] = useState({});

  const textareaRef = useRef(null);
  const materialSourceMap = useMemo(() => buildMaterialSourceMap(courseMaterials), [courseMaterials]);
  const safeMessages = useMemo(() => (
    Array.isArray(messages) ? [...messages] : []
  ), [messages]);

  const loadPinnedMessages = useCallback(async () => {
    if (!userId || !activeSessionId) {
      setPinnedMessagesFromServer([]);
      return;
    }
    try {
      const data = await conversationApi.getPinnedMessages(activeSessionId, userId);
      setPinnedMessagesFromServer(normalizePinnedMessages(data));
    } catch (error) {
      console.warn('Failed to load pinned chat messages:', error);
      setPinnedMessagesFromServer([]);
    }
  }, [activeSessionId, userId]);

  useEffect(() => {
    let isCancelled = false;
    Promise.resolve().then(() => {
      if (!isCancelled) loadPinnedMessages();
    });
    return () => {
      isCancelled = true;
    };
  }, [loadPinnedMessages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [chatInput]);

  const openFeedbackForm = (index, actionKey) => {
    setFeedbackOpenIndex(index);
    setFeedbackAction(getFeedbackAction(actionKey));
    setFeedbackText('');
  };

  const closeFeedbackForm = () => {
    setFeedbackOpenIndex(null);
    setFeedbackAction(null);
    setFeedbackText('');
  };

  const pinnedMessageIdSet = useMemo(
    () => new Set(pinnedMessagesFromServer.map((item) => item.messageId).filter(Boolean)),
    [pinnedMessagesFromServer],
  );

  const togglePinnedMessage = async (message) => {
    if (!userId || !activeSessionId) {
      triggerToast?.('Please open a saved chat before pinning messages.');
      return;
    }
    const messageId = getPinTargetId(message);
    if (!messageId) {
      triggerToast?.('This message is not ready to pin yet. Please reload the chat and try again.');
      return;
    }
    const isPinned = pinnedMessageIdSet.has(messageId);
    if (!isPinned && pinnedMessagesFromServer.length >= 3) {
      triggerToast?.('You can pin up to 3 messages.');
      return;
    }
    setPinningMessageId(messageId);
    try {
      if (isPinned) {
        await conversationApi.unpinChatMessage(activeSessionId, messageId, userId);
      } else {
        await conversationApi.pinChatMessage(activeSessionId, messageId, userId);
      }
      await loadPinnedMessages();
      triggerToast?.(isPinned ? 'Message unpinned.' : 'Message pinned.');
    } catch (error) {
      triggerToast?.(getUserFacingError(error, isPinned ? 'Unable to unpin this message.' : 'Unable to pin this message.'));
    } finally {
      setPinningMessageId('');
    }
  };

  const jumpToPinnedMessage = (messageKey) => {
    const target = document.querySelector(`[data-chat-message-key="${CSS.escape(messageKey)}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedMessageKey(messageKey);
    window.setTimeout(() => {
      setHighlightedMessageKey((current) => (current === messageKey ? '' : current));
    }, 1600);
  };

  const buildFeedbackPayload = (message, actionConfig, feedback) => {
    if (!userId) return { ok: false, message: 'Vui lòng đăng nhập trước khi gửi phản hồi.' };
    if (!courseId || !classId) return { ok: false, message: 'Vui lòng chọn khóa học và lớp học trước.' };
    if (!message?.answer) return { ok: false, message: 'Không có câu trả lời nào của AI để đánh giá.' };

    const action = actionConfig || FEEDBACK_ACTIONS.needMoreDetail;
    const cleanedFeedback = String(feedback || action.defaultFeedback || action.label).trim();

    return {
      ok: true,
      value: {
        studentId: userId,
        courseId,
        classId,
        conversationId: activeSessionId || '',
        mode: getReviewMode(message),
        reviewType: action.reviewType,
        question: message.question || '',
        answer: message.answer || '',
        rating: action.rating,
        accurate: action.accurate,
        helpful: action.helpful,
        correctnessLevel: action.correctnessLevel,
        feedback: cleanedFeedback,
        suggestedCorrection: action.reviewType === 'ANSWER_DISPUTE' ? cleanedFeedback : undefined,
        reviewedBy: userId,
        reviewerRole: 'STUDENT'
      }
    };
  };

  const submitQuickReview = async (message, actionKey) => {
    if (!handleStudentReviewAnswer) return;
    const action = FEEDBACK_ACTIONS[actionKey] || FEEDBACK_ACTIONS.helpful;
    const payload = buildFeedbackPayload(message, action, action.defaultFeedback);
    if (!payload.ok) {
      triggerToast?.(payload.message);
      return;
    }
    setIsFeedbackSubmitting(true);
    try {
      await handleStudentReviewAnswer(payload.value);
    } finally {
      setIsFeedbackSubmitting(false);
    }
  };

  const submitFeedback = async (message) => {
    if (!handleStudentReviewAnswer) return;
    const textValidation = validateFeedbackText(feedbackText);
    if (!textValidation.ok) {
      triggerToast?.(textValidation.message);
      return;
    }
    const action = feedbackAction || FEEDBACK_ACTIONS.needMoreDetail;
    const payload = buildFeedbackPayload(message, action, textValidation.value);
    if (!payload.ok) {
      triggerToast?.(payload.message);
      return;
    }
    setIsFeedbackSubmitting(true);
    try {
      await handleStudentReviewAnswer(payload.value);
      closeFeedbackForm();
    } finally {
      setIsFeedbackSubmitting(false);
    }
  };

  const openInlineSupport = (messageKey) => {
    setOpenSupportCards((prev) => ({ ...prev, [messageKey]: true }));
  };

  const closeInlineSupport = (messageKey) => {
    setOpenSupportCards((prev) => ({ ...prev, [messageKey]: false }));
  };

  const handleAnswerAction = (action) => {
    if (action?.type === 'mentor') {
      const index = safeMessages.indexOf(action.message);
      const messageKey = getMessageKey(action.message, index >= 0 ? index : 0);
      openInlineSupport(messageKey);
      return;
    }
    onAnswerAction?.(action);
  };

  const shouldShowMentorSupport = (message, messageKey) => (
    Boolean(message?.questionEscalationId || localEscalationIds[messageKey] || openSupportCards[messageKey])
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!canChatWithCurrentContext) {
        triggerToast?.(chatContextMessage);
        return;
      }
      if (activeSessionMaxTurnsReached) {
        triggerToast?.('Đoạn chat này đã đầy. Vui lòng bắt đầu đoạn chat mới để tiếp tục.');
        return;
      }
      const validation = validateChatInput(chatInput);
      if (!validation.ok) {
        triggerToast?.(validation.message);
        return;
      }
      onSendQuery();
    }
  };

  const safeCourseOptions = useMemo(() => {
    const options = (Array.isArray(courseOptions) ? courseOptions : [])
      .filter((item) => item?.value);
    return options;
  }, [courseOptions]);
  const safeClassOptions = useMemo(() => {
    const options = (Array.isArray(classOptions) ? classOptions : [])
      .filter((item) => item?.value);
    return options;
  }, [classOptions]);
  const messageLookupById = useMemo(() => {
    const lookup = new Map();
    safeMessages.forEach((message, index) => {
      const key = getMessageKey(message, index);
      [
        message?.assistantMessageId,
        message?.userMessageId,
        message?.messageId,
        message?.id,
      ].filter(Boolean).forEach((id) => {
        lookup.set(String(id), { message, index, key });
      });
    });
    return lookup;
  }, [safeMessages]);
  const pinnedMessages = pinnedMessagesFromServer
    .slice(0, 3)
    .map((pinned) => {
      const matched = messageLookupById.get(String(pinned.messageId));
      return {
        pinned,
        message: matched?.message || pinned,
        key: matched?.key || `pinned-${pinned.messageId}`,
        canJump: Boolean(matched?.key),
      };
    });

  useEffect(() => {
    if (!userId || !activeSessionId || safeMessages.length === 0) return;
    const storageKey = getLegacyPinnedStorageKey(userId, activeSessionId);
    if (!storageKey) return;

    let legacyKeys = [];
    try {
      legacyKeys = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
    } catch {
      legacyKeys = [];
    }
    if (!Array.isArray(legacyKeys) || legacyKeys.length === 0) return;

    let cancelled = false;
    const migrateLegacyPins = async () => {
      try {
        for (const legacyKey of legacyKeys.slice(0, 3)) {
          const matched = safeMessages.find((message, index) => getMessageKey(message, index) === legacyKey);
          const messageId = getPinTargetId(matched);
          if (messageId && !pinnedMessageIdSet.has(messageId)) {
            await conversationApi.pinChatMessage(activeSessionId, messageId, userId);
          }
        }
        window.localStorage.removeItem(storageKey);
        if (!cancelled) await loadPinnedMessages();
      } catch (error) {
        console.warn('Legacy pinned message migration failed:', error);
      }
    };

    migrateLegacyPins();
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, loadPinnedMessages, pinnedMessageIdSet, safeMessages, userId]);
  const selectedCourseValue = safeCourseOptions.some((item) => item.value === courseId) ? courseId : undefined;
  const selectedClassOption = safeClassOptions.find((item) => (
    item.value === classId
    || classIdMatches(item.value, classId)
    || (Array.isArray(item.aliases) && item.aliases.some((alias) => classIdMatches(alias, classId)))
  ));
  const shouldShowCourseSwitchBanner = Boolean(pendingCourseId && pendingCourseId !== courseId);
  const pendingCourseOption = safeCourseOptions.find((item) => item.value === pendingCourseId);
  const selectedClassValue = selectedClassOption?.value;
  const hasCourseSelection = Boolean(selectedCourseValue);
  const hasClassSelection = Boolean(selectedClassValue);
  const canChatWithCurrentContext = Boolean(
    !isStudentEnrollmentsLoading
    && hasLoadedStudentEnrollments
    && hasStudentEnrollments
    && hasCourseSelection
    && hasClassSelection
  );
  const chatContextMessage = isStudentEnrollmentsLoading
    ? 'Loading your enrolled classes. Please wait a moment.'
    : !hasLoadedStudentEnrollments
      ? 'Checking your enrolled classes. Please wait a moment.'
      : !hasStudentEnrollments
        ? 'Your student account is not enrolled in any class yet. Please contact Admin or your teacher before using AI Tutor Chat.'
        : !hasCourseSelection
          ? 'Please choose one of your enrolled courses before asking AI Tutor.'
          : !hasClassSelection
            ? 'Your class is assigned automatically from enrollment. Please switch to a course that has an active class.'
            : '';
  const questionCount = Math.max(0, Math.min(CHAT_TURN_LIMIT, Number(activeSessionQuestionCount) || 0));
  const isNearTurnLimit = questionCount >= 8 && questionCount < CHAT_TURN_LIMIT && !activeSessionMaxTurnsReached;
  const sendDisabled = !canChatWithCurrentContext || !validateChatInput(chatInput).ok || activeSessionMaxTurnsReached;
  const handleCourseSelect = (nextCourseId) => {
    if (!nextCourseId || nextCourseId === courseId) return;
    if (!courseId) {
      onCourseChange?.(nextCourseId, { confirmed: true });
      return;
    }
    setPendingCourseId(nextCourseId);
  };
  const confirmCourseSwitch = () => {
    if (!pendingCourseId) return;
    const nextCourseId = pendingCourseId;
    setPendingCourseId('');
    onCourseChange?.(nextCourseId, { confirmed: true });
  };

  return (
    <div className="chat-workspace-dark" style={style}>
      {/* Header */}
      <div className="chat-workspace-header">
        <div className="chat-header-main">
          <Title level={4} style={{ margin: 0, fontSize: '1.1rem' }}>{activeSessionTitle}</Title>
          <div className="chat-header-meta-row">
            <Text type="secondary" style={{ fontSize: '0.8rem' }}>Phiên Hỏi Đáp AI</Text>
            <span className={`chat-turn-counter ${activeSessionMaxTurnsReached ? 'chat-turn-counter--full' : isNearTurnLimit ? 'chat-turn-counter--warning' : ''}`}>
              Số câu hỏi {questionCount}/{CHAT_TURN_LIMIT}
            </span>
          </div>
          {isNearTurnLimit && (
            <div className="chat-turn-helper">
              Đoạn chat này sắp đầy. AI Tutor sẽ tiếp tục trong một đoạn chat mới sau 10 câu hỏi.
            </div>
          )}
          {activeSessionMaxTurnsReached && (
            <div className="chat-turn-helper chat-turn-helper--full">
              This chat is full. Start a new chat to continue.
            </div>
          )}
        </div>
        <Space wrap>
          <Select
            value={selectedCourseValue}
            onChange={handleCourseSelect}
            style={{ width: 150 }}
            placeholder="Chọn khóa học"
            disabled={isStudentEnrollmentsLoading || safeCourseOptions.length === 0}
            popupClassName={`chat-course-select-popup ${isDarkMode ? 'chat-course-select-popup--dark' : ''}`}
          >
            {safeCourseOptions.map((item) => (
              <Option key={item.value} value={item.value}>{item.label}</Option>
            ))}
          </Select>
          <div
            className={`chat-class-readonly-pill ${hasClassSelection ? '' : 'chat-class-readonly-pill--empty'}`}
            title={selectedClassOption?.label || 'Class is assigned from your enrollment'}
            aria-label="Assigned class section"
          >
            <span>Class</span>
            <strong>{selectedClassValue || 'Not assigned'}</strong>
          </div>
        </Space>
      </div>

      {shouldShowCourseSwitchBanner && (
        <div className="chat-course-switch-banner" role="alert">
          <div>
            <strong>Switch course?</strong>
            <span>
              Each course has separate chat history. Switch to {pendingCourseOption?.label || pendingCourseId} and open that course&apos;s conversations.
            </span>
          </div>
          <div className="chat-course-switch-banner__actions">
            <button type="button" onClick={() => setPendingCourseId('')}>Cancel</button>
            <button type="button" className="primary" onClick={confirmCourseSwitch}>Switch course</button>
          </div>
        </div>
      )}

      {!canChatWithCurrentContext && (
        <div className="chat-context-blocker" role="status">
          <strong>{!hasStudentEnrollments && hasLoadedStudentEnrollments ? 'Enrollment required' : 'Course context required'}</strong>
          <span>{chatContextMessage}</span>
        </div>
      )}

      {turnLimitNotice && (
        <div className="chat-turn-limit-banner" role="status">
          <div>
            <strong>Đã bắt đầu cuộc trò chuyện mới</strong>
            <span>{turnLimitNotice.message || 'Đoạn chat đã đạt 10 câu hỏi. AI Tutor đã bắt đầu một cuộc trò chuyện mới.'}</span>
          </div>
          <div className="chat-turn-limit-banner-actions">
            {turnLimitNotice.previousSessionId && (
              <button type="button" onClick={onTurnLimitBack}>
                Back to previous chat
              </button>
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

      {pinnedMessages.length > 0 && (
        <div className="chat-pinned-topbar" aria-label="Pinned messages">
          <div className="chat-pinned-topbar-label">
            <PushpinOutlined />
            <span>Đã ghim</span>
            <em>{pinnedMessages.length}/3</em>
          </div>
          <div className="chat-pinned-topbar-list">
            {pinnedMessages.map(({ pinned, message, key, canJump }) => (
              <button
                key={pinned.messageId}
                type="button"
                className={`chat-pinned-topbar-item ${!canJump ? 'chat-pinned-topbar-item--disabled' : ''}`}
                onClick={() => canJump && jumpToPinnedMessage(key)}
                title={canJump ? 'Chuyển đến tin nhắn đã ghim' : 'Pinned message is not in the loaded message window'}
              >
                <span>{getMessagePreview(message) || 'Tin nhắn đã ghim'}</span>
                <CloseOutlined
                  className="chat-pinned-unpin"
                  title="Bỏ ghim tin nhắn"
                  onClick={(event) => {
                    event.stopPropagation();
                    togglePinnedMessage({ assistantMessageId: pinned.messageId });
                  }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="chat-workspace-messages-container">
        <div className="chat-workspace-messages-inner">
          {safeMessages.length === 0 ? (
            <div className="chat-empty-state">
              <Suspense fallback={<MascotFallback size={180} />}>
                <RobotHeadMascot size={180} />
              </Suspense>
              <div className="chat-empty-title">Tôi có thể giúp gì cho bạn hôm nay?</div>
              <PromptStarters onSelect={onPromptStarter} />
            </div>
          ) : (
            safeMessages.map((message, index) => {
              const messageKey = getMessageKey(message, index);
              const pinTargetId = getPinTargetId(message);
              const isPinned = Boolean(pinTargetId && pinnedMessageIdSet.has(pinTargetId));
              const isPinning = Boolean(pinTargetId && pinningMessageId === pinTargetId);
              return (
                <div
                  key={messageKey}
                  data-chat-message-key={messageKey}
                  className={`chat-message-turn ${highlightedMessageKey === messageKey ? 'chat-message-turn--highlighted' : ''}`}
                >
                  {/* User Message */}
                  <div className="chat-gpt-message-row user">
                    <div className={`chat-gpt-bubble-user ${isPinned ? 'chat-message-pinned' : ''}`}>
                      {isPinned && <PushpinOutlined className="chat-message-pin-badge" />}
                      {message.question}
                    </div>
                  </div>

                  {/* AI Message */}
                  {!message.pending && (
                    <div className="chat-gpt-message-row ai">
                      <div className="chat-gpt-bubble-ai">
                        <div style={{ flexShrink: 0, marginTop: '-4px' }}>
                          <Suspense fallback={<MascotFallback size={36} />}>
                            <RobotHeadMascot size={36} compact={true} followMouse={false} />
                          </Suspense>
                        </div>
                        <div className="chat-gpt-ai-content">
                          {message.aiServiceError && (
                            <div className="chat-ai-service-error" role="alert">
                              <strong>Dịch vụ AI hiện đang tạm ngưng.</strong>
                              <span>Vui lòng thử lại sau giây lát, hoặc nhờ Mentor hỗ trợ.</span>
                            </div>
                          )}

                          <Suspense fallback={<div className="chat-answer-loading">Formatting answer...</div>}>
                            <AiAnswer
                              markdown={message.answer || ''}
                              sourceMap={materialSourceMap}
                              onStudyTipAnalyze={onAnalyzeStudyTip}
                              onDownloadSource={onDownloadSource}
                              hideSourceSection={Array.isArray(message.sources) && message.sources.length > 0}
                            />
                          </Suspense>

                          <AnswerEvidence message={message} sourceMap={materialSourceMap} onDownloadSource={onDownloadSource} />
                          {!message.canceled && !message.aiServiceError && (
                            <AnswerImproveSuggestions
                              suggestions={message.nextImproveSuggestions}
                              onStudy={onStudySuggestion}
                              onCreateQuiz={onCreateQuizFromSuggestion}
                            />
                          )}
                          {!message.canceled && <AnswerActionBar message={message} onAction={handleAnswerAction} />}

                          {!message.canceled && shouldShowMentorSupport(message, messageKey) && (
                            <InlineMentorSupport
                              message={{
                                ...message,
                                questionEscalationId: message.questionEscalationId || localEscalationIds[messageKey],
                              }}
                              userId={userId}
                              studentName={studentName}
                              studentEmail={currentUser?.email}
                              currentUser={currentUser}
                              courseId={courseId}
                              classId={classId}
                              conversationId={activeSessionId}
                              isOpen={Boolean(openSupportCards[messageKey])}
                              onOpen={() => openInlineSupport(messageKey)}
                              onClose={() => closeInlineSupport(messageKey)}
                              onEscalationCreated={(nextId) => {
                                setLocalEscalationIds((prev) => ({ ...prev, [messageKey]: nextId }));
                              }}
                              onOpenReviewTab={onOpenMentorReview}
                              triggerToast={triggerToast}
                            />
                          )}

                          {!message.canceled && (
                            <AnswerFeedbackControls
                              index={index}
                              isPinned={isPinned}
                              isFeedbackSubmitting={isFeedbackSubmitting}
                              feedbackOpenIndex={feedbackOpenIndex}
                              feedbackAction={feedbackAction}
                              feedbackText={feedbackText}
                              setFeedbackText={setFeedbackText}
                              onTogglePin={() => togglePinnedMessage(message)}
                              isPinning={isPinning}
                              onHelpful={() => submitQuickReview(message, 'helpful')}
                              onOpenFeedback={openFeedbackForm}
                              onCloseFeedback={closeFeedbackForm}
                              onSubmitFeedback={() => submitFeedback(message)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
          {isAiLoading && (
            <div className="chat-gpt-loading">
              <div style={{ flexShrink: 0, marginLeft: '-42px' }}>
                <RobotHeadMascot size={32} compact={true} followMouse={false} />
              </div>
              <ChatLoadingSteps />
            </div>
          )}
          <div ref={messagesEndRef} style={{ height: 1 }} />
        </div>
      </div>

      {/* Input Area */}
      <div className="chat-workspace-input-area">
        <div className="chat-workspace-input-inner">
          <div className="chat-gpt-input-wrapper">
            <textarea
              ref={textareaRef}
              placeholder={!canChatWithCurrentContext ? chatContextMessage : activeSessionMaxTurnsReached ? 'Đoạn chat này đã đầy. Vui lòng bắt đầu đoạn chat mới để tiếp tục.' : isAiLoading ? 'AI Tutor đang trả lời...' : 'Nhắn tin cho AI Tutor...'}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              maxLength={8000}
              disabled={isAiLoading || !canChatWithCurrentContext}
              rows={1}
            />
            {isAiLoading ? (
              <button className="chat-gpt-send-btn" onClick={onStopQuery} title="Dừng tạo câu trả lời">
                <StopOutlined />
              </button>
            ) : (
              <button
                className="chat-gpt-send-btn"
                onClick={onSendQuery}
                disabled={sendDisabled}
                title={!canChatWithCurrentContext ? chatContextMessage : activeSessionMaxTurnsReached ? 'Đoạn chat này đã đầy. Vui lòng bắt đầu đoạn chat mới để tiếp tục.' : 'Send message'}
              >
                <SendOutlined />
              </button>
            )}
          </div>
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#888' }}>
            AI Tutor can make mistakes. Consider verifying important information.
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatWorkspace;
