import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../../app/queryKeys';
import ActionButton from '../../../components/common/ActionButton';
import AsyncState from '../../../components/common/AsyncState';
import { expertTrainingApi } from '../../../services/expertTrainingApi';
import { getUserFacingError } from '../../../services/httpClient';

const REASONS = {
  ESCALATED: 'Chuyển giáo viên',
  GROUNDING_BLOCKED: 'Không đủ tài liệu',
  WORKER_FAILED: 'Worker lỗi',
  LOW_EVAL: 'Điểm đánh giá chương thấp',
};

const VERDICTS = {
  BETTER: 'Tốt hơn',
  WORSE: 'Vẫn lỗi',
};

export default function HarnessMonitorPanel({ courseId, triggerToast }) {
  const queryClient = useQueryClient();
  const casesQuery = useQuery({
    queryKey: queryKeys.expertHarnessCases(courseId),
    queryFn: ({ signal }) => expertTrainingApi.getHarnessCases(courseId, { signal }),
    enabled: Boolean(courseId),
  });
  const replay = useMutation({
    mutationFn: (caseId) => expertTrainingApi.replayHarnessCase(caseId),
    onSuccess: async (saved) => {
      triggerToast?.(saved?.verdictNote || 'Đã chạy lại ca harness.');
      await queryClient.invalidateQueries({ queryKey: queryKeys.expertHarnessCases(courseId) });
    },
    onError: (error) => triggerToast?.(getUserFacingError(error, 'Không chạy lại được ca này.')),
  });
  const cases = casesQuery.data || [];

  return (
    <section className="expert-training__harness" aria-label="Giám sát harness">
      <p>
        Ca lỗi được ghi tự động khi chat không trả lời được hoặc bài đánh giá chương chưa đạt.
        Sau khi nạp RAG, hệ thống tự chạy lại tối đa 3 ca của môn này.
      </p>
      <AsyncState
        loading={casesQuery.isPending}
        error={casesQuery.error ? getUserFacingError(casesQuery.error, 'Không tải được ca harness.') : ''}
        empty={!casesQuery.isPending && !casesQuery.error && cases.length === 0}
        emptyTitle="Chưa có ca cần chạy lại"
        emptyDescription="Ca sẽ xuất hiện khi một câu trả lời bị chuyển giáo viên, thiếu tài liệu, worker lỗi, hoặc điểm đánh giá chương thấp."
        onRetry={() => casesQuery.refetch()}
      >
        <ul className="expert-training__harness-list">
          {cases.map((item) => (
            <li key={item.id}>
              <strong>{REASONS[item.reason] || item.reason}</strong>
              <span>{item.chapter ? `${item.chapter} · ` : ''}{item.question}</span>
              <small>
                {item.status === 'OPEN' ? 'Chờ chạy lại' : (VERDICTS[item.verdict] || item.verdict)}
                {item.verdictNote ? ` — ${item.verdictNote}` : ''}
              </small>
              {item.sourcePreview ? <p>Lần cũ: {item.sourcePreview}</p> : null}
              {item.replayPreview ? <p>Lần mới: {item.replayPreview}</p> : null}
              {item.status === 'OPEN' ? (
                <ActionButton
                  intent="primary"
                  loading={replay.isPending && replay.variables === item.id}
                  onClick={() => replay.mutate(item.id)}
                >
                  Chạy lại
                </ActionButton>
              ) : null}
            </li>
          ))}
        </ul>
      </AsyncState>
    </section>
  );
}
