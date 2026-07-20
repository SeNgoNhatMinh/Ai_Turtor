import { Alert, Button, Card, Skeleton } from 'antd';
import { BookOpen, ClipboardCheck, LifeBuoy, RefreshCw } from 'lucide-react';
import ActionQueue from '../../../components/common/ActionQueue';

const ICONS = {
  assignment: BookOpen,
  quiz: ClipboardCheck,
  assignedQuiz: ClipboardCheck,
  support: LifeBuoy,
};

export default function StudentNextSteps({ items = [], loading, error, onRefresh, onNavigate }) {
  return (
    <Card
      className="learning-card student-next-steps-card"
      title="Việc cần làm tiếp theo"
      extra={(
        <Button size="small" icon={<RefreshCw size={14} />} onClick={onRefresh} disabled={loading}>
          Làm mới
        </Button>
      )}
    >
      {error && <Alert type="warning" showIcon title={error} className="student-next-steps-error" />}
      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} title={false} />
      ) : (
        <ActionQueue
          emptyText="Hiện không có quiz, bài tập hoặc phản hồi hỗ trợ cần xử lý."
          items={items.map((item) => ({
            ...item,
            icon: ICONS[item.kind],
            onClick: () => onNavigate?.(item.tab),
          }))}
        />
      )}
    </Card>
  );
}
