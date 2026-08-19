import {
  Alert,
  Button,
  Descriptions,
  Form,
  Input,
  Space,
  Tag,
  Typography,
} from 'antd';
import { Check, X } from 'lucide-react';
import StatusLabel from '../../../../components/common/StatusLabel';

const { Paragraph, Text, Title } = Typography;

function examTone(item) {
  if (item.examError) return 'error';
  if (item.examPassed) return 'success';
  if (item.examPassed === false) return 'warning';
  return 'info';
}

function examTitle(item) {
  if (item.examError) return `Chấm thi lỗi: ${item.examError}`;
  if (item.examPassed) return `AI đạt ${(Number(item.examScore) * 100).toFixed(0)}% — hợp để nạp RAG nếu Senior đồng ý`;
  if (item.examPassed === false) return `AI chưa đạt (${item.examScore == null ? '—' : `${(Number(item.examScore) * 100).toFixed(0)}%`}) — nên trả Teacher viết lại`;
  return 'Chưa có bài thi. Nộp Q&A sẽ chấm bằng giáo trình đã embed.';
}

export default function ExpertReviewDetail({
  entry,
  form,
  pendingAction,
  onApprove,
  onReject,
}) {
  const item = entry.item;
  const isGold = entry.kind === 'GOLD_QA';
  const pending = Boolean(pendingAction);

  return (
    <div className="expert-training__review-detail-panel">
      <div className="expert-training__review-detail-head">
        <div>
          <span className="expert-training__eyebrow">BÀI THI Q&A VÀNG</span>
          <Title level={4}>{isGold ? item.question : item.name}</Title>
        </div>
        <StatusLabel status={item.status} />
      </div>

      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="Chương">{item.chapter}</Descriptions.Item>
        {isGold && <Descriptions.Item label="Độ khó">{item.difficulty}</Descriptions.Item>}
      </Descriptions>

      {isGold ? (
        <>
          <section className="expert-training__review-content-section">
            <h3>Câu hỏi vàng</h3>
            <Paragraph>{item.question}</Paragraph>
          </section>
          <section className="expert-training__review-content-section">
            <h3>Đáp án Teacher</h3>
            <Paragraph className="expert-training__preserve-text">{item.goldAnswer}</Paragraph>
          </section>
          <section className="expert-training__review-content-section">
            <h3>AI trả lời (chỉ dùng sách, chưa nạp Q&A)</h3>
            <Paragraph className="expert-training__preserve-text">
              {item.examAiAnswer || 'Chưa chấm được.'}
            </Paragraph>
          </section>
          <Alert
            type={examTone(item)}
            showIcon
            title={examTitle(item)}
            description={item.examHallucinated ? 'AI có dấu hiệu bịa hoặc muốn escalate.' : undefined}
          />
        </>
      ) : (
        <section className="expert-training__review-content-section">
          <h3>Rubric</h3>
          <Paragraph>{item.description || 'Không có mô tả.'}</Paragraph>
          <Space wrap>
            {Object.entries(item.criteriaWeights || {}).map(([name, weight]) => (
              <Tag key={name}>{name}: {Math.round(Number(weight) * 100)}%</Tag>
            ))}
          </Space>
        </section>
      )}

      <Form form={form} layout="vertical" className="expert-training__review-form">
        <Form.Item label="Nhận xét" name="reviewNote">
          <Input.TextArea rows={4} maxLength={5000} placeholder="Ghi chú khi nạp RAG hoặc lý do trả lại Teacher..." />
        </Form.Item>
      </Form>

      <div className="expert-training__review-actions">
        <Text type="secondary">Nạp RAG chỉ khi Senior thấy bài thi hợp giáo trình.</Text>
        <Space wrap>
          <Button danger icon={<X size={15} />} onClick={onReject} disabled={pending}>
            Trả lại Teacher
          </Button>
          <Button
            type="primary"
            icon={<Check size={15} />}
            onClick={onApprove}
            loading={pendingAction === `${isGold ? 'review-gold' : 'review-rubric'}:${item.id}`}
            disabled={pending}
          >
            Nạp vào RAG
          </Button>
        </Space>
      </div>
    </div>
  );
}
