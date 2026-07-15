import { useEffect, useMemo, useState } from 'react';
import { Alert, Avatar, Button, Empty, Radio, Spin, Tag } from 'antd';
import { GraduationCap, Search, Star } from 'lucide-react';
import { supportChatApi } from '../../services/supportChatApi';
import { getUserFacingError } from '../../services/apiClient';
import SupportChatRoom from './SupportChatRoom';

const normalizeStatus = (value) => String(value || '').trim().toUpperCase();

function StudentMentorFlow({ escalation, currentUser, compact = false, onEscalationChange }) {
  const [detail, setDetail] = useState(escalation || null);
  const [mentors, setMentors] = useState([]);
  const [selectedMentorId, setSelectedMentorId] = useState('');
  const [isOffering, setIsOffering] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [hasLoadedOffer, setHasLoadedOffer] = useState(false);
  const [error, setError] = useState('');
  const [routeMessage, setRouteMessage] = useState('');

  const escalationId = escalation?.id || escalation?.questionEscalationId || detail?.id || detail?.questionEscalationId;
  const userId = currentUser?.userId || currentUser?.id || currentUser?._id || '';
  const status = normalizeStatus(detail?.status || escalation?.status);
  const chatRoomId = detail?.chatRoomId || escalation?.chatRoomId || '';
  const selectedMentor = useMemo(
    () => mentors.find((mentor) => mentor.id === selectedMentorId),
    [mentors, selectedMentorId],
  );

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setDetail((current) => ({ ...current, ...escalation }));
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [escalation]);

  useEffect(() => {
    if (!escalationId) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await supportChatApi.getEscalationDetail(escalationId);
        const nextDetail = response?.questionEscalation || response?.escalation || response || {};
        if (!cancelled) setDetail((current) => ({ ...current, ...nextDetail }));
      } catch {
        // The parent ticket still contains enough state for offer/select in older BE responses.
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [escalationId]);

  const findMentors = async () => {
    if (!escalationId || isOffering) return;
    setIsOffering(true);
    setError('');
    try {
      const offer = await supportChatApi.offerMentors(escalationId);
      const suggestions = Array.isArray(offer?.suggestedMentors) ? offer.suggestedMentors : [];
      setHasLoadedOffer(true);
      setMentors(suggestions);
      setSelectedMentorId(suggestions.length === 1 ? suggestions[0].id : '');
      setRouteMessage(offer?.message || 'Choose a teacher to continue this question.');
      const next = { ...detail, status: 'OFFERED', escalationRoute: offer?.escalationRoute };
      setDetail(next);
      onEscalationChange?.(next);
    } catch (requestError) {
      setError(getUserFacingError(requestError, 'Unable to find a teacher for this question.'));
    } finally {
      setIsOffering(false);
    }
  };

  const chooseMentor = async () => {
    if (!escalationId || !userId || !selectedMentorId || isSelecting) return;
    setIsSelecting(true);
    setError('');
    try {
      const selection = await supportChatApi.selectMentor({
        questionEscalationId: escalationId,
        userId,
        selectedMentorId,
      });
      const next = {
        ...detail,
        status: 'IN_CHAT',
        chatRoomId: selection?.chatRoomId,
        assignedMentorId: selectedMentorId,
        assignedMentorName: selection?.mentorName || selectedMentor?.mentorName,
        assignedMentorEmail: selection?.mentorEmail,
      };
      setDetail(next);
      onEscalationChange?.(next);
    } catch (requestError) {
      setError(getUserFacingError(requestError, 'Unable to connect this teacher.'));
    } finally {
      setIsSelecting(false);
    }
  };

  if (!escalationId) return null;

  if (chatRoomId && ['IN_CHAT', 'CHAT_ACTIVE', 'MENTOR_SELECTED', 'COMPLETED'].includes(status)) {
    return (
      <SupportChatRoom
        chatRoomId={chatRoomId}
        currentUser={currentUser}
        allowClose={status !== 'COMPLETED'}
        compact={compact}
        onClosed={() => {
          const next = { ...detail, status: 'COMPLETED' };
          setDetail(next);
          onEscalationChange?.(next);
        }}
      />
    );
  }

  if (status.includes('ANSWERED') || ['COMPLETED', 'CANCELLED'].includes(status)) return null;

  return (
    <section className="mentor-selection-flow">
      <div className="mentor-selection-flow__heading">
        <div>
          <strong>Choose a teacher for this question</strong>
          <span>The backend matches the active class teacher first, then available mentors.</span>
        </div>
        <Tag color={status === 'OFFERED' ? 'blue' : 'orange'}>{status || 'PENDING_OFFER'}</Tag>
      </div>

      {error && <Alert type="error" showIcon message={error} />}
      {routeMessage && <Alert type="info" showIcon message={routeMessage} />}

      {mentors.length === 0 ? (
        <div className="mentor-selection-flow__empty">
          {isOffering ? (
            <><Spin size="small" /> Finding the teacher assigned to this course and class...</>
          ) : (
            <>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={hasLoadedOffer
                  ? 'No active teacher is currently eligible for this course and class.'
                  : 'Teacher suggestions have not been loaded yet.'}
              />
              <Button type="primary" icon={<Search size={15} />} onClick={findMentors}>
                {hasLoadedOffer ? 'Check again' : 'Find available teacher'}
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          <Radio.Group value={selectedMentorId} onChange={(event) => setSelectedMentorId(event.target.value)} className="mentor-selection-list">
            {mentors.map((mentor) => (
              <Radio key={mentor.id} value={mentor.id} className="mentor-selection-option">
                <Avatar src={mentor.avatarUrl} icon={<GraduationCap size={17} />} />
                <span className="mentor-selection-option__copy">
                  <strong>{mentor.mentorName || 'Teacher'}</strong>
                  <span>{mentor.matchReason || mentor.description || 'Available to help with this course question.'}</span>
                  <small>
                    {Number.isFinite(Number(mentor.averageRating)) && <><Star size={11} /> {Number(mentor.averageRating).toFixed(1)}</>}
                    {mentor.responseTimeMinutes ? ` · replies in about ${mentor.responseTimeMinutes} min` : ''}
                  </small>
                </span>
              </Radio>
            ))}
          </Radio.Group>
          <Button type="primary" loading={isSelecting} disabled={!selectedMentorId} onClick={chooseMentor}>
            Start chat with teacher
          </Button>
        </>
      )}
    </section>
  );
}

export default StudentMentorFlow;
