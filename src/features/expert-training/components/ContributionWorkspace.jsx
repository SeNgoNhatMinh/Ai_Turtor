import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  InputNumber,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import { Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import AsyncState from '../../../components/common/AsyncState';
import {
  criteriaRowsToWeights,
  getEntityStatusColor,
  getTaskGoldUsage,
  validateCriteriaWeights,
} from '../expertTrainingUtils';

const { Paragraph, Text } = Typography;

const defaultCriteria = [
  { name: 'accuracy', weight: 0.6 },
  { name: 'groundedness', weight: 0.3 },
  { name: 'guidance', weight: 0.1 },
];

export default function ContributionWorkspace({
  selectedTask,
  userId,
  goldQa,
  rubrics,
  loading,
  error,
  pendingAction,
  onRefresh,
  onSubmitGoldQa,
  onSubmitRubric,
}) {
  const [editorType, setEditorType] = useState(selectedTask?.type === 'RUBRIC' ? 'RUBRIC' : 'GOLD_QA');
  const [goldForm] = Form.useForm();
  const [rubricForm] = Form.useForm();
  const taskGoldUsage = getTaskGoldUsage(selectedTask);

  useEffect(() => {
    if (!selectedTask) return;
    const nextType = selectedTask.type === 'RUBRIC' ? 'RUBRIC' : 'GOLD_QA';
    if (nextType === 'GOLD_QA') {
      goldForm.setFieldsValue({
        chapter: selectedTask.chapter,
        usage: taskGoldUsage || 'TRAINING',
        difficulty: 'MEDIUM',
      });
    } else {
      rubricForm.setFieldsValue({
        chapter: selectedTask.chapter,
        name: selectedTask.title,
        description: selectedTask.instructions,
        criteria: defaultCriteria,
      });
    }
  }, [goldForm, rubricForm, selectedTask, taskGoldUsage]);

  const myGoldQa = useMemo(
    () => goldQa.filter((item) => item.authorId === userId),
    [goldQa, userId],
  );
  const myRubrics = useMemo(
    () => rubrics.filter((item) => item.authorId === userId),
    [rubrics, userId],
  );
  const canSubmitSelectedTask = !selectedTask || ['ASSIGNED', 'IN_PROGRESS'].includes(selectedTask.status);

  const submitGold = async (values) => {
    if (taskGoldUsage && values.usage !== taskGoldUsage) {
      goldForm.setFields([{ name: 'usage', errors: [`This task requires ${taskGoldUsage} usage.`] }]);
      return;
    }
    const result = await onSubmitGoldQa({
      ...values,
      sourceTaskId: selectedTask?.type === 'GOLD_QA' ? selectedTask.id : undefined,
    });
    if (result) {
      goldForm.resetFields();
      goldForm.setFieldsValue({ difficulty: 'MEDIUM', usage: 'TRAINING' });
    }
  };

  const submitRubric = async (values) => {
    const weightError = validateCriteriaWeights(values.criteria);
    if (weightError) {
      rubricForm.setFields([{ name: 'criteria', errors: [weightError] }]);
      return;
    }
    const result = await onSubmitRubric({
      chapter: values.chapter,
      name: values.name,
      description: values.description,
      criteriaWeights: criteriaRowsToWeights(values.criteria),
      sourceTaskId: selectedTask?.type === 'RUBRIC' ? selectedTask.id : undefined,
    });
    if (result) {
      rubricForm.resetFields();
      rubricForm.setFieldsValue({ criteria: defaultCriteria });
    }
  };

  const historyColumns = [
    {
      title: 'Contribution',
      key: 'contribution',
      render: (_, item) => (
        <div className="expert-training__primary-cell">
          <strong>{item.question || item.name}</strong>
          <span>{item.chapter}</span>
        </div>
      ),
    },
    {
      title: 'Purpose',
      key: 'purpose',
      width: 130,
      render: (_, item) => item.usage ? <Tag>{item.usage}</Tag> : <Tag>RUBRIC</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (value) => <Tag color={getEntityStatusColor(value)}>{value.replaceAll('_', ' ')}</Tag>,
    },
    {
      title: 'Reviewed',
      key: 'reviewed',
      width: 140,
      render: (_, item) => item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString() : 'Not yet',
    },
  ];

  const editorItems = [
    {
      key: 'GOLD_QA',
      label: 'Gold Q&A',
      children: (
        <Form
          form={goldForm}
          layout="vertical"
          disabled={!canSubmitSelectedTask}
          initialValues={{ difficulty: 'MEDIUM', usage: 'TRAINING' }}
          onFinish={submitGold}
        >
          <Row gutter={12}>
            <Col xs={24} md={14}>
              <Form.Item label="Chapter" name="chapter" rules={[{ required: true, whitespace: true }]}>
                <Input maxLength={255} />
              </Form.Item>
            </Col>
            <Col xs={12} md={5}>
              <Form.Item label="Difficulty" name="difficulty" rules={[{ required: true }]}>
                <Select options={['EASY', 'MEDIUM', 'HARD'].map((value) => ({ value, label: value }))} />
              </Form.Item>
            </Col>
            <Col xs={12} md={5}>
              <Form.Item label="Purpose" name="usage" rules={[{ required: true }]}>
                <Select disabled={Boolean(taskGoldUsage)} options={[
                  { value: 'TRAINING', label: 'Training' },
                  { value: 'EVALUATION', label: 'Evaluation holdout' },
                ]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Canonical question" name="question" rules={[{ required: true, whitespace: true }]}>
            <Input.TextArea rows={3} maxLength={5000} />
          </Form.Item>
          <Form.Item label="Gold answer" name="goldAnswer" rules={[{ required: true, whitespace: true }]}>
            <Input.TextArea rows={7} maxLength={5000} />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            title="Training and evaluation data are intentionally separated"
            description={taskGoldUsage
              ? `This coverage task requires ${taskGoldUsage}. Approved TRAINING content is indexed into course RAG; approved EVALUATION content remains a private holdout.`
              : 'Approved TRAINING content is indexed into course RAG. Approved EVALUATION content remains a private holdout and is never indexed.'}
          />
          <div className="expert-training__form-actions">
            <Button
              type="primary"
              htmlType="submit"
              icon={<Send size={16} />}
              loading={pendingAction === 'submit-gold-qa'}
              disabled={Boolean(pendingAction) || !userId}
            >
              Submit for review
            </Button>
          </div>
        </Form>
      ),
    },
    {
      key: 'RUBRIC',
      label: 'Rubric',
      children: (
        <Form
          form={rubricForm}
          layout="vertical"
          disabled={!canSubmitSelectedTask}
          initialValues={{ criteria: defaultCriteria }}
          onFinish={submitRubric}
        >
          <Row gutter={12}>
            <Col xs={24} md={10}>
              <Form.Item label="Chapter" name="chapter" rules={[{ required: true, whitespace: true }]}>
                <Input maxLength={255} />
              </Form.Item>
            </Col>
            <Col xs={24} md={14}>
              <Form.Item label="Rubric name" name="name" rules={[{ required: true, whitespace: true }]}>
                <Input maxLength={255} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} maxLength={5000} />
          </Form.Item>
          <Form.List name="criteria">
            {(fields, { add, remove }) => (
              <Form.Item label="Criteria weights" required>
                <div className="expert-training__criteria-list">
                  {fields.map((field) => (
                    <Space key={field.key} align="start" className="expert-training__criteria-row">
                      <Form.Item
                        {...field}
                        name={[field.name, 'name']}
                        rules={[{ required: true, whitespace: true, message: 'Criterion name is required.' }]}
                      >
                        <Input placeholder="accuracy" maxLength={80} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'weight']}
                        rules={[{ required: true, message: 'Weight is required.' }]}
                      >
                        <InputNumber min={0.001} max={1} step={0.05} precision={3} placeholder="0.6" />
                      </Form.Item>
                      <Button
                        type="text"
                        danger
                        icon={<Trash2 size={16} />}
                        aria-label="Remove criterion"
                        onClick={() => remove(field.name)}
                        disabled={fields.length <= 1}
                      />
                    </Space>
                  ))}
                  <Button icon={<Plus size={16} />} onClick={() => add({ name: '', weight: 0.1 })}>
                    Add criterion
                  </Button>
                </div>
              </Form.Item>
            )}
          </Form.List>
          <Text type="secondary">Backend accepts the rubric only when all weights total exactly 1.0.</Text>
          <div className="expert-training__form-actions">
            <Button
              type="primary"
              htmlType="submit"
              icon={<Send size={16} />}
              loading={pendingAction === 'submit-rubric'}
              disabled={Boolean(pendingAction) || !userId}
            >
              Submit for review
            </Button>
          </div>
        </Form>
      ),
    },
  ];

  return (
    <section className="expert-training__section" aria-labelledby="contributions-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="contributions-heading">Contribution Editor</h2>
          <p>Teacher contributions stay pending until a Senior Mentor or Admin reviews them.</p>
        </div>
        <Button icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading}>Refresh</Button>
      </div>

      {selectedTask && (
        <Alert
          type={selectedTask.status === 'SUBMITTED' ? 'success' : 'info'}
          showIcon
          title={`Working from task: ${selectedTask.title}`}
          description={`${selectedTask.chapter} · ${selectedTask.status.replaceAll('_', ' ')}${selectedTask.instructions ? ` · ${selectedTask.instructions}` : ''}`}
        />
      )}

      <Card className="expert-training__editor-card" title="Prepare contribution">
        <Tabs
          activeKey={selectedTask ? (selectedTask.type === 'RUBRIC' ? 'RUBRIC' : 'GOLD_QA') : editorType}
          onChange={setEditorType}
          items={editorItems}
        />
      </Card>

      <Card
        className="expert-training__history-card"
        title="My contribution history"
        extra={<Text type="secondary">{myGoldQa.length + myRubrics.length} items</Text>}
      >
        <AsyncState
          loading={loading && !myGoldQa.length && !myRubrics.length}
          error={error}
          empty={!loading && !error && !myGoldQa.length && !myRubrics.length}
          emptyTitle="No contributions yet"
          emptyDescription="Claim a task or create a standalone Gold Q&A or rubric."
          onRetry={onRefresh}
        >
          <Table
            rowKey={(item) => `${item.usage ? 'gold' : 'rubric'}:${item.id}`}
            columns={historyColumns}
            dataSource={[...myGoldQa, ...myRubrics].sort((a, b) => (
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
            ))}
            pagination={{ pageSize: 6, hideOnSinglePage: true }}
            scroll={{ x: 720 }}
            size="middle"
          />
        </AsyncState>
      </Card>

      <Paragraph type="secondary" className="expert-training__policy-note">
        A submitted answer is not AI knowledge yet. Only approved TRAINING Gold Q&A becomes indexed course knowledge.
      </Paragraph>
    </section>
  );
}
