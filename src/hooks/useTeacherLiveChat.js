import { useEffect, useRef, useState } from 'react';
import { normalizeSupportHistory } from '../pages/teacher/teacherPortalUtils';

export function useTeacherLiveChat({
  teacherUserId,
  loadTeacherInbox,
  onMarkChatRead,
  onCloseChat,
  onGetChatDetail,
  onSendChatMessage,
  onGetChatHistory,
  triggerToast,
}) {
  const [selectedChatEsc, setSelectedChatEsc] = useState(null);
  const [teacherChatMessages, setTeacherChatMessages] = useState([]);
  const [teacherChatInput, setTeacherChatInput] = useState('');
  const [chatRoomDetail, setChatRoomDetail] = useState(null);
  const [isTeacherChatSending, setIsTeacherChatSending] = useState(false);
  const teacherChatEndRef = useRef(null);

  useEffect(() => {
    teacherChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [teacherChatMessages]);

  const handleSelectTeacherChat = async (esc) => {
    setSelectedChatEsc(esc);
    setChatRoomDetail(null);
    if (!esc.chatRoomId) {
      setTeacherChatMessages([]);
      return;
    }
    try {
      if (onMarkChatRead) await onMarkChatRead(esc.chatRoomId);
      if (onGetChatDetail) setChatRoomDetail(await onGetChatDetail(esc.chatRoomId));
      const history = onGetChatHistory ? await onGetChatHistory(esc.chatRoomId) : [];
      setTeacherChatMessages(normalizeSupportHistory(history));
    } catch {
      setTeacherChatMessages([]);
    }
  };

  const onSendTeacherChat = async () => {
    if (!teacherChatInput.trim() || !selectedChatEsc?.chatRoomId || isTeacherChatSending) return;
    const content = teacherChatInput.trim();
    const msgData = {
      chatRoomId: selectedChatEsc.chatRoomId,
      senderId: teacherUserId,
      senderName: teacherUserId,
      senderRole: 'MENTOR',
      content,
    };
    setIsTeacherChatSending(true);
    try {
      await onSendChatMessage(msgData);
      setTeacherChatMessages((prev) => [...prev, { ...msgData, timestamp: new Date().toISOString() }]);
      setTeacherChatInput('');
    } catch {
      triggerToast('Unable to send mentor message.');
    } finally {
      setIsTeacherChatSending(false);
    }
  };

  const onCloseTeacherChat = async () => {
    if (!selectedChatEsc?.chatRoomId || !onCloseChat) return;
    try {
      await onCloseChat({
        chatRoomId: selectedChatEsc.chatRoomId,
        questionEscalationId: selectedChatEsc.id,
      });
      triggerToast('Support chat closed.');
      setTeacherChatMessages([]);
      setSelectedChatEsc(null);
      loadTeacherInbox?.();
    } catch {
      triggerToast('Unable to close chat.');
    }
  };

  return {
    selectedChatEsc,
    teacherChatMessages,
    teacherChatInput,
    setTeacherChatInput,
    chatRoomDetail,
    isTeacherChatSending,
    teacherChatEndRef,
    handleSelectTeacherChat,
    onSendTeacherChat,
    onCloseTeacherChat,
  };
}
