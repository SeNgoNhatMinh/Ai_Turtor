import { memo } from 'react';
import { Button, Card, Empty } from 'antd';
import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import QuizItemCard from './QuizItemCard';
import { getAssignmentId } from './practiceQuizUtils';

function AssignedQuizzesPanel({ assignments, loadingKey, hasContext, isLoading, onRefresh, onStart }) {
  return (
    <Card
      className="quiz-card"
      title="Quiz giảng viên giao"
      extra={<Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} loading={loadingKey === 'refresh'} disabled={!hasContext}>Làm mới</Button>}
    >
      {assignments.length ? (
        <div className="quiz-item-list">
          {assignments.map((item) => {
            const assignmentId = getAssignmentId(item);
            return (
              <QuizItemCard
                key={assignmentId || item.title || item.topic}
                item={item}
                action={(
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    loading={loadingKey === `assignment:${assignmentId}`}
                    disabled={!hasContext || isLoading}
                    onClick={() => onStart(item)}
                  >
                    Bắt đầu
                  </Button>
                )}
              />
            );
          })}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Môn học này chưa có quiz được giao">
          <Button icon={<ReloadOutlined />} onClick={onRefresh} disabled={!hasContext} loading={loadingKey === 'refresh'}>Kiểm tra lại</Button>
        </Empty>
      )}
    </Card>
  );
}

export default memo(AssignedQuizzesPanel);
