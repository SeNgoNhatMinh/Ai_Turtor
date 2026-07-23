import {
  Alert,
  Checkbox,
  Col,
  Form,
  InputNumber,
  Modal,
  Row,
  Typography,
} from 'antd';

const { Paragraph, Text } = Typography;

export default function CoverageAnalyzeModal({
  open,
  chapters,
  selectedChapters,
  pending,
  onCancel,
  onAnalyze,
}) {
  const [form] = Form.useForm();
  const confirmedChapters = chapters.filter((chapter) => chapter.status === 'CONFIRMED');
  const analyzedCount = selectedChapters.length || confirmedChapters.length;

  const submit = async (values) => {
    const result = await onAnalyze({
      chapters: selectedChapters.length
        ? selectedChapters
        : confirmedChapters.map((chapter) => chapter.title),
      minimumTrainingGoldPerChapter: values.minimumTrainingGoldPerChapter,
      minimumEvaluationGoldPerChapter: values.minimumEvaluationGoldPerChapter,
      createTasks: true,
      useSuggestedOrConfirmedChapters: true,
      smartTaskPolicy: true,
      includeTrainingGoldTasks: false,
      includeBenchmarkTasks: false,
    });
    if (result) {
      form.resetFields();
      onCancel();
    }
  };

  return (
    <Modal
      title="Phân tích độ phủ môn học"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="Phân tích"
      confirmLoading={pending}
      destroyOnHidden
    >
      <Alert
        type="warning"
        showIcon
        title="Backend là nguồn dữ liệu chuẩn"
        description="Backend chỉ tạo phần Training/Evaluation còn thiếu và ngăn task trùng cho thiếu hụt đang hoạt động."
      />
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          minimumTrainingGoldPerChapter: 0,
          minimumEvaluationGoldPerChapter: 0,
        }}
        onFinish={submit}
        className="expert-training__modal-form"
      >
        <Alert
          type="info"
          showIcon
          title={`${analyzedCount} chapter sẽ được phân tích`}
          description={selectedChapters.length
            ? 'Phân tích sử dụng các chapter đang được chọn trong danh sách.'
            : 'Không có lựa chọn riêng; hệ thống dùng toàn bộ chapter đã xác nhận.'}
        />
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Mục tiêu Training Gold Q&A" name="minimumTrainingGoldPerChapter">
              <InputNumber min={0} max={20} precision={0} className="expert-training__full-width" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Mục tiêu Evaluation holdout" name="minimumEvaluationGoldPerChapter">
              <InputNumber min={0} max={20} precision={0} className="expert-training__full-width" />
            </Form.Item>
          </Col>
        </Row>
        <Checkbox checked disabled>Smart policy tự tạo đúng task còn thiếu</Checkbox>
        <Paragraph type="secondary">
          TRAINING chỉ vào RAG sau khi được duyệt. EVALUATION luôn là dữ liệu holdout riêng tư.
        </Paragraph>
        <Text type="secondary">Thao tác có thể lâu hơn khi môn học có nhiều tài liệu đã index.</Text>
      </Form>
    </Modal>
  );
}
