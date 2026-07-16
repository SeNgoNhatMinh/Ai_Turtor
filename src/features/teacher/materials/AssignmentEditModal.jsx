import { useEffect } from 'react';
import { Form, Input, Modal } from 'antd';

export default function AssignmentEditModal({ assignment, open, saving = false, onCancel, onSave }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!assignment || !open) return;
    form.setFieldsValue({
      title: assignment.title || '',
      description: assignment.description || '',
      dueAt: assignment.dueAt ? String(assignment.dueAt).slice(0, 16) : '',
    });
  }, [assignment, form, open]);

  const submit = async () => {
    const values = await form.validateFields();
    await onSave?.({
      title: values.title.trim(),
      description: values.description?.trim() || '',
      ...(values.dueAt ? { dueAt: new Date(values.dueAt).toISOString() } : {}),
    });
  };

  return (
    <Modal
      title="Edit assignment"
      open={open}
      okText="Save changes"
      confirmLoading={saving}
      onCancel={onCancel}
      onOk={submit}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item name="title" label="Assignment title" rules={[{ required: true, whitespace: true, message: 'Title is required.' }]}>
          <Input maxLength={200} />
        </Form.Item>
        <Form.Item name="description" label="Requirements">
          <Input.TextArea rows={4} maxLength={5000} showCount />
        </Form.Item>
        <Form.Item name="dueAt" label="Deadline">
          <Input type="datetime-local" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
