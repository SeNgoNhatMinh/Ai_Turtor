import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  InputNumber,
  Modal,
  Row,
  Space,
  Statistic,
  Table,
  Typography,
} from 'antd';
import { Radar, RefreshCw } from 'lucide-react';
import AsyncState from '../../../components/common/AsyncState';
import StatusLabel from '../../../components/common/StatusLabel';

const { Paragraph, Text } = Typography;

export default function CoverageDashboard({
  gaps,
  chapters = [],
  compact = false,
  loading,
  error,
  canReview,
  pendingAction,
  onAnalyze,
  onRefresh,
  onCreateTaskFromGap,
}) {
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  const openGaps = gaps.filter((item) => ['OPEN', 'TASK_CREATED'].includes(item.status)).length;
  const criticalGaps = gaps.filter((item) => item.severity === 'CRITICAL').length;
  const resolvedGaps = gaps.filter((item) => item.status === 'RESOLVED').length;

  const submit = async (values) => {
    const result = await onAnalyze({
      chapters: chapters
        .filter((chapter) => chapter.status === 'CONFIRMED')
        .map((chapter) => chapter.title),
      minimumTrainingGoldPerChapter: values.minimumTrainingGoldPerChapter,
      minimumEvaluationGoldPerChapter: values.minimumEvaluationGoldPerChapter,
      createTasks: values.createTasks,
      useSuggestedOrConfirmedChapters: true,
      smartTaskPolicy: true,
      includeTrainingGoldTasks: true,
      includeBenchmarkTasks: true,
    });
    if (result) {
      setOpen(false);
      form.resetFields();
    }
  };

  const columns = [
    {
      title: 'Chương',
      dataIndex: 'chapter',
      key: 'chapter',
      width: 220,
      render: (value, item) => (
        <div className="expert-training__primary-cell">
          <strong>{value}</strong>
          <span>{item.reasons.join(' · ') || 'Đã đạt mục tiêu độ phủ'}</span>
        </div>
      ),
    },
    {
      title: 'Mức độ',
      dataIndex: 'severity',
      key: 'severity',
      width: 110,
      render: (value) => <StatusLabel status={value} />,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (value) => <StatusLabel status={value} />,
    },
    {
      title: 'Tài liệu đã index',
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
    ...(canReview && onCreateTaskFromGap ? [{
      title: '',
      key: 'action',
      fixed: 'right',
      width: 110,
      render: (_, gap) => (
        <Button size="small" onClick={() => onCreateTaskFromGap(gap)} disabled={Boolean(pendingAction)}>
          Tạo task
        </Button>
      ),
    }] : []),
  ];

  return (
    <section className="expert-training__section" aria-labelledby="coverage-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="coverage-heading">Độ phủ tri thức theo chương</h2>
          <p>Phát hiện chương đang thiếu Training Gold Q&A hoặc Evaluation holdout đáng tin cậy.</p>
        </div>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading}>Làm mới</Button>
          {canReview && (
            <Button
              type="primary"
              icon={<Radar size={16} />}
              onClick={() => setOpen(true)}
              disabled={!chapters.some((chapter) => chapter.status === 'CONFIRMED')}
              title={chapters.some((chapter) => chapter.status === 'CONFIRMED')
                ? 'Phân tích chapter đã xác nhận'
                : 'Xác nhận ít nhất một chapter trước'}
            >
              Phân tích độ phủ
            </Button>
          )}
        </Space>
      </div>

      {!compact && (
        <Row gutter={[12, 12]} className="expert-training__stats">
          <Col xs={12} lg={6}><Card size="small"><Statistic title="Thiếu hụt phát hiện" value={gaps.length} /></Card></Col>
          <Col xs={12} lg={6}><Card size="small"><Statistic title="Đang mở hoặc đã tạo task" value={openGaps} /></Card></Col>
          <Col xs={12} lg={6}><Card size="small"><Statistic title="Nghiêm trọng" value={criticalGaps} /></Card></Col>
          <Col xs={12} lg={6}><Card size="small"><Statistic title="Đã xử lý" value={resolvedGaps} /></Card></Col>
        </Row>
      )}

      {!canReview && (
        <Alert
          type="info"
          showIcon
          title="Senior Mentor hoặc Admin quản lý phân tích độ phủ"
          description="Giảng viên có thể xem thiếu hụt, nhận task và gửi nội dung đóng góp."
        />
      )}

      <AsyncState
        loading={loading && !gaps.length}
        error={error}
        empty={!loading && !error && !gaps.length}
        emptyTitle="Môn học chưa có thiếu hụt độ phủ"
        emptyDescription="Senior Mentor hoặc Admin có thể phân tích các chương cần kiểm tra."
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
        title="Phân tích độ phủ môn học"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="Phân tích"
        confirmLoading={pendingAction === 'analyze-coverage'}
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          title="Backend là nguồn dữ liệu chuẩn"
          description="Khi bật tạo task, backend chỉ tạo phần Training/Evaluation còn thiếu và ngăn task trùng cho thiếu hụt đang hoạt động."
        />
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            minimumTrainingGoldPerChapter: 3,
            minimumEvaluationGoldPerChapter: 2,
            createTasks: false,
          }}
          onFinish={submit}
          className="expert-training__modal-form"
        >
          <Alert
            type="info"
            showIcon
            title={`${chapters.filter((chapter) => chapter.status === 'CONFIRMED').length} chapter đã xác nhận`}
            description="Phân tích sử dụng danh sách chapter canonical từ học liệu, không dùng text nhập tự do."
          />
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Mục tiêu Training Gold Q&A" name="minimumTrainingGoldPerChapter">
                <InputNumber min={1} max={20} precision={0} className="expert-training__full-width" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Mục tiêu Evaluation holdout" name="minimumEvaluationGoldPerChapter">
                <InputNumber min={1} max={20} precision={0} className="expert-training__full-width" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="createTasks" valuePropName="checked">
            <Checkbox>Tự tạo task cho thiếu hụt được phát hiện</Checkbox>
          </Form.Item>
          <Paragraph type="secondary">
            TRAINING chỉ vào RAG sau khi được duyệt. EVALUATION luôn là dữ liệu holdout riêng tư.
          </Paragraph>
          <Text type="secondary">Thao tác có thể lâu hơn khi môn học có nhiều tài liệu đã index.</Text>
        </Form>
      </Modal>
    </section>
  );
}
