import { memo } from 'react';
import { Button, Card, Empty } from 'antd';
import { FileSearchOutlined, PlayCircleOutlined, QuestionCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import QuizItemCard from './QuizItemCard';
import { getQuizId, normalizeQuizStatus } from './practiceQuizUtils';

function QuizHistoryPanel({ history, loadingKey, hasContext, isLoading, onRefresh, onView, onGenerateFirst }) {
  return (
    <Card
      className="quiz-card"
      title="Lịch sử quiz"
      extra={<Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} loading={loadingKey === 'refresh'} disabled={!hasContext}>Làm mới</Button>}
    >
      {history.length ? (
        <div className="quiz-item-list">
          {history.map((item) => {
            const quizId = getQuizId(item);
            const isGenerated = normalizeQuizStatus(item.status) === 'GENERATED';
            return (
              <QuizItemCard
                key={quizId || item.title || item.topic}
                item={item}
                action={(
                  <Button
                    size="small"
                    icon={isGenerated ? <PlayCircleOutlined /> : <FileSearchOutlined />}
                    loading={loadingKey === `quiz:${quizId}`}
                    disabled={!hasContext || isLoading}
                    onClick={() => onView(quizId, item.status)}
                  >
                    {isGenerated ? 'Tiếp tục' : 'Xem kết quả'}
                  </Button>
                )}
              />
            );
          })}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có quiz tự ôn">
          <Button type="primary" icon={<QuestionCircleOutlined />} onClick={onGenerateFirst}>Tạo quiz đầu tiên</Button>
        </Empty>
      )}
    </Card>
  );
}

export default memo(QuizHistoryPanel);
