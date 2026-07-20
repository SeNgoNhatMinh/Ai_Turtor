import { useState } from 'react';
import {
  Alert,
  Button,
  Col,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Row,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { FlaskConical, Gauge, History, Play, RefreshCw, ShieldAlert } from 'lucide-react';
import AsyncState from '../../../components/common/AsyncState';
import MetricStrip from '../../../components/common/MetricStrip';
import StatusLabel from '../../../components/common/StatusLabel';
import { normalizeEvalRun } from '../../../services/expertTrainingNormalizers';
import { asArray } from '../../../services/normalizers';
import { formatPercent } from '../expertTrainingUtils';

const { Paragraph, Text } = Typography;

const formatDate = (value) => {
  if (!value) return 'Chưa hoàn tất';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa hoàn tất' : date.toLocaleString('vi-VN');
};

export default function EvaluationDashboard({
  runs = [],
  readiness = {},
  canReview,
  loading,
  error,
  pendingAction,
  detail,
  detailLoading,
  onRefresh,
  onStart,
  onOpenDetail,
  onCloseDetail,
}) {
  const [startOpen, setStartOpen] = useState(false);
  const [form] = Form.useForm();
  const passedRuns = runs.filter((run) => run.status === 'PASSED').length;
  const regressionRuns = runs.filter((run) => run.regressionDetected).length;
  const latestRun = runs[0];
  const canStart = canReview && readiness.ready && !pendingAction;

  const submitStart = async (values) => {
    if (!readiness.ready) return;
    const result = await onStart({
      chapter: values.chapter?.trim() || null,
      harnessVersion: values.harnessVersion?.trim() || 'v2-mvp-deterministic',
      kbVersion: values.kbVersion?.trim() || 'current',
      promptVersion: values.promptVersion?.trim() || 'current',
      passThreshold: values.passThreshold,
    });
    if (result) {
      setStartOpen(false);
      form.resetFields();
    }
  };

  const metrics = [
    { key: 'runs', label: 'Số lần Evaluation', value: runs.length, description: 'Dữ liệu canonical từ backend', icon: History },
    { key: 'passed', label: 'Phiên đạt', value: passedRuns, description: `${runs.length - passedRuns} phiên chưa đạt hoặc đang xử lý`, icon: FlaskConical },
    { key: 'regressions', label: 'Regression phát hiện', value: regressionRuns, description: 'So với phiên đạt gần nhất', icon: ShieldAlert },
    { key: 'latest', label: 'Điểm gần nhất', value: latestRun ? formatPercent(latestRun.averageScore) : '—', description: latestRun?.chapter || 'Chưa có kết quả', icon: Gauge },
  ];

  const columns = [
    {
      title: 'Phạm vi Evaluation',
      key: 'scope',
      render: (_, run) => (
        <div className="expert-training__primary-cell">
          <strong>{run.chapter}</strong>
          <span>{run.harnessVersion || 'Harness mặc định'} · KB {run.kbVersion || 'hiện tại'}</span>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (value) => <StatusLabel status={value} />,
    },
    {
      title: 'Test case',
      key: 'cases',
      width: 100,
      align: 'center',
      render: (_, run) => `${run.passedCases}/${run.totalCases}`,
    },
    {
      title: 'Điểm trung bình',
      dataIndex: 'averageScore',
      key: 'score',
      width: 130,
      render: formatPercent,
    },
    {
      title: 'Hallucination',
      dataIndex: 'hallucinationRate',
      key: 'hallucination',
      width: 130,
      render: formatPercent,
    },
    {
      title: 'Regression',
      dataIndex: 'regressionDetected',
      key: 'regression',
      width: 110,
      render: (value) => value ? <Tag color="red">Có</Tag> : <Tag color="green">Không</Tag>,
    },
    {
      title: 'Hoàn tất lúc',
      dataIndex: 'completedAt',
      key: 'completedAt',
      width: 180,
      render: formatDate,
    },
    {
      title: '',
      key: 'action',
      fixed: 'right',
      width: 90,
      render: (_, run) => <Button size="small" onClick={() => onOpenDetail(run.id)}>Chi tiết</Button>,
    },
  ];

  const detailRun = detail?.run ? normalizeEvalRun(detail.run) : null;
  const detailResults = asArray(detail, 'results', 'content');
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

  return (
    <section className="expert-training__section" aria-labelledby="evaluation-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="evaluation-heading">Evaluation độc lập</h2>
          <p>Đánh giá AI Tutor bằng bộ holdout đã duyệt; câu trả lời Evaluation không được index vào RAG.</p>
        </div>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading}>Làm mới</Button>
          {canReview && (
            <Tooltip title={readiness.ready ? '' : readiness.reason}>
              <span>
                <Button
                  type="primary"
                  icon={<Play size={16} />}
                  onClick={() => setStartOpen(true)}
                  disabled={!canStart}
                >
                  Chạy Evaluation
                </Button>
              </span>
            </Tooltip>
          )}
        </Space>
      </div>

      <MetricStrip items={metrics} ariaLabel="Chỉ số Evaluation" />

      {!canReview && (
        <Alert
          type="info"
          showIcon
          title="Bạn đang ở chế độ chỉ xem"
          description="Giảng viên có thể xem kết quả. Chỉ Senior Mentor hoặc Admin được chạy Evaluation mới."
        />
      )}
      {canReview && !readiness.ready && (
        <Alert type="warning" showIcon title="Chưa thể chạy Evaluation" description={readiness.reason} />
      )}
      {canReview && readiness.warning && (
        <Alert type="info" showIcon title="Lưu ý về Rubric" description={readiness.warning} />
      )}

      <AsyncState
        loading={loading && !runs.length}
        error={error}
        empty={!loading && !error && !runs.length}
        emptyTitle="Môn học chưa có phiên Evaluation"
        emptyDescription="Phê duyệt ít nhất một Evaluation Gold Q&A trước khi chạy."
        onRetry={onRefresh}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={runs}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          scroll={{ x: 1080 }}
          size="middle"
        />
      </AsyncState>

      <Modal
        title="Chạy Evaluation ngoại tuyến"
        open={startOpen}
        onCancel={() => setStartOpen(false)}
        onOk={() => form.submit()}
        okText="Chạy Evaluation"
        confirmLoading={pendingAction === 'start-evaluation'}
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          title={`${readiness.holdoutCount || 0} holdout đã duyệt sẵn sàng`}
          description="Backend gọi AI Tutor hiện tại, lưu kết quả từng test case và phát hiện regression so với phiên đạt gần nhất."
        />
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            passThreshold: 0.6,
            harnessVersion: 'v2-mvp-deterministic',
            kbVersion: 'current',
            promptVersion: 'current',
          }}
          onFinish={submitStart}
          className="expert-training__modal-form"
        >
          <Form.Item label="Lọc theo chương" name="chapter" extra="Để trống để chạy toàn bộ holdout đã duyệt của môn học.">
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item label="Ngưỡng đạt" name="passThreshold" rules={[{ required: true, message: 'Nhập ngưỡng đạt.' }]}>
            <InputNumber min={0} max={1} step={0.05} precision={2} className="expert-training__full-width" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Phiên bản Harness" name="harnessVersion">
                <Input maxLength={120} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Phiên bản tri thức" name="kbVersion">
                <Input maxLength={120} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Phiên bản prompt" name="promptVersion">
            <Input maxLength={120} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Chi tiết phiên Evaluation"
        open={Boolean(detail) || detailLoading}
        onCancel={onCloseDetail}
        footer={null}
        width={1040}
        destroyOnHidden
      >
        <AsyncState loading={detailLoading} loadingRows={7}>
          {detailRun && (
            <div className="expert-training__evaluation-detail">
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="Trạng thái"><StatusLabel status={detailRun.status} /></Descriptions.Item>
                <Descriptions.Item label="Chương">{detailRun.chapter}</Descriptions.Item>
                <Descriptions.Item label="Test case">{detailRun.passedCases}/{detailRun.totalCases}</Descriptions.Item>
                <Descriptions.Item label="Hoàn tất">{formatDate(detailRun.completedAt)}</Descriptions.Item>
                <Descriptions.Item label="Regression">{detailRun.regressionDetected ? 'Có phát hiện' : 'Không phát hiện'}</Descriptions.Item>
                <Descriptions.Item label="Ngưỡng đạt">{formatPercent(detailRun.passThreshold)}</Descriptions.Item>
              </Descriptions>
              <Row gutter={[16, 12]} className="expert-training__detail-progress">
                <Col xs={24} sm={12}>
                  <Text strong>Điểm trung bình</Text>
                  <Progress percent={Math.round((detailRun.averageScore || 0) * 100)} status={detailRun.status === 'PASSED' ? 'success' : 'exception'} />
                </Col>
                <Col xs={24} sm={12}>
                  <Text strong>Tỷ lệ hallucination</Text>
                  <Progress percent={Math.round((detailRun.hallucinationRate || 0) * 100)} status={detailRun.hallucinationRate > 0 ? 'exception' : 'success'} />
                </Col>
              </Row>
              {detailRun.error && <Alert type="error" showIcon title="Evaluation gặp lỗi" description={detailRun.error} />}
              <Paragraph type="secondary">Kết quả được tải từ backend canonical, không dựng lại từ sự kiện WebSocket.</Paragraph>
              <Table
                rowKey={(item) => item.id || item.goldQaId}
                columns={resultColumns}
                dataSource={detailResults}
                pagination={{ pageSize: 6, hideOnSinglePage: true }}
                scroll={{ x: 900 }}
                size="small"
              />
            </div>
          )}
        </AsyncState>
      </Modal>
    </section>
  );
}
