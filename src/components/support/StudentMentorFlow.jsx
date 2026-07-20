import { useEffect, useMemo, useState } from 'react';
import { Alert, Avatar, Button, Empty, Radio, Spin, Tag } from 'antd';
import { GraduationCap, Search, Star } from 'lucide-react';
import { supportChatApi } from '../../services/supportChatApi';
import { getUserFacingError } from '../../services/apiClient';
import SupportChatRoom from './SupportChatRoom';

const normalizeStatus = (value) => String(value || '').trim().toUpperCase();
const STATUS_LABELS = {
  PENDING_OFFER: 'Đang tìm giáo viên',
  WAITING_FOR_MENTOR: 'Đang chờ mentor',
  OFFERED: 'Đã có giáo viên phù hợp',
  MENTOR_SELECTED: 'Đã chọn giáo viên',
  IN_CHAT: 'Đang trao đổi',
  CHAT_ACTIVE: 'Đang trao đổi',
};

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
      setRouteMessage(offer?.message || 'Hãy chọn một giáo viên để tiếp tục trao đổi câu hỏi này.');
      const next = { ...detail, status: 'OFFERED', escalationRoute: offer?.escalationRoute };
      setDetail(next);
      onEscalationChange?.(next);
    } catch (requestError) {
      setError(getUserFacingError(requestError, 'Không thể tìm giáo viên phù hợp cho câu hỏi này.'));
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
      setError(getUserFacingError(requestError, 'Không thể kết nối với giáo viên này.'));
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
          <strong>Chọn giáo viên cho câu hỏi này</strong>
          <span>Hệ thống ưu tiên giáo viên phụ trách lớp, sau đó đến các mentor đang sẵn sàng.</span>
        </div>
        <Tag color={status === 'OFFERED' ? 'blue' : 'orange'}>{STATUS_LABELS[status] || status || STATUS_LABELS.PENDING_OFFER}</Tag>
      </div>

      {error && <Alert type="error" showIcon title={error} />}
      {routeMessage && <Alert type="info" showIcon title={routeMessage} />}

      {mentors.length === 0 ? (
        <div className="mentor-selection-flow__empty">
          {isOffering ? (
            <><Spin size="small" /> Đang tìm giáo viên phụ trách môn và lớp này...</>
          ) : (
            <>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={hasLoadedOffer
                  ? 'Hiện chưa có giáo viên hoạt động phù hợp với môn và lớp này.'
                  : 'Danh sách giáo viên phù hợp chưa được tải.'}
              />
              <Button type="primary" icon={<Search size={15} />} onClick={findMentors}>
                {hasLoadedOffer ? 'Kiểm tra lại' : 'Tìm giáo viên'}
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
                  <strong>{mentor.mentorName || 'Giáo viên'}</strong>
                  <span>{mentor.matchReason || mentor.description || 'Sẵn sàng hỗ trợ câu hỏi của môn học này.'}</span>
                  <small>
                    {Number.isFinite(Number(mentor.averageRating)) && <><Star size={11} /> {Number(mentor.averageRating).toFixed(1)}</>}
                    {mentor.responseTimeMinutes ? ` · phản hồi khoảng ${mentor.responseTimeMinutes} phút` : ''}
                  </small>
                </span>
              </Radio>
            ))}
          </Radio.Group>
          <Button type="primary" loading={isSelecting} disabled={!selectedMentorId} onClick={chooseMentor}>
            Bắt đầu trao đổi
          </Button>
        </>
      )}
    </section>
  );
}

export default StudentMentorFlow;
