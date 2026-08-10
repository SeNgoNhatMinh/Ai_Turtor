import { Alert } from 'antd';
import PageHeader from '../../../components/common/PageHeader';
import AiLogFilters from './components/AiLogFilters';
import AiLogMetrics from './components/AiLogMetrics';
import AiRequestLogsTable from './components/AiRequestLogsTable';
import ProviderStatusTable from './components/ProviderStatusTable';
import { useAdminAiLogs } from './hooks/useAdminAiLogs';
import './AdminAiLogsPage.css';

export default function AdminAiLogsPage() {
  const controller = useAdminAiLogs();

  return (
    <div className="portal-section admin-route-page admin-ai-logs-page">
      <PageHeader
        eyebrow="Giám sát AI"
        title="Nhật ký hỏi đáp AI"
        description="Theo dõi câu hỏi, câu trả lời, tiến trình và mức sử dụng ước tính của sinh viên."
      />
      <AiLogMetrics summary={controller.summary} />
      <AiLogFilters
        loading={controller.loading}
        onApply={controller.applyFilters}
        onReset={controller.refreshAll}
      />
      {controller.error && (
        <Alert className="admin-ai-logs-alert" type="error" showIcon title={controller.error} />
      )}
      <ProviderStatusTable providers={controller.providerStats} loading={controller.providerLoading} />
      <AiRequestLogsTable logs={controller.logs} loading={controller.loading} />
    </div>
  );
}
