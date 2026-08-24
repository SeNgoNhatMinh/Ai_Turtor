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
                <div><h3>Đối chiếu đáp án</h3><p>Teacher soạn đáp án chuẩn; AI chỉ được trả lời bằng giáo trình đã index.</p></div>
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
          <Input.TextArea rows={4} maxLength={5000} placeholder="Ghi chú khi nạp RAG hoặc lý do trả lại Teacher..." />
        </Form.Item>
      </Form>

      <div className="expert-training__review-actions">
        <Text type="secondary">Nạp RAG chỉ khi Senior thấy bài thi hợp giáo trình.</Text>
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
            Nạp vào RAG
          </ActionButton>
        </Space>
      </div>
    </div>
  );
}
