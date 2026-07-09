import React from 'react';
import { Form, Input, InputNumber, Modal, Select } from 'antd';
import { getRecordId } from './adminAcademicUtils';

const { Option } = Select;

const ENTITY_LABELS = {
  semester: 'Term',
  course: 'Course',
  class: 'Class Section',
  enrollment: 'Enrollment',
  material: 'Course Material',
};

function EntityRecordModal({
  entityModal,
  entitySaving,
  form,
  onCancel,
  onSave,
}) {
  const isViewMode = entityModal.mode === 'view';
  const entityLabel = ENTITY_LABELS[entityModal.type] || 'Record';

  return (
    <Modal
      open={entityModal.open}
      title={`${isViewMode ? 'View' : 'Edit'} ${entityLabel}`}
      onCancel={onCancel}
      onOk={onSave}
      okText={isViewMode ? 'Close' : 'Save changes'}
      cancelButtonProps={{ style: isViewMode ? { display: 'none' } : undefined }}
      confirmLoading={entitySaving}
      destroyOnClose
    >
      <Form form={form} layout="vertical" disabled={isViewMode}>
        {entityModal.type === 'semester' && (
          <>
            <Form.Item name="semesterCode" label="Term Code">
              <Input disabled />
            </Form.Item>
            <Form.Item name="name" label="Term Name" rules={[{ required: !isViewMode, message: 'Enter a term name' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select>
                <Option value="ACTIVE">Active</Option>
                <Option value="INACTIVE">Inactive</Option>
                <Option value="COMPLETED">Completed</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {entityModal.type === 'course' && (
          <>
            <Form.Item name="courseId" label="Course ID">
              <Input disabled />
            </Form.Item>
            <Form.Item name="courseName" label="Course Name" rules={[{ required: !isViewMode, message: 'Enter a course name' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="credits" label="Credits">
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select>
                <Option value="ACTIVE">Active</Option>
                <Option value="INACTIVE">Inactive</Option>
                <Option value="ARCHIVED">Archived</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {entityModal.type === 'class' && (
          <>
            <Form.Item name="courseId" label="Course ID">
              <Input disabled />
            </Form.Item>
            <Form.Item name="classId" label="Class ID">
              <Input disabled />
            </Form.Item>
            <Form.Item name="teacherId" label="Mentor ID" rules={[{ required: !isViewMode, message: 'Enter mentor ID' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select>
                <Option value="ACTIVE">Active</Option>
                <Option value="INACTIVE">Inactive</Option>
                <Option value="COMPLETED">Completed</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {entityModal.type === 'enrollment' && (
          <>
            <Form.Item name="studentId" label="Student ID">
              <Input disabled />
            </Form.Item>
            <Form.Item name="courseId" label="Course ID">
              <Input disabled />
            </Form.Item>
            <Form.Item name="classId" label="Class ID">
              <Input disabled />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select>
                <Option value="ACTIVE">Active</Option>
                <Option value="INACTIVE">Inactive</Option>
                <Option value="COMPLETED">Completed</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {entityModal.type === 'material' && (
          <>
            <Form.Item label="Material ID">
              <Input value={getRecordId(entityModal.record)} disabled />
            </Form.Item>
            <Form.Item name="title" label="Title" rules={[{ required: !isViewMode, message: 'Enter material title' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="category" label="Category">
              <Input placeholder="Optional category" />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}

export default EntityRecordModal;
