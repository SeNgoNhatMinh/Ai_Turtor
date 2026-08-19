import { useEffect } from 'react';
import { Alert, Card, Form, Typography } from 'antd';
import AppTabs from '../../../components/common/AppTabs';
import { getStatusLabel } from '../../../utils/statusLabels';
import {
  criteriaRowsToWeights,
  validateCriteriaWeights,
} from '../expertTrainingUtils';
import TaskMaterialContext from './TaskMaterialContext';
import { DEFAULT_RUBRIC_CRITERIA } from './contribution/contributionDefaults';
import GoldQaContributionForm from './contribution/GoldQaContributionForm';
import RubricContributionForm from './contribution/RubricContributionForm';

const { Paragraph } = Typography;

export default function ContributionWorkspace({
  selectedTask,
  userId,
  pendingAction,
  onSubmitGoldQa,
  onSubmitRubric,
  materialPreview,
  materialLoading,
  materialError,
  rejection,
  onOpenMaterial,
  onSubmitted,
}) {
  const [goldForm] = Form.useForm();
  const [rubricForm] = Form.useForm();

  useEffect(() => {
    if (!selectedTask) return;
    const nextType = selectedTask.type === 'RUBRIC' ? 'RUBRIC' : 'GOLD_QA';
    if (nextType === 'GOLD_QA') {
      goldForm.resetFields();
      goldForm.setFieldsValue({
        chapter: selectedTask.chapter,
        difficulty: rejection?.difficulty || 'MEDIUM',
        question: rejection?.question || '',
        goldAnswer: rejection?.goldAnswer || '',
      });
    } else {
      rubricForm.resetFields();
      rubricForm.setFieldsValue({
        chapter: selectedTask.chapter,
        name: rejection?.name || selectedTask.title,
        description: rejection?.description || selectedTask.instructions,
        criteria: rejection?.criteriaWeights
          ? Object.entries(rejection.criteriaWeights).map(([name, weight]) => ({ name, weight }))
          : DEFAULT_RUBRIC_CRITERIA.map((criterion) => ({ ...criterion })),
      });
    }
  }, [goldForm, rejection, rubricForm, selectedTask]);

  const isTaskOwner = Boolean(selectedTask && selectedTask.assigneeId === userId);
  const canSubmitSelectedTask = Boolean(
    isTaskOwner
    && ['ASSIGNED', 'IN_PROGRESS'].includes(selectedTask.status)
  );

  const submitGold = async (values) => {
    const result = await onSubmitGoldQa({
      ...values,
      usage: 'TRAINING',
      sourceTaskId: selectedTask?.type === 'GOLD_QA' ? selectedTask.id : undefined,
    });
    if (result) {
      onSubmitted?.(result);
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
      onSubmitted?.(result);
    }
  };

  const editorItems = [
    {
      key: 'GOLD_QA',
      label: 'Q&A vàng',
      children: (
        <GoldQaContributionForm
          form={goldForm}
          disabled={!canSubmitSelectedTask}
          pendingAction={pendingAction}
          userId={userId}
          onFinish={submitGold}
        />
      ),
    },
    {
      key: 'RUBRIC',
      label: 'Rubric',
      children: (
        <RubricContributionForm
          form={rubricForm}
          disabled={!canSubmitSelectedTask}
          pendingAction={pendingAction}
          userId={userId}
          onFinish={submitRubric}
        />
      ),
    },
  ];

  return (
    <section className="expert-training__section" aria-labelledby="contributions-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="contributions-heading">Viết Q&A vàng</h2>
          <p>Viết theo giáo trình trên màn hình. Hệ thống sẽ chấm AI rồi gửi Senior — chưa nạp RAG.</p>
        </div>
      </div>

      {selectedTask && (
        <Alert
          type={selectedTask.status === 'SUBMITTED' ? 'success' : 'info'}
          showIcon
          title={`Đang thực hiện: ${selectedTask.title}`}
          description={`${selectedTask.chapter} · ${getStatusLabel(selectedTask.status)}${selectedTask.instructions ? ` · ${selectedTask.instructions}` : ''}`}
        />
      )}

      {!isTaskOwner && (
        <Alert
          type="warning"
          showIcon
          title="Task này không thuộc về bạn"
          description="Chỉ giảng viên đã nhận task mới có thể soạn và gửi nội dung."
        />
      )}

      {isTaskOwner && !canSubmitSelectedTask && (
        <Alert
          type="info"
          showIcon
          title={selectedTask.status === 'SUBMITTED' ? 'Nội dung đã gửi kiểm duyệt' : 'Task hiện không thể chỉnh sửa'}
          description="Editor chỉ mở khi task ở trạng thái Đã giao hoặc Đang thực hiện."
        />
      )}

      {rejection && selectedTask.status === 'IN_PROGRESS' && (
        <Alert
          type="error"
          showIcon
          title="Nội dung cần được chỉnh sửa"
          description={rejection.rejectionReason || rejection.reviewNote || 'Senior Mentor chưa cung cấp ghi chú chi tiết.'}
        />
      )}

      <div className="expert-training__contribution-layout">
        <Card className="expert-training__editor-card" title="Chuẩn bị nội dung">
          <AppTabs
            activeKey={selectedTask.type === 'RUBRIC' ? 'RUBRIC' : 'GOLD_QA'}
            items={selectedTask
              ? editorItems.filter((item) => item.key === (selectedTask.type === 'RUBRIC' ? 'RUBRIC' : 'GOLD_QA'))
              : editorItems}
          />
        </Card>

        <aside className="expert-training__material-aside" aria-label="Tài liệu chương">
          <TaskMaterialContext
            preview={materialPreview}
            loading={materialLoading}
            error={materialError}
            onOpenMaterial={onOpenMaterial}
          />
        </aside>
      </div>

      <Paragraph type="secondary" className="expert-training__policy-note">
        Q&A đã nộp chưa vào RAG. Hệ thống chấm AI trên sách trước, Senior mới nạp câu đạt.
      </Paragraph>
    </section>
  );
}
