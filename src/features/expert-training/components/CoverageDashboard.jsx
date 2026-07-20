import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd';
import { Radar, RefreshCw } from 'lucide-react';
import AsyncState from '../../../components/common/AsyncState';
import { getEntityStatusColor, parseChapterInput } from '../expertTrainingUtils';

const { Paragraph, Text } = Typography;

export default function CoverageDashboard({
  gaps,
  loading,
  error,
  canReview,
  pendingAction,
  onAnalyze,
  onRefresh,
}) {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const openGaps = gaps.filter((item) => ['OPEN', 'TASK_CREATED'].includes(item.status)).length;
  const criticalGaps = gaps.filter((item) => item.severity === 'CRITICAL').length;
  const resolvedGaps = gaps.filter((item) => item.status === 'RESOLVED').length;

  const submit = async (values) => {
    const result = await onAnalyze({
      chapters: parseChapterInput(values.chapters),
      minimumTrainingGoldPerChapter: values.minimumTrainingGoldPerChapter,
      minimumEvaluationGoldPerChapter: values.minimumEvaluationGoldPerChapter,
      createTasks: values.createTasks,
    });
    if (result) {
      setOpen(false);
      form.resetFields();
    }
  };

  const columns = [
    {
      title: 'Chapter',
      dataIndex: 'chapter',
      key: 'chapter',
      width: 220,
      render: (value, item) => (
        <div className="expert-training__primary-cell">
          <strong>{value}</strong>
          <span>{item.reasons.join(' · ') || 'Coverage target met'}</span>
        </div>
      ),
    },
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 110,
      render: (value) => <Tag color={getEntityStatusColor(value)}>{value}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (value) => <Tag color={getEntityStatusColor(value)}>{value.replaceAll('_', ' ')}</Tag>,
    },
    {
      title: 'Indexed materials',
      dataIndex: 'materialCount',
      key: 'materials',
      align: 'center',
      width: 140,
    },
    {
      title: 'Training Gold Q&A',
      dataIndex: 'trainingGoldCount',
      key: 'training',
      align: 'center',
      width: 150,
    },
    {
      title: 'Evaluation holdout',
      dataIndex: 'evaluationGoldCount',
      key: 'evaluation',
      align: 'center',
      width: 150,
    },
  ];

  return (
    <section className="expert-training__section" aria-labelledby="coverage-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="coverage-heading">Coverage Dashboard</h2>
          <p>Find chapters that need trusted training knowledge or private evaluation cases.</p>
        </div>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading}>Refresh</Button>
          {canReview && (
            <Button type="primary" icon={<Radar size={16} />} onClick={() => setOpen(true)}>
              Analyze coverage
            </Button>
          )}
        </Space>
      </div>

      <Row gutter={[12, 12]} className="expert-training__stats">
        <Col xs={12} lg={6}><Card size="small"><Statistic title="Detected gaps" value={gaps.length} /></Card></Col>
        <Col xs={12} lg={6}><Card size="small"><Statistic title="Open or tasked" value={openGaps} /></Card></Col>
        <Col xs={12} lg={6}><Card size="small"><Statistic title="Critical" value={criticalGaps} /></Card></Col>
        <Col xs={12} lg={6}><Card size="small"><Statistic title="Resolved" value={resolvedGaps} /></Card></Col>
      </Row>

      {!canReview && (
        <Alert
          type="info"
          showIcon
          title="Coverage analysis is controlled by Senior Mentor or Admin"
          description="Teachers can view detected gaps, claim expert tasks, and submit contributions."
        />
      )}

      <AsyncState
        loading={loading && !gaps.length}
        error={error}
        empty={!loading && !error && !gaps.length}
        emptyTitle="No coverage gaps for this course"
        emptyDescription="A Senior Mentor or Admin can run coverage analysis for selected chapters."
        onRetry={onRefresh}
      >
        <Table
          rowKey="id"
          columns={columns}
          dataSource={gaps}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          scroll={{ x: 900 }}
          size="middle"
        />
      </AsyncState>

      <Modal
        title="Analyze course coverage"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="Analyze"
        confirmLoading={pendingAction === 'analyze-coverage'}
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          title="Backend remains the source of truth"
          description="When task creation is enabled, the backend creates only the missing training and evaluation tasks and prevents duplicates for active gaps."
        />
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            minimumTrainingGoldPerChapter: 3,
            minimumEvaluationGoldPerChapter: 2,
            createTasks: true,
          }}
          onFinish={submit}
          className="expert-training__modal-form"
        >
          <Form.Item
            label="Chapters"
            name="chapters"
            rules={[
              { required: true, message: 'Enter at least one chapter.' },
              {
                validator: (_, value) => parseChapterInput(value).length
                  ? Promise.resolve()
                  : Promise.reject(new Error('Enter at least one chapter.')),
              },
            ]}
            extra="Use one chapter per line, or separate chapters with commas."
          >
            <Input.TextArea rows={5} maxLength={2000} placeholder={'Spring Boot Basics\nDependency Injection'} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Training Gold Q&A target" name="minimumTrainingGoldPerChapter">
                <InputNumber min={1} max={20} precision={0} className="expert-training__full-width" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Evaluation holdout target" name="minimumEvaluationGoldPerChapter">
                <InputNumber min={1} max={20} precision={0} className="expert-training__full-width" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="createTasks" valuePropName="checked">
            <Checkbox>Create expert tasks for detected gaps</Checkbox>
          </Form.Item>
          <Paragraph type="secondary">
            Training items may enter RAG only after approval. Evaluation items remain private holdout data.
          </Paragraph>
          <Text type="secondary">This operation can take longer when the course has many indexed materials.</Text>
        </Form>
      </Modal>
    </section>
  );
}
