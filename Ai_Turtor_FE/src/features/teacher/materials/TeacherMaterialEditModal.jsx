import { useEffect } from 'react';
import { Form, Input, Modal } from 'antd';

export default function TeacherMaterialEditModal({ material, open, saving = false, onCancel, onSave }) {
  const [form] = Form.useForm();

  useEffect(() => {
    if (!material || !open) return;
    form.setFieldsValue({
      title: material.title || '',
      category: material.category || '',
    });
  }, [form, material, open]);

  const submit = async () => {
    const values = await form.validateFields();
    await onSave?.({
      title: values.title.trim(),
      category: values.category?.trim() || '',
    });
  };

  return (
    <Modal
      title="Chỉnh sửa tài liệu của bạn"
      open={open}
      okText="Lưu thay đổi"
      cancelText="Hủy"
      confirmLoading={saving}
      onCancel={onCancel}
      onOk={submit}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="title"
          label="Tên tài liệu"
          rules={[{ required: true, whitespace: true, message: 'Nhập tên tài liệu.' }]}
        >
          <Input maxLength={200} showCount />
        </Form.Item>
        <Form.Item name="category" label="Danh mục">
          <Input maxLength={200} showCount placeholder="Ví dụ: Giáo trình bổ sung" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
