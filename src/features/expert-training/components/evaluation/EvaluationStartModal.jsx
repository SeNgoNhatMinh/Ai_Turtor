import {
  Alert,
  Col,
  Collapse,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
} from 'antd';

export default function EvaluationStartModal({
  open,
  readiness,
  pending,
  onCancel,
  onSubmit,
}) {
  const [form] = Form.useForm();

  const submit = async (values) => {
    const result = await onSubmit(values);
    if (result) form.resetFields();
  };

  return (
    <Modal
      title="Chạy Evaluation ngoại tuyến"
      open={open}
      onCancel={onCancel}
      onOk={() => form.submit()}
      okText="Chạy Evaluation"
      confirmLoading={pending}
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
        onFinish={submit}
        className="expert-training__modal-form"
      >
        <Form.Item label="Lọc theo chapter holdout" name="chapter" extra="Để trống để chạy toàn bộ holdout đã duyệt của môn học.">
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Tất cả chapter đã sẵn sàng"
            options={(readiness.chapters || []).map((chapter) => ({
              value: chapter,
              label: chapter,
            }))}
          />
        </Form.Item>
        <Collapse
          ghost
          items={[{
            key: 'advanced',
            label: 'Cấu hình nâng cao',
            children: (
              <>
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
              </>
            ),
          }]}
        />
      </Form>
    </Modal>
  );
}
