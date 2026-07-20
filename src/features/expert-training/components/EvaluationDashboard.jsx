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
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { Play, RefreshCw } from 'lucide-react';
import AsyncState from '../../../components/common/AsyncState';
import { normalizeEvalRun } from '../../../services/expertTrainingNormalizers';
import { asArray } from '../../../services/normalizers';
import { formatPercent, getEntityStatusColor } from '../expertTrainingUtils';

const { Paragraph, Text } = Typography;

const formatDate = (value) => {
  if (!value) return 'Not completed';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not completed' : date.toLocaleString();
};

export default function EvaluationDashboard({
  runs,
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

  const submitStart = async (values) => {
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

  const columns = [
    {
      title: 'Evaluation scope',
      key: 'scope',
      render: (_, run) => (
        <div className="expert-training__primary-cell">
          <strong>{run.chapter}</strong>
          <span>{run.harnessVersion || 'Default harness'} · KB {run.kbVersion || 'current'}</span>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (value) => <Tag color={getEntityStatusColor(value)}>{value}</Tag>,
    },
    {
      title: 'Cases',
      key: 'cases',
      width: 100,
      align: 'center',
      render: (_, run) => `${run.passedCases}/${run.totalCases}`,
    },
    {
      title: 'Average score',
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
      width: 105,
      render: (value) => value ? <Tag color="red">Detected</Tag> : <Tag color="green">No</Tag>,
    },
    {
      title: 'Completed',
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
      render: (_, run) => <Button size="small" onClick={() => onOpenDetail(run.id)}>Details</Button>,
    },
  ];

  const detailRun = detail?.run ? normalizeEvalRun(detail.run) : null;
  const detailResults = asArray(detail, 'results', 'content');
  const resultColumns = [
    {
      title: 'Question and answer comparison',
      key: 'content',
      width: 520,
      render: (_, result) => (
        <div className="expert-training__eval-answer">
          <strong>{result.question}</strong>
          <span><b>Gold:</b> {result.goldAnswer}</span>
          <span><b>AI:</b> {result.aiAnswer}</span>
        </div>
      ),
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: 100,
      render: formatPercent,
    },
    {
      title: 'RAG confidence',
      dataIndex: 'ragConfidence',
      key: 'confidence',
      width: 130,
      render: formatPercent,
    },
    {
      title: 'Result',
      key: 'result',
      width: 120,
      render: (_, result) => (
        <div className="expert-training__result-tags">
          <Tag color={result.passed ? 'green' : 'red'}>{result.passed ? 'PASSED' : 'FAILED'}</Tag>
          {result.hallucinated && <Tag color="red">HALLUCINATION</Tag>}
        </div>
      ),
    },
  ];

  return (
    <section className="expert-training__section" aria-labelledby="evaluation-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="evaluation-heading">Evaluation Dashboard</h2>
          <p>Measure the current Tutor against approved private holdout cases without adding those answers to RAG.</p>
        </div>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading}>Refresh</Button>
          {canReview && (
            <Button type="primary" icon={<Play size={16} />} onClick={() => setStartOpen(true)}>
              Run evaluation
            </Button>
          )}
        </Space>
      </div>

      <Row gutter={[12, 12]} className="expert-training__stats">
        <Col xs={12} lg={6}><div className="expert-training__metric"><Statistic title="Evaluation runs" value={runs.length} /></div></Col>
        <Col xs={12} lg={6}><div className="expert-training__metric"><Statistic title="Passed runs" value={passedRuns} /></div></Col>
        <Col xs={12} lg={6}><div className="expert-training__metric"><Statistic title="Regressions" value={regressionRuns} /></div></Col>
        <Col xs={12} lg={6}>
          <div className="expert-training__metric">
            <Statistic title="Latest score" value={latestRun?.averageScore == null ? '—' : Math.round(latestRun.averageScore * 100)} suffix={latestRun?.averageScore == null ? '' : '%'} />
          </div>
        </Col>
      </Row>

      {!canReview && (
        <Alert
          type="info"
          showIcon
          title="Evaluation execution is restricted"
          description="Teachers can inspect completed runs. Only Senior Mentor or Admin can start a new offline evaluation."
        />
      )}

      <AsyncState
        loading={loading && !runs.length}
        error={error}
        empty={!loading && !error && !runs.length}
        emptyTitle="No evaluation runs for this course"
        emptyDescription="Approve at least one EVALUATION Gold Q&A before starting a run."
        onRetry={onRefresh}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={runs}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          scroll={{ x: 1050 }}
          size="middle"
        />
      </AsyncState>

      <Modal
        title="Run offline Tutor evaluation"
        open={startOpen}
        onCancel={() => setStartOpen(false)}
        onOk={() => form.submit()}
        okText="Run evaluation"
        confirmLoading={pendingAction === 'start-evaluation'}
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          title="This evaluates only approved holdout cases"
          description="The backend calls the current course RAG Tutor, stores each result, and detects score regression against the latest passed run."
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
          <Form.Item label="Chapter filter" name="chapter" extra="Leave blank to evaluate every approved holdout case in the course.">
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item label="Pass threshold" name="passThreshold" rules={[{ required: true }]}>
            <InputNumber min={0} max={1} step={0.05} precision={2} className="expert-training__full-width" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Harness version" name="harnessVersion">
                <Input maxLength={120} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Knowledge version" name="kbVersion">
                <Input maxLength={120} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Prompt version" name="promptVersion">
            <Input maxLength={120} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Evaluation run details"
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
                <Descriptions.Item label="Status"><Tag color={getEntityStatusColor(detailRun.status)}>{detailRun.status}</Tag></Descriptions.Item>
                <Descriptions.Item label="Chapter">{detailRun.chapter}</Descriptions.Item>
                <Descriptions.Item label="Cases">{detailRun.passedCases}/{detailRun.totalCases}</Descriptions.Item>
                <Descriptions.Item label="Completed">{formatDate(detailRun.completedAt)}</Descriptions.Item>
                <Descriptions.Item label="Regression">{detailRun.regressionDetected ? 'Detected' : 'Not detected'}</Descriptions.Item>
                <Descriptions.Item label="Threshold">{formatPercent(detailRun.passThreshold)}</Descriptions.Item>
              </Descriptions>
              <Row gutter={[16, 12]} className="expert-training__detail-progress">
                <Col xs={24} sm={12}>
                  <Text strong>Average score</Text>
                  <Progress percent={Math.round((detailRun.averageScore || 0) * 100)} status={detailRun.status === 'PASSED' ? 'success' : 'exception'} />
                </Col>
                <Col xs={24} sm={12}>
                  <Text strong>Hallucination rate</Text>
                  <Progress percent={Math.round((detailRun.hallucinationRate || 0) * 100)} status={detailRun.hallucinationRate > 0 ? 'exception' : 'success'} />
                </Col>
              </Row>
              {detailRun.error && <Alert type="error" showIcon title="Evaluation error" description={detailRun.error} />}
              <Paragraph type="secondary">Results are canonical backend records and are not reconstructed from WebSocket events.</Paragraph>
              <Table
                rowKey={(item) => item.id || item.goldQaId}
                columns={resultColumns}
                dataSource={detailResults}
                pagination={{ pageSize: 6, hideOnSinglePage: true }}
                scroll={{ x: 870 }}
                size="small"
              />
            </div>
          )}
        </AsyncState>
      </Modal>
    </section>
  );
}
