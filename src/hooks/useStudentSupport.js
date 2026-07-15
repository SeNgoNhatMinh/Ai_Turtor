import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserFacingError } from '../services/apiClient';
import { normalizeEscalation } from '../services/normalizers';
import { supportChatApi } from '../services/supportChatApi';

const TERMINAL_ESCALATION_STATES = new Set([
  'ANSWERED',
  'ANSWERED_NO_KNOWLEDGE_CANDIDATE',
  'COMPLETED',
  'CLOSED',
  'CANCELLED',
  'REJECTED',
  'RESOLVED',
  'RESOLVED_INDEXED',
]);

const normalizeStatus = (value) => String(value || '').trim().toUpperCase();

export function useStudentSupport({ activeTab, userId, onConversationResolved }) {
  const [escalations, setEscalations] = useState([]);
  const [selectedEscalation, setSelectedEscalation] = useState(null);
  const [isEscalationsLoading, setIsEscalationsLoading] = useState(false);
  const [isEscalationDetailLoading, setIsEscalationDetailLoading] = useState(false);
  const [escalationsError, setEscalationsError] = useState('');
  const [escalationDetailError, setEscalationDetailError] = useState('');
  const handledResolvedConversationIdsRef = useRef(new Set());
  const onConversationResolvedRef = useRef(onConversationResolved);

  useEffect(() => {
    onConversationResolvedRef.current = onConversationResolved;
  }, [onConversationResolved]);

  const loadEscalations = useCallback(async () => {
    if (!userId) {
      setEscalations([]);
      setSelectedEscalation(null);
      return;
    }

    setIsEscalationsLoading(true);
    setEscalationsError('');
    try {
      const data = await supportChatApi.getEscalationHistory(userId);
      const items = (Array.isArray(data) ? data : [])
        .map(normalizeEscalation)
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
      setEscalations(items);
      setSelectedEscalation((current) => {
        if (current && !items.some((item) => item.id === current.id)) return null;
        return current || items[0] || null;
      });
    } catch (error) {
      setEscalations([]);
      setSelectedEscalation(null);
      setEscalationsError(getUserFacingError(error, 'Unable to load mentor review tickets.'));
    } finally {
      setIsEscalationsLoading(false);
    }
  }, [userId]);

  const loadEscalationDetail = useCallback(async (escalationId) => {
    if (!escalationId) return;
    setIsEscalationDetailLoading(true);
    setEscalationDetailError('');
    try {
      const data = await supportChatApi.getEscalationDetail(escalationId);
      const detail = data?.questionEscalation || data?.escalation || data || {};
      const latestAnswer = data?.latestMentorAnswer;
      const mentorAnswer = typeof latestAnswer === 'string'
        ? latestAnswer
        : latestAnswer?.answer || latestAnswer?.content || latestAnswer?.mentorAnswer || '';
      const normalized = normalizeEscalation({
        ...detail,
        mentorAnswer: mentorAnswer || detail?.mentorAnswer,
        studentVisibleStatus: data?.studentVisibleStatus,
        knowledgeCandidates: data?.knowledgeCandidates || [],
        aiBrainUpdated: Boolean(data?.aiBrainUpdated),
      });
      setSelectedEscalation((current) => (
        current?.id === escalationId ? { ...current, ...normalized } : current
      ));
      setEscalations((current) => current.map((item) => (
        item.id === escalationId ? { ...item, ...normalized } : item
      )));
      if (
        normalizeStatus(normalized.status) === 'RESOLVED_INDEXED'
        && normalized.conversationId
        && !handledResolvedConversationIdsRef.current.has(normalized.conversationId)
      ) {
        handledResolvedConversationIdsRef.current.add(normalized.conversationId);
        Promise.resolve(onConversationResolvedRef.current?.(normalized.conversationId)).catch(() => {});
      }
      return normalized;
    } catch (error) {
      setEscalationDetailError(getUserFacingError(error, 'Unable to load the complete review ticket.'));
    } finally {
      setIsEscalationDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'student-escalation') return undefined;
    const loadTimer = window.setTimeout(loadEscalations, 0);
    return () => window.clearTimeout(loadTimer);
  }, [activeTab, loadEscalations]);

  useEffect(() => {
    if (activeTab !== 'student-escalation' || !selectedEscalation?.id) return undefined;
    const detailTimer = window.setTimeout(
      () => loadEscalationDetail(selectedEscalation.id),
      0,
    );
    return () => window.clearTimeout(detailTimer);
  }, [activeTab, selectedEscalation?.id, loadEscalationDetail]);

  useEffect(() => {
    if (activeTab !== 'student-escalation' || !selectedEscalation?.id) return undefined;
    if (TERMINAL_ESCALATION_STATES.has(normalizeStatus(selectedEscalation.status))) return undefined;

    let cancelled = false;
    let timerId;
    let attempt = 0;
    const poll = async () => {
      await loadEscalationDetail(selectedEscalation.id);
      if (cancelled) return;
      attempt += 1;
      const delay = Math.min(5000 * (2 ** Math.min(attempt, 3)), 30000);
      timerId = window.setTimeout(poll, delay);
    };
    timerId = window.setTimeout(poll, 5000);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
    };
  }, [activeTab, loadEscalationDetail, selectedEscalation?.id, selectedEscalation?.status]);

  const handleSelectEscalation = (escalation) => {
    setSelectedEscalation(escalation);
  };

  const handleEscalationChange = useCallback((nextEscalation) => {
    if (!nextEscalation?.id) return;
    setSelectedEscalation((current) => (
      current?.id === nextEscalation.id ? { ...current, ...nextEscalation } : current
    ));
    setEscalations((current) => current.map((item) => (
      item.id === nextEscalation.id ? { ...item, ...nextEscalation } : item
    )));
  }, []);

  return {
    escalations,
    selectedEscalation,
    isEscalationsLoading,
    isEscalationDetailLoading,
    escalationsError,
    escalationDetailError,
    loadEscalations,
    handleSelectEscalation,
    handleEscalationChange,
  };
}
