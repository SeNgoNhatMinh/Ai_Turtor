import { useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { apiService } from '../services/api';
import { getUserFacingError } from '../services/apiClient';
import { normalizeEscalation } from '../services/normalizers';

const LIVE_SUPPORT_STATUSES = new Set(['IN_CHAT', 'ASSIGNED', 'ACTIVE']);

export const isLiveSupportStatus = (status) => LIVE_SUPPORT_STATUSES.has(String(status || '').toUpperCase());

const getSupportMessageTime = (item) => {
  const value = item?.sentAt || item?.timestamp || item?.createdAt;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

const normalizeSupportHistory = (history) => {
  const list = Array.isArray(history) ? history : [];
  const hasTimestamps = list.some((item) => getSupportMessageTime(item) !== null);
  if (!hasTimestamps) return [...list].reverse();
  return [...list].sort((a, b) => (getSupportMessageTime(a) ?? 0) - (getSupportMessageTime(b) ?? 0));
};

export function useStudentSupport({
  activeTab,
  userId,
  onMarkChatRead,
  onCloseChat,
  onGetChatDetail,
}) {
  const [escalations, setEscalations] = useState([]);
  const [selectedEscalation, setSelectedEscalation] = useState(null);
  const [escChatMessages, setEscChatMessages] = useState([]);
  const [escChatInput, setEscChatInput] = useState('');
  const [escMentors, setEscMentors] = useState([]);
  const [escModalVisible, setEscModalVisible] = useState(false);
  const [selectedMentorForEsc, setSelectedMentorForEsc] = useState(null);
  const [isEscalationsLoading, setIsEscalationsLoading] = useState(false);
  const [isEscChatSending, setIsEscChatSending] = useState(false);
  const [escalationsError, setEscalationsError] = useState('');
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [chatRoomDetail, setChatRoomDetail] = useState(null);
  const escMessagesEndRef = useRef(null);

  useEffect(() => {
    escMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [escChatMessages]);

  const loadChatUnread = async () => {
    try {
      const data = await apiService.getChatUnread(userId);
      setChatUnreadCount(data?.unreadCount ?? data?.count ?? (Array.isArray(data?.rooms) ? data.rooms.length : 0));
    } catch {
      setChatUnreadCount(0);
    }
  };

  const loadEscalations = async () => {
    setIsEscalationsLoading(true);
    setEscalationsError('');
    try {
      const data = await apiService.getEscalationHistory(userId);
      const items = (Array.isArray(data) ? data : []).map(normalizeEscalation);
      setEscalations(items);
      setSelectedEscalation((current) => {
        if (current && !items.some((item) => item.id === current.id)) return null;
        return current;
      });
    } catch (error) {
      setEscalations([]);
      setEscalationsError(getUserFacingError(error, 'Unable to load support requests.'));
    } finally {
      setIsEscalationsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'student-escalation') {
      loadEscalations();
      loadChatUnread();
    }
  }, [activeTab]);

  const handleSelectEscalation = async (escalation) => {
    setSelectedEscalation(escalation);
    setChatRoomDetail(null);
    if (isLiveSupportStatus(escalation.status) && escalation.chatRoomId) {
      try {
        if (onMarkChatRead) await onMarkChatRead(escalation.chatRoomId);
        if (onGetChatDetail) {
          const detail = await onGetChatDetail(escalation.chatRoomId);
          setChatRoomDetail(detail);
        }
        loadChatUnread();
      } catch {
        // Chat history can still load even if read/detail helper fails.
      }
      const history = await apiService.getChatHistory(escalation.chatRoomId);
      setEscChatMessages(normalizeSupportHistory(history));
    } else {
      setEscChatMessages([]);
    }
  };

  const handleCloseSupportChat = async () => {
    if (!selectedEscalation?.chatRoomId || !onCloseChat) return;
    try {
      await onCloseChat({
        chatRoomId: selectedEscalation.chatRoomId,
        questionEscalationId: selectedEscalation.id,
      });
      message.success('Support chat closed.');
      setEscChatMessages([]);
      setChatRoomDetail(null);
      loadEscalations();
      loadChatUnread();
    } catch (error) {
      message.error(getUserFacingError(error, 'Unable to close chat.'));
    }
  };

  const onSendEscalationMsg = async () => {
    if (!escChatInput.trim() || !selectedEscalation || !isLiveSupportStatus(selectedEscalation.status) || isEscChatSending) return;
    const content = escChatInput.trim();
    const msgData = {
      chatRoomId: selectedEscalation.chatRoomId,
      senderId: userId,
      senderName: userId,
      senderRole: 'USER',
      content,
    };
    setIsEscChatSending(true);
    try {
      await apiService.sendChatMessage(msgData);
      setEscChatMessages((prev) => [...prev, { ...msgData, timestamp: new Date().toISOString() }]);
      setEscChatInput('');
    } catch (error) {
      message.error(getUserFacingError(error, 'Unable to send message.'));
    } finally {
      setIsEscChatSending(false);
    }
  };

  const onSelectMentor = async () => {
    if (!selectedMentorForEsc || !selectedEscalation) return;
    const result = await apiService.selectEscalationMentor({
      questionEscalationId: selectedEscalation.id,
      userId,
      selectedMentorId: selectedMentorForEsc,
    });
    message.success('Mentor selected. Starting support chat...');
    setEscModalVisible(false);
    setSelectedMentorForEsc(null);
    const nextEscalation = {
      ...selectedEscalation,
      status: 'IN_CHAT',
      chatRoomId: result?.chatRoomId || selectedEscalation.chatRoomId,
      assignedMentorName: result?.mentorName || selectedEscalation.assignedMentorName,
      assignedMentorEmail: result?.mentorEmail || selectedEscalation.assignedMentorEmail,
    };
    await handleSelectEscalation(nextEscalation);
    loadEscalations();
  };

  const handleOpenMentorSelect = async (escalation) => {
    setSelectedEscalation(escalation);
    try {
      const offer = await apiService.offerEscalation(escalation.id);
      const suggested = offer?.suggestedMentors || offer?.mentors || [];
      if (Array.isArray(suggested) && suggested.length > 0) {
        setEscMentors(suggested);
      } else {
        const mentors = await apiService.getMentors();
        setEscMentors(Array.isArray(mentors) ? mentors : []);
      }
      setEscModalVisible(true);
    } catch (error) {
      const mentors = await apiService.getMentors();
      setEscMentors(Array.isArray(mentors) ? mentors : []);
      setEscModalVisible(true);
      message.warning(getUserFacingError(error, 'Unable to load suggested mentors. Showing available mentors instead.'));
    }
  };

  return {
    escalations,
    selectedEscalation,
    escChatMessages,
    escChatInput,
    setEscChatInput,
    escMentors,
    escModalVisible,
    setEscModalVisible,
    selectedMentorForEsc,
    setSelectedMentorForEsc,
    isEscalationsLoading,
    isEscChatSending,
    escalationsError,
    chatUnreadCount,
    chatRoomDetail,
    escMessagesEndRef,
    loadEscalations,
    handleSelectEscalation,
    handleCloseSupportChat,
    onSendEscalationMsg,
    onSelectMentor,
    handleOpenMentorSelect,
  };
}
