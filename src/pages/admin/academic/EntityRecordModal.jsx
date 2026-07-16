import { Form, Input, InputNumber, Modal, Select } from 'antd';
import { getPersonDisplayName, getPersonEmail, getPersonId } from '../../../utils/displayNames';

const { Option } = Select;

const ENTITY_LABELS = {
  semester: 'Term',
  course: 'Course',
  class: 'Class Section',
  enrollment: 'Enrollment',
  material: 'Course Material',
};

const getMentorId = (mentor) => getPersonId(mentor) || mentor.email;
const getMentorName = (mentor) => getPersonDisplayName(mentor, 'Mentor');
const getMentorEmail = (mentor) => getPersonEmail(mentor);
const getMentorMeta = (mentor) => [
  getMentorEmail(mentor),
  Array.isArray(mentor.specializations) ? mentor.specializations.join(', ') : mentor.specialization,
  mentor.status || mentor.availability,
].filter(Boolean).join(' | ');

function EntityRecordModal({
  entityModal,
  entitySaving,
  form,
  mentors = [],
  onCancel,
  onSave,
}) {
  const isViewMode = entityModal.mode === 'view';
  const entityLabel = ENTITY_LABELS[entityModal.type] || 'Record';
  const handleMentorChange = (mentorId) => {
    const mentor = mentors.find((item) => getMentorId(item) === mentorId);
    form.setFieldsValue({
      teacherId: mentorId,
      teacherName: mentor ? getMentorName(mentor) : '',
      teacherEmail: mentor ? getMentorEmail(mentor) : '',
    });
  };

  return (
    <Modal
      open={entityModal.open}
      title={`${isViewMode ? 'View' : 'Edit'} ${entityLabel}`}
      onCancel={onCancel}
      onOk={onSave}
      okText={isViewMode ? 'Close' : 'Save changes'}
      cancelButtonProps={{ style: isViewMode ? { display: 'none' } : undefined }}
      confirmLoading={entitySaving}
      destroyOnHidden
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
            <Form.Item name="courseId" label="Course Code">
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
            <Form.Item name="courseId" label="Course Code">
              <Input disabled />
            </Form.Item>
            <Form.Item name="classId" label="Class Code">
              <Input disabled />
            </Form.Item>
            <Form.Item name="teacherId" label="Class Teacher / Mentor" rules={[{ required: !isViewMode, message: 'Choose the class teacher or mentor' }]}>
              <Select
                showSearch
                placeholder="Choose active mentor"
                optionFilterProp="searchLabel"
                onChange={handleMentorChange}
                options={mentors.map((mentor) => {
                  const id = getMentorId(mentor);
                  const name = getMentorName(mentor);
                  const meta = getMentorMeta(mentor);
                  return {
                    value: id,
                    searchLabel: `${name} ${id} ${meta}`,
                    disabled: !id || mentor.isActive === false,
                    label: (
                      <div className="admin-mentor-select-option">
                        <strong>{name}</strong>
                        {meta && <span>{meta}</span>}
                      </div>
                    ),
                  };
                })}
              />
            </Form.Item>
            <Form.Item name="teacherName" hidden><Input /></Form.Item>
            <Form.Item name="teacherEmail" hidden><Input /></Form.Item>
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
            <Form.Item label="Student">
              <Input value={getPersonDisplayName(entityModal.record, 'Student')} disabled />
            </Form.Item>
            {getPersonEmail(entityModal.record) && (
              <Form.Item label="Email">
                <Input value={getPersonEmail(entityModal.record)} disabled />
              </Form.Item>
            )}
            <Form.Item name="studentId" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="courseId" label="Course Code">
              <Input disabled />
            </Form.Item>
            <Form.Item name="classId" label="Class Code">
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
