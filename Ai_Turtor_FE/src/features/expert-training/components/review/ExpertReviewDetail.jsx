import {
  Alert,
  Form,
  Input,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useRef } from 'react';
import {
  BookOpenCheck,
  Check,
  Gauge,
  GraduationCap,
  MessageSquareText,
  X,
} from 'lucide-react';
import ActionButton from '../../../../components/common/ActionButton';
import StatusLabel from '../../../../components/common/StatusLabel';
import GoldQaExamCompare from '../contribution/GoldQaExamCompare';

const { Paragraph, Text, Title } = Typography;

function examTone(item) {
  if (item.examError) return 'error';
  if (item.examPassed) return 'success';
  if (item.examPassed === false) return 'warning';
  return 'info';
}

function examTitle(item) {
  if (item.examError) return `Lỗi đánh giá: ${item.examError}`;
  if (item.examPassed) return `Xem trước đạt ${(Number(item.examScore) * 100).toFixed(0)}% — Teacher đã thấy câu SV đủ ý; bạn chỉ duyệt nạp`;
  if (item.examPassed === false) return `Xem trước chưa đủ (${item.examScore == null ? '—' : `${(Number(item.examScore) * 100).toFixed(0)}%`}) — nên trả Teacher đánh giá lại`;
  return 'Chưa có bài xem trước. Teacher phải Lưu/đánh giá lại trước khi gửi duyệt nạp.';
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
  const panelRef = useRef(null);

  useEffect(() => {
    panelRef.current?.closest('.master-detail-layout__detail')?.scrollTo({ top: 0 });
  }, [entry.id]);

  return (
    <div ref={panelRef} className="expert-training__review-detail-panel">
      <div className="expert-training__review-detail-head">
        <div>
          <span className="expert-training__eyebrow">CÂU HỎI CẦN QUYẾT ĐỊNH</span>
          <Title level={4}>{isGold ? item.question : item.name}</Title>
        </div>
        <StatusLabel status={item.status} />
      </div>

      <div className="expert-training__review-meta-grid">
        <div>
          <BookOpenCheck size={17} />
          <span><small>Chương giáo trình</small><strong>{item.chapter || 'Chưa xác định'}</strong></span>
        </div>
        {isGold && (
          <div>
            <Gauge size={17} />
            <span><small>Độ khó</small><strong>{item.difficulty || 'Chưa phân loại'}</strong></span>
          </div>
        )}
        <div>
          <GraduationCap size={17} />
          <span><small>Người soạn</small><strong>{item.authorId || 'Teacher'}</strong></span>
        </div>
      </div>

      {isGold ? (
        <>
          <section className="expert-training__review-block">
            <header>
              <div>
                <span className="expert-training__review-block-icon"><MessageSquareText size={17} /></span>
                <div><h3>Bản xem trước câu SV</h3><p>Teacher đã chấm bằng sách + tóm tắt (chưa index). Bạn chỉ đối chiếu rồi duyệt nạp RAG.</p></div>
              </div>
            </header>
            <GoldQaExamCompare contribution={item} />
          </section>
          <Alert
            className="expert-training__review-verdict"
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
        <div className="expert-training__review-form-heading">
          <div><h3>Quyết định của Senior</h3><p>Ghi rõ lý do nếu trả lại để Teacher biết chính xác phần cần sửa.</p></div>
        </div>
        <Form.Item label="Nhận xét kiểm duyệt" name="reviewNote">
          <Input.TextArea rows={4} maxLength={5000} placeholder="Ghi chú khi nạp ghi chú theo giáo trình, hoặc lý do trả lại để chỉnh cho khớp sách..." />
        </Form.Item>
      </Form>

      <div className="expert-training__review-actions">
        <Text type="secondary">Senior chỉ duyệt nạp. Chất lượng câu trả lời đã được Teacher kiểm bằng đánh giá lại (xem trước).</Text>
        <Space wrap>
          <ActionButton intent="danger" icon={<X size={15} />} onClick={onReject} disabled={pending}>
            Trả lại Teacher
          </ActionButton>
          <ActionButton
            intent="primary"
            icon={<Check size={15} />}
            onClick={onApprove}
            loading={pendingAction === `${isGold ? 'review-gold' : 'review-rubric'}:${item.id}`}
            disabled={pending}
          >
            {isGold && String(item.usage || '').toUpperCase() === 'EVALUATION'
              ? 'Duyệt holdout'
              : isGold
                ? 'Nạp ghi chú theo sách'
                : 'Phê duyệt'}
          </ActionButton>
        </Space>
      </div>
    </div>
  );
}
