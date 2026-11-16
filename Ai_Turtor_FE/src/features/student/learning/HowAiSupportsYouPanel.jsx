import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentLearningApi } from '../../../services/studentLearningApi';
import { tutorSessionApi } from '../../../services/tutorSessionApi';
import {
  AI_SUPPORT_DESCRIPTION,
  AI_SUPPORT_TITLE,
  AI_SUPPORT_TRANSPARENCY,
  buildLearningOverview,
  buildTeachingApproaches,
  supportLevelPlainLabel,
} from './aiSupportPresentation';
import './HowAiSupportsYouPanel.css';

function TopicBlock({ title, items, emptyText }) {
  return (
    <div className="ai-support-overview__block">
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.slice(0, 6).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="ai-support-empty">{emptyText}</p>
      )}
    </div>
  );
}

/**
 * Student-facing view of how AI personalizes teaching for the current course.
 * Uses only student-accessible learning memory + support-profile APIs.
 */
export default function HowAiSupportsYouPanel({
  studentId,
  courseId,
  classId,
  supportLevel: supportLevelProp = '',
  compact = false,
}) {
  const enabled = Boolean(studentId && courseId);

  const memoryQuery = useQuery({
    queryKey: ['student', 'ai-support-memory', studentId, courseId],
    queryFn: ({ signal }) => studentLearningApi.getStudentMemory(studentId, courseId, {
      signal,
      skipUnauthorizedRedirect: true,
    }),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });

  const profileQuery = useQuery({
    queryKey: ['student', 'support-profile', studentId, courseId, classId || ''],
    queryFn: ({ signal }) => tutorSessionApi.getStudentSupportProfile(
      studentId,
      courseId,
      classId,
      { signal, skipUnauthorizedRedirect: true },
    ),
    enabled,
    staleTime: 30_000,
    retry: 1,
  });

  const memory = memoryQuery.data || {};
  const supportLevel = supportLevelProp
    || profileQuery.data?.supportLevel
    || '';

  const overview = useMemo(() => buildLearningOverview({
    masteredTopics: memory.learnedTopics,
    improveTopics: memory.weakTopics,
    recentResults: [
      ...(Array.isArray(memory.recentQuestions) ? memory.recentQuestions.map((q) => `Đã hỏi: ${q}`) : []),
      ...(memory.summary ? [memory.summary] : []),
    ].slice(0, 5),
    updatedAt: memory.updatedAt,
  }), [memory]);

  const approaches = useMemo(() => buildTeachingApproaches({
    supportLevel,
    masteredTopics: overview.masteredTopics,
    improveTopics: overview.improveTopics,
  }), [overview.improveTopics, overview.masteredTopics, supportLevel]);

  if (!enabled) return null;

  const loading = memoryQuery.isLoading || profileQuery.isLoading;
  const plainLevel = supportLevelPlainLabel(supportLevel);

  return (
    <section
      className={`ai-support-panel${compact ? ' ai-support-panel--compact' : ''}`}
      aria-label={AI_SUPPORT_TITLE}
    >
      <header className="ai-support-panel__header">
        <div>
          <h3>{AI_SUPPORT_TITLE}</h3>
          <p>{AI_SUPPORT_DESCRIPTION}</p>
        </div>
        {plainLevel ? <span className="ai-support-panel__level">{plainLevel}</span> : null}
      </header>

      {loading ? (
        <p className="ai-support-empty">Đang tải thông tin hỗ trợ học…</p>
      ) : (
        <>
          <div className="ai-support-overview">
            <TopicBlock
              title="Kiến thức đã nắm vững"
              items={overview.masteredTopics}
              emptyText="Chưa có dữ liệu từ quá trình học của bạn."
            />
            <TopicBlock
              title="Kiến thức cần cải thiện"
              items={overview.improveTopics}
              emptyText="Chưa phát hiện chủ đề cần củng cố."
            />
            <TopicBlock
              title="Kết quả học tập gần đây"
              items={overview.recentResults}
              emptyText="Hãy trò chuyện hoặc làm quiz để AI bắt đầu điều chỉnh cách hỗ trợ."
            />
          </div>

          <div className="ai-support-approaches">
            <h4>Cách AI đang dạy bạn</h4>
            {approaches.length > 0 ? (
              <ul>
                {approaches.map((item) => (
                  <li key={item.key}>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ai-support-empty">
                AI sẽ chọn cách giảng phù hợp sau khi có thêm kết quả học tập của bạn.
              </p>
            )}
          </div>

          <footer className="ai-support-panel__footer">
            <p>{AI_SUPPORT_TRANSPARENCY}</p>
            {overview.updatedAt ? (
              <span>Cập nhật lần cuối: {overview.updatedAt}</span>
            ) : null}
          </footer>
        </>
      )}
    </section>
  );
}
