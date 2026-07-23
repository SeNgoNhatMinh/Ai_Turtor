import {
  Alert,
  Col,
  Descriptions,
  Modal,
  Progress,
  Row,
  Table,
  Tag,
  Typography,
} from 'antd';
import AsyncState from '../../../../components/common/AsyncState';
import StatusLabel from '../../../../components/common/StatusLabel';
import { normalizeEvalRun } from '../../../../services/expertTrainingNormalizers';
import { asArray } from '../../../../services/normalizers';
import { formatPercent } from '../../expertTrainingUtils';
import { formatEvaluationDate } from './evaluationViewUtils';

const { Paragraph, Text } = Typography;

const resultColumns = [
  {
    title: 'So sánh câu trả lời',
    key: 'content',
    width: 520,
    render: (_, result) => (
      <div className="expert-training__eval-answer">
        <strong>{result.question}</strong>
        <span><b>Gold Answer:</b> {result.goldAnswer}</span>
        <span><b>AI trả lời:</b> {result.aiAnswer}</span>
      </div>
    ),
  },
  {
    title: 'Điểm',
    dataIndex: 'score',
    key: 'score',
    width: 100,
    render: formatPercent,
  },
  {
    title: 'Độ tin cậy RAG',
    dataIndex: 'ragConfidence',
    key: 'confidence',
    width: 140,
    render: formatPercent,
  },
  {
    title: 'Kết quả',
    key: 'result',
    width: 145,
    render: (_, result) => (
      <div className="expert-training__result-tags">
        <Tag color={result.passed ? 'green' : 'red'}>{result.passed ? 'Đạt' : 'Chưa đạt'}</Tag>
        {result.hallucinated && <Tag color="red">Hallucination</Tag>}
      </div>
    ),
  },
];

export default function EvaluationDetailModal({
  detail,
  loading,
  onClose,
}) {
  const run = detail?.run ? normalizeEvalRun(detail.run) : null;
  const results = asArray(detail, 'results', 'content');

  return (
    <Modal
      title="Chi tiết phiên Evaluation"
      open={Boolean(detail) || loading}
      onCancel={onClose}
      footer={null}
      width={1040}
      destroyOnHidden
    >
      <AsyncState loading={loading} loadingRows={7}>
        {run && (
          <div className="expert-training__evaluation-detail">
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Trạng thái"><StatusLabel status={run.status} /></Descriptions.Item>
              <Descriptions.Item label="Chương">{run.chapter}</Descriptions.Item>
              <Descriptions.Item label="Test case">{run.passedCases}/{run.totalCases}</Descriptions.Item>
              <Descriptions.Item label="Hoàn tất">{formatEvaluationDate(run.completedAt)}</Descriptions.Item>
              <Descriptions.Item label="Regression">{run.regressionDetected ? 'Có phát hiện' : 'Không phát hiện'}</Descriptions.Item>
              <Descriptions.Item label="Ngưỡng đạt">{formatPercent(run.passThreshold)}</Descriptions.Item>
            </Descriptions>
            <Row gutter={[16, 12]} className="expert-training__detail-progress">
              <Col xs={24} sm={12}>
                <Text strong>Điểm trung bình</Text>
                <Progress percent={Math.round((run.averageScore || 0) * 100)} status={run.status === 'PASSED' ? 'success' : 'exception'} />
              </Col>
              <Col xs={24} sm={12}>
                <Text strong>Tỷ lệ hallucination</Text>
                <Progress percent={Math.round((run.hallucinationRate || 0) * 100)} status={run.hallucinationRate > 0 ? 'exception' : 'success'} />
              </Col>
            </Row>
            {run.error && <Alert type="error" showIcon title="Evaluation gặp lỗi" description={run.error} />}
            <Paragraph type="secondary">Kết quả được tải từ backend canonical, không dựng lại từ sự kiện WebSocket.</Paragraph>
            <Table
              rowKey={(item) => item.id || item.goldQaId}
              columns={resultColumns}
              dataSource={results}
              pagination={{ pageSize: 6, hideOnSinglePage: true }}
              scroll={{ x: 900 }}
              size="small"
            />
          </div>
        )}
      </AsyncState>
    </Modal>
  );
}
