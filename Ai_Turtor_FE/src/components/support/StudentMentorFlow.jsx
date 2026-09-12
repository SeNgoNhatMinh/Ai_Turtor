import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Avatar, Empty, Radio, Spin, Tag } from 'antd';
import { GraduationCap, Search, Star } from 'lucide-react';
import { queryKeys } from '../../app/queryKeys';
import { getUserFacingError } from '../../services/apiClient';
import { normalizeEscalationDetailResponse } from '../../services/normalizers';
import { supportChatApi } from '../../services/supportChatApi';
import ActionButton from '../common/ActionButton';
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
  const queryClient = useQueryClient();
  const [offeredMentors, setOfferedMentors] = useState([]);
  const [selectedMentorId, setSelectedMentorId] = useState('');
  const [hasLoadedOffer, setHasLoadedOffer] = useState(false);
  const [routeMessage, setRouteMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const escalationId = escalation?.id || escalation?.questionEscalationId || '';
  const userId = currentUser?.userId || currentUser?.id || currentUser?._id || '';
  const detailQuery = useQuery({
    queryKey: queryKeys.studentMentorRequestDetail(escalationId),
    queryFn: async ({ signal }) => normalizeEscalationDetailResponse(
      await supportChatApi.getEscalationDetail(escalationId, { signal }),
    ),
    enabled: Boolean(escalationId),
    staleTime: 10_000,
  });
  const detail = useMemo(
    () => ({ ...(escalation || {}), ...(detailQuery.data || {}) }),
    [detailQuery.data, escalation],
  );
  const mentors = useMemo(() => (
    offeredMentors.length
      ? offeredMentors
      : Array.isArray(detail?.suggestedMentors) ? detail.suggestedMentors : []
  ), [detail, offeredMentors]);
  const effectiveMentorId = selectedMentorId || (mentors.length === 1 ? mentors[0].id : '');
  const selectedMentor = useMemo(
    () => mentors.find((mentor) => mentor.id === effectiveMentorId),
    [effectiveMentorId, mentors],
  );
  const status = normalizeStatus(detail?.status || escalation?.status);
  const chatRoomId = detail?.chatRoomId || escalation?.chatRoomId || '';
  const statusLabel = mentors.length > 0
    ? (STATUS_LABELS[status] || status || STATUS_LABELS.PENDING_OFFER)
    : hasLoadedOffer
      ? 'Chưa có giáo viên phù hợp'
      : 'Sẵn sàng tìm giáo viên';

  const updateEscalationCache = useCallback((next) => {
    if (!next?.id) return;
    queryClient.setQueryData(
      queryKeys.studentMentorRequestDetail(next.id),
      (current) => ({ ...(current || {}), ...next }),
    );
    if (userId) {
      queryClient.setQueryData(
        queryKeys.studentMentorRequests(userId),
        (current = []) => current.map((item) => (
          item.id === next.id ? { ...item, ...next } : item
        )),
      );
    }
    onEscalationChange?.(next);
  }, [onEscalationChange, queryClient, userId]);

  const offerMutation = useMutation({
    mutationFn: () => supportChatApi.offerMentors(escalationId),
    onMutate: () => setActionError(''),
    onSuccess: (offer) => {
      const suggestions = Array.isArray(offer?.suggestedMentors) ? offer.suggestedMentors : [];
      setHasLoadedOffer(true);
      setOfferedMentors(suggestions);
      setSelectedMentorId(suggestions.length === 1 ? suggestions[0].id : '');
      setRouteMessage(offer?.message || 'Hãy chọn một giáo viên để tiếp tục trao đổi câu hỏi này.');
      updateEscalationCache({
        ...detail,
        id: escalationId,
        status: 'OFFERED',
        suggestedMentors: suggestions,
        escalationRoute: offer?.escalationRoute,
      });
    },
    onError: (error) => setActionError(
      getUserFacingError(error, 'Không thể tìm giáo viên phù hợp cho câu hỏi này.'),
    ),
  });

  const selectMutation = useMutation({
    mutationFn: () => supportChatApi.selectMentor({
      questionEscalationId: escalationId,
      userId,
      selectedMentorId: effectiveMentorId,
    }),
    onMutate: () => setActionError(''),
    onSuccess: (selection) => updateEscalationCache({
      ...detail,
      id: escalationId,
      status: 'IN_CHAT',
      chatRoomId: selection?.chatRoomId,
      assignedMentorId: effectiveMentorId,
      assignedMentorName: selection?.mentorName || selectedMentor?.mentorName,
      assignedMentorEmail: selection?.mentorEmail,
    }),
    onError: (error) => setActionError(
      getUserFacingError(error, 'Không thể kết nối với giáo viên này.'),
    ),
  });

  const findMentors = () => {
    if (!escalationId || offerMutation.isPending) return;
    offerMutation.mutate();
  };

  const chooseMentor = () => {
    if (!escalationId || !userId || !effectiveMentorId || selectMutation.isPending) return;
    selectMutation.mutate();
  };

  if (!escalationId) return null;

  if (chatRoomId) {
    const isConversationClosed = status.includes('ANSWERED')
      || ['COMPLETED', 'CLOSED', 'CANCELLED'].includes(status);
    return (
      <SupportChatRoom
        chatRoomId={chatRoomId}
        currentUser={currentUser}
        allowClose={!isConversationClosed}
        readOnly={isConversationClosed}
        compact={compact}
        onClosed={() => updateEscalationCache({ ...detail, id: escalationId, status: 'COMPLETED' })}
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
        <Tag color={mentors.length > 0 ? 'blue' : hasLoadedOffer ? 'default' : 'gold'}>{statusLabel}</Tag>
      </div>

      {actionError && <Alert type="error" showIcon title={actionError} />}
      {routeMessage && <Alert type="info" showIcon title={routeMessage} />}

      {mentors.length === 0 ? (
        <div className="mentor-selection-flow__empty">
          {offerMutation.isPending ? (
            <><Spin size="small" /> Đang tìm giáo viên phụ trách môn và lớp này...</>
          ) : (
            <>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={hasLoadedOffer
                  ? 'Hiện chưa có giáo viên hoạt động phù hợp với môn và lớp này.'
                  : 'Danh sách giáo viên phù hợp chưa được tải.'}
              />
              <ActionButton intent="primary" icon={<Search size={15} />} onClick={findMentors}>
                {hasLoadedOffer ? 'Kiểm tra lại' : 'Tìm giáo viên'}
              </ActionButton>
            </>
          )}
        </div>
      ) : (
        <>
          <Radio.Group value={effectiveMentorId} onChange={(event) => setSelectedMentorId(event.target.value)} className="mentor-selection-list">
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
          <ActionButton intent="primary" loading={selectMutation.isPending} disabled={!effectiveMentorId} onClick={chooseMentor}>
            Bắt đầu trao đổi
          </ActionButton>
        </>
      )}
    </section>
  );
}

export default StudentMentorFlow;
