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
      title={(
        <div className="teacher-action-center__heading">
          <strong>Việc cần xử lý</strong>
          <span>Bài nộp, quiz và phản hồi đang chờ trong lớp hiện tại</span>
        </div>
      )}
      extra={(
        <div className="teacher-action-center__extra">
          {hasScope && !loading && items.length > 0 ? (
            <em>{items.length} nhóm việc</em>
          ) : null}
          <Button size="small" icon={<RefreshCw size={14} />} onClick={onRefresh} disabled={!hasScope || loading}>
            Làm mới
          </Button>
        </div>
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
