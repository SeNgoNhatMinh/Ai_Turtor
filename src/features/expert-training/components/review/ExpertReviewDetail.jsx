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
          <span className="expert-training__eyebrow">NỘI DUNG CHỜ DUYỆT</span>
          <Title level={4}>{isGold ? item.question : item.name}</Title>
        </div>
        <StatusLabel status={item.status} />
      </div>

      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label="Chương">{item.chapter}</Descriptions.Item>
        <Descriptions.Item label="Loại">
          {isGold ? `Gold Q&A · ${item.usage}` : 'Rubric'}
        </Descriptions.Item>
        {isGold && <Descriptions.Item label="Độ khó">{item.difficulty}</Descriptions.Item>}
      </Descriptions>

      {isGold ? (
        <>
          <section className="expert-training__review-content-section">
            <h3>Câu hỏi chuẩn</h3>
            <Paragraph>{item.question}</Paragraph>
          </section>
          <section className="expert-training__review-content-section">
            <h3>Gold Answer</h3>
            <Paragraph className="expert-training__preserve-text">{item.goldAnswer}</Paragraph>
          </section>
          <Alert
            type={item.usage === 'EVALUATION' ? 'info' : 'warning'}
            showIcon
            title={item.usage === 'EVALUATION' ? 'Evaluation holdout riêng tư' : 'Training Gold Q&A có thể vào RAG'}
            description={item.usage === 'EVALUATION'
              ? 'Phê duyệt chỉ đưa nội dung vào bộ đánh giá, không index vào RAG.'
              : 'Phê duyệt sẽ cho phép backend index nội dung này vào tri thức của môn học.'}
          />
        </>
      ) : (
        <section className="expert-training__review-content-section">
          <h3>Mô tả Rubric</h3>
          <Paragraph>{item.description || 'Không có mô tả.'}</Paragraph>
          <Space wrap>
            {Object.entries(item.criteriaWeights).map(([name, weight]) => (
              <Tag key={name}>{name}: {Math.round(Number(weight) * 100)}%</Tag>
            ))}
          </Space>
        </section>
      )}

      <Form form={form} layout="vertical" className="expert-training__review-form">
        <Form.Item label="Nhận xét kiểm duyệt" name="reviewNote">
          <Input.TextArea rows={4} maxLength={5000} placeholder="Ghi nhận xét hoặc nêu rõ nội dung cần chỉnh sửa..." />
        </Form.Item>
      </Form>

      <div className="expert-training__review-actions">
        <Text type="secondary">Backend quyết định trạng thái cuối; FE sẽ tải lại dữ liệu canonical sau thao tác.</Text>
        <Space wrap>
          <Button danger icon={<X size={15} />} onClick={onReject} disabled={pending}>
            Yêu cầu chỉnh sửa
          </Button>
          <Button
            type="primary"
            icon={<Check size={15} />}
            onClick={onApprove}
            loading={pendingAction === `${isGold ? 'review-gold' : 'review-rubric'}:${item.id}`}
            disabled={pending}
          >
            Phê duyệt
          </Button>
        </Space>
      </div>
    </div>
  );
}
