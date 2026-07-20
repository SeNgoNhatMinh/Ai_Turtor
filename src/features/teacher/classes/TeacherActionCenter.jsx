import { Alert, Button, Card, Skeleton } from 'antd';
import { AlertTriangle, ClipboardCheck, FileCheck2, LifeBuoy, RefreshCw } from 'lucide-react';
import ActionQueue from '../../../components/common/ActionQueue';

const ICONS = {
  'quiz-review': ClipboardCheck,
  'assignment-review': FileCheck2,
  escalations: LifeBuoy,
  'answer-reviews': LifeBuoy,
  'failed-materials': AlertTriangle,
};

export default function TeacherActionCenter({ items, loading, error, hasScope, onRefresh, onNavigate }) {
  return (
    <Card
      className="teacher-action-center"
      title="Việc cần xử lý"
      extra={(
        <Button size="small" icon={<RefreshCw size={14} />} onClick={onRefresh} disabled={!hasScope || loading}>
          Làm mới
        </Button>
      )}
    >
      {!hasScope ? (
        <Alert type="info" showIcon title="Chọn môn và lớp để tải hàng chờ công việc." />
      ) : loading ? (
        <Skeleton active title={false} paragraph={{ rows: 3 }} />
      ) : (
        <>
          {error && <Alert type="warning" showIcon title={error} className="teacher-action-center__error" />}
          <ActionQueue
            items={items.map((item) => ({
              ...item,
              icon: ICONS[item.key],
              onClick: () => onNavigate?.(item.tab),
            }))}
            emptyText="Không có bài nộp, phản hồi hoặc lỗi học liệu cần xử lý trong lớp này."
          />
        </>
      )}
    </Card>
  );
}
