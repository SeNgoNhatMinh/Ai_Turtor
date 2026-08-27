import { Alert } from 'antd';
import PageHeader from '../../components/common/PageHeader';
import AnswerCacheFilters from './components/AnswerCacheFilters';
import AnswerCacheStats from './components/AnswerCacheStats';
import AnswerCacheTable from './components/AnswerCacheTable';
import CacheHitAuditTable from './components/CacheHitAuditTable';
import { useAnswerCacheManagement } from './hooks/useAnswerCacheManagement';
import { useAnswerCacheScope } from './hooks/useAnswerCacheScope';
import './AnswerCachePage.css';

export default function AnswerCachePage({
  currentUser,
  courseId,
  setCourseId,
  triggerToast,
  mode = 'senior',
}) {
  const isAdmin = mode === 'admin';
  const scope = useAnswerCacheScope({ courseId, setCourseId });
  const controller = useAnswerCacheManagement({ currentUser, courseId, triggerToast });

  return (
    <div className="portal-section answer-cache-page">
      <PageHeader
        eyebrow={isAdmin ? 'Giám sát AI' : 'Kiểm duyệt chuyên môn'}
        title={isAdmin ? 'Quản lý cache câu trả lời AI' : 'Cache câu trả lời AI'}
        description={isAdmin
          ? 'Xem, duyệt, sửa hoặc tắt các câu trả lời AI đã được cache theo semantic similarity — tiết kiệm quota LLM.'
          : 'Kiểm soát chất lượng cache semantic: duyệt câu trả lời đúng, sửa nội dung sai hoặc tắt entry không phù hợp.'}
      />

      {scope.coursesError && (
        <Alert className="answer-cache-alert" type="warning" showIcon title={scope.coursesError} />
      )}

      {!courseId && !scope.loadingCourses && (
        <Alert
          className="answer-cache-alert"
          type="info"
          showIcon
          title="Chọn môn học để xem cache câu trả lời AI."
        />
      )}

      {controller.error && (
        <Alert className="answer-cache-alert" type="error" showIcon title={controller.error} />
      )}
      {controller.notice && (
        <Alert
          className="answer-cache-alert"
          type="success"
          showIcon
          closable
          title={controller.notice}
          onClose={() => controller.setNotice('')}
        />
      )}

      <AnswerCacheFilters
        courseId={courseId}
        courseOptions={scope.courseOptions}
        loadingCourses={scope.loadingCourses}
        filters={controller.filters}
        loading={controller.loading}
        onCourseChange={setCourseId}
        onChange={controller.setFilters}
        onRefresh={async () => {
          await scope.reloadCourses();
          await controller.refresh();
        }}
      />

      {courseId && <AnswerCacheStats stats={controller.stats} />}
      {courseId && controller.diagnostics && (
        <Alert
          className="answer-cache-alert"
          type="info"
          showIcon
          title={`Cache đang ${controller.diagnostics.enabled ? 'bật' : 'tắt'} · Exact RAM: ${controller.diagnostics.exactMemoryEntries || 0} · Semantic sớm ≥ ${Math.round((controller.diagnostics.semanticEarlyMinSimilarity || 0) * 100)}% · Semantic kiểm chứng ≥ ${Math.round((controller.diagnostics.semanticVerifiedMinSimilarity || 0) * 100)}%`}
        />
      )}

      {courseId && (
        <AnswerCacheTable
          entries={controller.entries}
          loading={controller.loading}
          mutationKey={controller.mutationKey}
          onApprove={controller.approveEntry}
          onCorrect={controller.correctEntry}
          onDisable={controller.disableEntry}
          onDelete={controller.deleteEntry}
        />
      )}
      {courseId && (
        <CacheHitAuditTable hits={controller.recentHits} loading={controller.loading} />
      )}
    </div>
  );
}
