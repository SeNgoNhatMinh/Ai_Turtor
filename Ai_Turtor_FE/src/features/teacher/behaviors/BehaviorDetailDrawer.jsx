import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Drawer, Empty, Form, Input, List, Select, Space, Tag } from 'antd';
import { getUserFacingError } from '../../../services/apiClient';
import { teachingBehaviorApi } from '../../../services/teachingBehaviorApi';

const STATUS_LABEL = {
  APPLIED: 'Đã dùng trong câu trả lời',
  SKIPPED: 'Có gán nhưng không chọn',
  FAILED: 'Lỗi khi chọn',
  CACHE_HIT: 'Trả lời từ bộ nhớ đệm',
};

function itemsOf(data) {
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.items) ? data.items : [];
}

export default function BehaviorDetailDrawer({ behavior, courseOptions, onClose, triggerToast }) {
  const queryClient = useQueryClient();
  const open = Boolean(behavior);
  const id = behavior?.id;
  const [question, setQuestion] = useState('');
  const [preview, setPreview] = useState(null);
  const [testing, setTesting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [form] = Form.useForm();

  const assignmentsQuery = useQuery({
    queryKey: ['teacher', 'teaching-behavior-assignments', id],
    queryFn: ({ signal }) => teachingBehaviorApi.assignments(id, { signal }),
    enabled: open,
  });
  const executionsQuery = useQuery({
    queryKey: ['teacher', 'teaching-behavior-executions', id],
    queryFn: ({ signal }) => teachingBehaviorApi.behaviorExecutions(id, { signal }),
    enabled: open,
  });
  const versionsQuery = useQuery({
    queryKey: ['teacher', 'teaching-behavior-versions', id],
    queryFn: ({ signal }) => teachingBehaviorApi.versions(id, { signal }),
    enabled: open,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['teacher', 'teaching-behavior-assignments', id] });
    queryClient.invalidateQueries({ queryKey: ['teacher', 'teaching-behavior-executions', id] });
    queryClient.invalidateQueries({ queryKey: ['teacher', 'teaching-behaviors'] });
  };

  const assign = async () => {
    try {
      const values = await form.validateFields();
      setAssigning(true);
      await teachingBehaviorApi.assign(id, {
        courseId: values.courseId,
        studentId: values.studentId || null,
        customizedInstructions: values.customizedInstructions || null,
      });
      triggerToast?.('Đã gán hành vi. Câu trả lời sau mới dùng khi hành vi đang được duyệt.');
      form.resetFields();
      refresh();
    } catch (error) {
      if (error?.errorFields) return;
      triggerToast?.(getUserFacingError(error, 'Không gán được hành vi.'));
    } finally {
      setAssigning(false);
    }
  };

  const toggleAssignment = async (assignment) => {
    const next = assignment.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await teachingBehaviorApi.setAssignmentStatus(assignment.id, next);
      triggerToast?.(next === 'ACTIVE' ? 'Đã bật lần gán.' : 'Đã tắt lần gán. Câu sau sẽ không chọn hành vi này.');
      refresh();
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không đổi được lần gán.'));
    }
  };

  const rollback = async (version) => {
    try {
      await teachingBehaviorApi.rollback(id, version);
      triggerToast?.(`Đã khôi phục phiên bản ${version}. Lịch sử câu trả lời cũ vẫn giữ nguyên.`);
      queryClient.invalidateQueries({ queryKey: ['teacher', 'teaching-behavior-versions', id] });
      queryClient.invalidateQueries({ queryKey: ['teacher', 'teaching-behaviors'] });
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không khôi phục được phiên bản.'));
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      setPreview(await teachingBehaviorApi.testBehavior(id, { question }));
    } catch (error) {
      triggerToast?.(getUserFacingError(error, 'Không thử được hành vi.'));
    } finally {
      setTesting(false);
    }
  };

  const assignments = itemsOf(assignmentsQuery.data);
  const executions = itemsOf(executionsQuery.data);
  const versions = itemsOf(versionsQuery.data);

  return (
    <Drawer
      title={behavior?.name || behavior?.strategy || 'Chi tiết hành vi'}
      open={open}
      width={560}
      onClose={onClose}
      destroyOnHidden
    >
      {behavior && (
        <div className="teaching-behavior-detail">
          <p>{behavior.instruction}</p>
          <Space wrap>
            {behavior.strategy && <Tag color="blue">{behavior.strategy}</Tag>}
            <Tag>Phiên bản {behavior.version || 1}</Tag>
            <Tag>{behavior.approvalStatus === 'PENDING' ? 'Chưa duyệt' : 'Đã duyệt'}</Tag>
          </Space>
          <Alert
            type="info"
            showIcon
            message="Có gán chưa có nghĩa là đã dùng"
            description="Một lần gán đang bật chỉ vào câu trả lời khi RAG chọn đúng hành vi đó. Mục lịch sử bên dưới ghi Đã dùng, Có gán nhưng không chọn, hoặc Lỗi."
          />

          <h4>Gán cho môn hoặc sinh viên</h4>
          <Form form={form} layout="vertical">
            <Form.Item name="courseId" label="Môn" rules={[{ required: true, message: 'Chọn môn' }]}>
              <Select options={courseOptions} placeholder="Chọn môn" />
            </Form.Item>
            <Form.Item name="studentId" label="Mã sinh viên" extra="Để trống nếu muốn gán cho cả môn.">
              <Input placeholder="Để trống = cả môn" />
            </Form.Item>
            <Form.Item name="customizedInstructions" label="Chỉ dẫn riêng cho lần gán này">
              <Input.TextArea rows={2} maxLength={500} placeholder="Không ghi đè mẫu dùng chung" />
            </Form.Item>
            <Button type="primary" onClick={assign} loading={assigning} disabled={behavior.status !== 'APPROVED'}>
              Gán
            </Button>
          </Form>
          {assignments.length === 0 ? <Empty description="Chưa gán cho ai." /> : (
            <List
              dataSource={assignments}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button key="toggle" size="small" onClick={() => toggleAssignment(item)}>
                      {item.status === 'ACTIVE' ? 'Tắt' : 'Bật'}
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={`${item.courseId}${item.studentId ? ` · ${item.studentId}` : ' · cả môn'}`}
                    description={item.customizedInstructions || 'Dùng đúng chỉ dẫn của mẫu'}
                  />
                  <Tag>{item.status === 'ACTIVE' ? 'Đang gán' : 'Đã tắt'}</Tag>
                </List.Item>
              )}
            />
          )}

          <h4>Lịch sử dùng thật</h4>
          {executions.length === 0 ? <Empty description="Chưa có lần nào được chọn hoặc bị bỏ qua." /> : (
            <List
              dataSource={executions}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={STATUS_LABEL[item.executionStatus] || item.executionStatus}
                    description={`${item.studentId || '—'} · ${item.courseId || '—'} · ${item.selectionReason || ''}`}
                  />
                </List.Item>
              )}
            />
          )}

          <h4>Phiên bản</h4>
          {versions.length === 0 ? <Empty description="Chưa có phiên bản cũ. Lần sửa tiếp theo sẽ lưu lại bản hiện tại." /> : (
            <List
              dataSource={versions}
              renderItem={(item) => (
                <List.Item actions={[<Button key="back" size="small" onClick={() => rollback(item.version)}>Khôi phục</Button>]}>
                  <List.Item.Meta title={`Phiên bản ${item.version}`} description={item.instruction} />
                </List.Item>
              )}
            />
          )}

          <h4>Thử trước khi bật</h4>
          <Input.TextArea rows={2} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Câu hỏi mẫu của sinh viên" />
          <Button onClick={test} loading={testing}>Xem đoạn sẽ đưa vào câu trả lời</Button>
          {preview && (
            <Alert
              type={preview.wouldApply ? 'success' : 'warning'}
              showIcon
              message={preview.note}
              description={preview.promptPreview}
            />
          )}
        </div>
      )}
    </Drawer>
  );
}
