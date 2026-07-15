import { memo } from 'react';
import { Button, Card, Empty } from 'antd';
import { PlayCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import QuizItemCard from './QuizItemCard';
import { getAssignmentId } from './practiceQuizUtils';

function AssignedQuizzesPanel({ assignments, loadingKey, hasContext, isLoading, onRefresh, onStart }) {
  return (
    <Card
      className="quiz-card"
      title="Assigned Quizzes"
      extra={<Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} loading={loadingKey === 'refresh'} disabled={!hasContext}>Refresh quizzes</Button>}
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
                    Start
                  </Button>
                )}
              />
            );
          })}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No assigned quizzes for this course">
          <Button icon={<ReloadOutlined />} onClick={onRefresh} disabled={!hasContext} loading={loadingKey === 'refresh'}>Check again</Button>
        </Empty>
      )}
    </Card>
  );
}

export default memo(AssignedQuizzesPanel);
