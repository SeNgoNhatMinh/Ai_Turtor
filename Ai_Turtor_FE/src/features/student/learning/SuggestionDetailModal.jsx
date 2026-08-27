import { PlayCircleOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { Button, Modal, Space, Tag, Typography } from 'antd';

const { Paragraph, Text, Title } = Typography;

function SuggestionDetailModal({
  open,
  display,
  statusLabel,
  statusColor,
  isConsumed,
  canStudy,
  canCreateQuiz,
  onClose,
  onStudy,
  onCreateQuiz,
}) {
  if (!display) return null;

  return (
    <Modal
      open={open}
      title="Chi tiết gợi ý học tập"
      width={680}
      centered
      destroyOnHidden
      onCancel={onClose}
      footer={(
        <Space wrap>
          <Button onClick={onClose}>Đóng</Button>
          <Button
            icon={<QuestionCircleOutlined />}
            disabled={!canCreateQuiz}
            onClick={onCreateQuiz}
          >
            Tạo quiz
          </Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            disabled={!canStudy}
            onClick={onStudy}
          >
            {isConsumed ? 'Đã học' : 'Học ngay'}
          </Button>
        </Space>
      )}
      className="learning-suggestion-detail-modal"
    >
      <div className="learning-suggestion-detail">
        <Space size={8} wrap>
          <Tag color={statusColor}>{statusLabel}</Tag>
          <Text type="secondary">Nội dung từ bộ nhớ học tập của môn</Text>
        </Space>

        <Title level={4}>{display.title}</Title>

        {display.summary ? (
          <Paragraph className="learning-suggestion-detail-summary">{display.summary}</Paragraph>
        ) : (
          <Paragraph type="secondary">Luyện tập và ôn lại nội dung này.</Paragraph>
        )}

        {display.steps.length > 0 && (
          <section className="learning-suggestion-detail-steps" aria-labelledby="suggestion-detail-steps-title">
            <Text id="suggestion-detail-steps-title" strong>Các bước nên làm</Text>
            <ol>
              {display.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
          </section>
        )}
      </div>
    </Modal>
  );
}

export default SuggestionDetailModal;
