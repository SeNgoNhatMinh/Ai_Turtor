import { Alert } from 'antd';
import PageHeader from '../../../components/common/PageHeader';
import AiLogFilters from './components/AiLogFilters';
import AiLogMetrics from './components/AiLogMetrics';
import AiRequestLogsTable from './components/AiRequestLogsTable';
import LlmProviderManagementTable from './components/LlmProviderManagementTable';
import ProviderStatusTable from './components/ProviderStatusTable';
import { useAdminAiLogs } from './hooks/useAdminAiLogs';
import './AdminAiLogsPage.css';

const SECTIONS = {
  providers: {
    title: 'Quản lý LLM Provider Chain',
    description: 'Xem thứ tự ưu tiên, model và các thao tác bật, tắt, khôi phục provider đang có.',
  },
  runtime: {
    title: 'Thống kê runtime theo provider',
    description: 'Số liệu từ lần khởi động backend gần nhất. Công thức thống kê giữ nguyên.',
  },
  history: {
    title: 'Theo dõi tiến trình & lỗi AI',
    description: 'Theo dõi trạng thái yêu cầu, lọc lỗi và xem chi tiết câu hỏi/phản hồi. Nhật ký tự làm mới định kỳ.',
  },
};

export default function AdminAiLogsPage({ section = 'providers' }) {
  const controller = useAdminAiLogs(section);
  const page = SECTIONS[section] || SECTIONS.providers;

  return (
    <div className="portal-section admin-route-page admin-ai-logs-page">
      <PageHeader
        eyebrow="Nhật ký trả lời AI"
        title={page.title}
        description={page.description}
      />
      {section === 'history' && <AiLogMetrics summary={controller.summary} />}
      {section === 'history' && (
        <AiLogFilters
          loading={controller.loading}
          onApply={controller.applyFilters}
          onReset={controller.refreshAll}
        />
      )}
      {section === 'history' && (
        <Alert
          className="admin-ai-logs-observability-note"
          type="info"
          showIcon
          message="Mức quan sát hiện tại"
          description="FE hiển thị trạng thái từ lịch sử hội thoại. Để xem từng bước như retrieval, rerank, prompt, provider/model, retry, timeout và stack trace, backend cần phát sinh trace ID cùng event logs cho từng bước."
        />
      )}
      {section === 'history' && controller.error && (
        <Alert className="admin-ai-logs-alert" type="error" showIcon title={controller.error} />
      )}
      {section === 'providers' && controller.providerError && (
        <Alert
          className="admin-ai-logs-alert"
          type="error"
          showIcon
          closable
          title={controller.providerError}
        />
      )}
      {section === 'providers' && controller.providerNotice && (
        <Alert
          className="admin-ai-logs-alert"
          type="success"
          showIcon
          closable
          title={controller.providerNotice}
        />
      )}
      {section === 'runtime' && controller.providerError && (
        <Alert className="admin-ai-logs-alert" type="error" showIcon title={controller.providerError} />
      )}
      {section === 'providers' && (
        <LlmProviderManagementTable
          providers={controller.providerConfigs}
          loading={controller.providerConfigLoading}
          mutationKey={controller.providerMutationKey}
          onUpdate={controller.updateProvider}
          onSetEnabled={controller.setProviderEnabled}
          onDelete={controller.deleteProvider}
          onRestore={controller.restoreProvider}
          onReload={controller.reloadProviderChain}
        />
      )}
      {section === 'runtime' && (
        <ProviderStatusTable providers={controller.providerStats} loading={controller.providerLoading} />
      )}
      {section === 'history' && (
        <AiRequestLogsTable
          logs={controller.logs}
          loading={controller.loading}
          pagination={controller.logPagination}
          query={controller.logQuery}
          onSearch={controller.searchLogs}
          onRefresh={controller.refreshAll}
          autoRefresh={controller.autoRefresh}
          onAutoRefreshChange={controller.setAutoRefresh}
        />
      )}
    </div>
  );
}
