import { Form, Input, InputNumber, Modal, Select } from 'antd';
import { getPersonDisplayName, getPersonEmail, getPersonId } from '../../../utils/displayNames';

const { Option } = Select;

const ENTITY_LABELS = {
  semester: 'học kỳ',
  course: 'môn học',
  class: 'lớp học phần',
  enrollment: 'ghi danh',
  material: 'học liệu',
};

const getMentorId = (mentor) => getPersonId(mentor) || mentor.email;
const getMentorName = (mentor) => getPersonDisplayName(mentor, 'Giảng viên');
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
  const entityLabel = ENTITY_LABELS[entityModal.type] || 'bản ghi';
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
      title={`${isViewMode ? 'Xem' : 'Chỉnh sửa'} ${entityLabel}`}
      onCancel={onCancel}
      onOk={onSave}
      okText={isViewMode ? 'Đóng' : 'Lưu thay đổi'}
      cancelButtonProps={{ style: isViewMode ? { display: 'none' } : undefined }}
      confirmLoading={entitySaving}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" disabled={isViewMode}>
        {entityModal.type === 'semester' && (
          <>
            <Form.Item name="semesterCode" label="Mã học kỳ">
              <Input disabled />
            </Form.Item>
            <Form.Item name="name" label="Tên học kỳ" rules={[{ required: !isViewMode, message: 'Nhập tên học kỳ' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="status" label="Trạng thái">
              <Select>
                <Option value="ACTIVE">Đang hoạt động</Option>
                <Option value="INACTIVE">Ngừng hoạt động</Option>
                <Option value="COMPLETED">Đã hoàn tất</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {entityModal.type === 'course' && (
          <>
            <Form.Item name="courseId" label="Mã môn học">
              <Input disabled />
            </Form.Item>
            <Form.Item name="courseName" label="Tên môn học" rules={[{ required: !isViewMode, message: 'Nhập tên môn học' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="credits" label="Số tín chỉ">
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="status" label="Trạng thái">
              <Select>
                <Option value="ACTIVE">Đang hoạt động</Option>
                <Option value="INACTIVE">Ngừng hoạt động</Option>
                <Option value="ARCHIVED">Đã lưu trữ</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {entityModal.type === 'class' && (
          <>
            <Form.Item name="courseId" label="Mã môn học">
              <Input disabled />
            </Form.Item>
            <Form.Item name="classId" label="Mã lớp">
              <Input disabled />
            </Form.Item>
            <Form.Item name="teacherId" label="Giảng viên phụ trách" rules={[{ required: !isViewMode, message: 'Chọn giảng viên phụ trách lớp' }]}>
              <Select
                showSearch
                placeholder="Chọn giảng viên đang hoạt động"
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
            <Form.Item name="status" label="Trạng thái">
              <Select>
                <Option value="ACTIVE">Đang hoạt động</Option>
                <Option value="INACTIVE">Ngừng hoạt động</Option>
                <Option value="COMPLETED">Đã hoàn tất</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {entityModal.type === 'enrollment' && (
          <>
            <Form.Item label="Sinh viên">
              <Input value={getPersonDisplayName(entityModal.record, 'Sinh viên')} disabled />
            </Form.Item>
            {getPersonEmail(entityModal.record) && (
              <Form.Item label="Email">
                <Input value={getPersonEmail(entityModal.record)} disabled />
              </Form.Item>
            )}
            <Form.Item name="studentId" hidden>
              <Input />
            </Form.Item>
            <Form.Item name="courseId" label="Mã môn học">
              <Input disabled />
            </Form.Item>
            <Form.Item name="classId" label="Mã lớp">
              <Input disabled />
            </Form.Item>
            <Form.Item name="status" label="Trạng thái">
              <Select>
                <Option value="ACTIVE">Đang hoạt động</Option>
                <Option value="INACTIVE">Ngừng hoạt động</Option>
                <Option value="COMPLETED">Đã hoàn tất</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {entityModal.type === 'material' && (
          <>
            <Form.Item name="title" label="Tên học liệu" rules={[{ required: !isViewMode, message: 'Nhập tên học liệu' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="category" label="Danh mục">
              <Input placeholder="Không bắt buộc" />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}

export default EntityRecordModal;
