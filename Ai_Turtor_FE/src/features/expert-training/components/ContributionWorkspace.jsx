import { useEffect } from 'react';
import { Alert, Card, Form, Space, Tag, Typography } from 'antd';
import { getStatusLabel } from '../../../utils/statusLabels';
import { formatPercent } from '../expertTrainingUtils';
import TaskMaterialContext from './TaskMaterialContext';
import GoldQaContributionForm from './contribution/GoldQaContributionForm';

const { Paragraph } = Typography;

function contributionFeedback(contribution) {
  if (!contribution) return null;
  if (contribution.status === 'INDEXED') {
    return {
      type: 'success',
      title: 'Senior đã duyệt và nạp Q&A vào RAG',
      description: 'Q&A vàng hiện là nguồn COURSE_SHARED của môn và có thể được sinh viên truy xuất.',
    };
  }
  if (contribution.status === 'REJECTED') {
    return {
      type: 'error',
      title: 'Senior yêu cầu chỉnh sửa Q&A',
      description: contribution.rejectionReason || contribution.reviewNote || 'Hãy chỉnh lại nội dung theo giáo trình rồi nộp lại.',
    };
  }
  if (contribution.status === 'PENDING_REVIEW') {
    if (contribution.examError) {
      return {
        type: 'warning',
        title: 'Không chấm được bài thi tự động',
        description: 'Q&A vẫn đã được gửi sang Senior và chưa được nạp vào RAG.',
      };
    }
    return {
      type: contribution.examPassed ? 'success' : 'warning',
      title: contribution.examPassed
        ? `AI đạt ${formatPercent(contribution.examScore)} trên giáo trình`
        : `AI chưa đạt${contribution.examScore == null ? '' : ` · điểm ${formatPercent(contribution.examScore)}`}`,
      description: contribution.examPassed
        ? 'Đây chỉ là tín hiệu chấm thi. Senior vẫn là người quyết định có nạp Q&A vào RAG hay không.'
        : 'Senior sẽ đối chiếu đáp án của bạn với câu AI trả lời và có thể yêu cầu viết lại.',
    };
  }
  return null;
}

function ContributionResult({ contribution }) {
  const feedback = contributionFeedback(contribution);
  if (!feedback) return null;
  return (
    <div className="expert-training__teacher-exam-result">
      <Alert showIcon type={feedback.type} title={feedback.title} description={feedback.description} />
      {contribution.status === 'PENDING_REVIEW' && (
        <Space wrap size={[6, 6]}>
          <Tag>RAG confidence: {formatPercent(contribution.examRagConfidence)}</Tag>
          <Tag color={contribution.examHallucinated ? 'red' : 'green'}>
            {contribution.examHallucinated ? 'Có nguy cơ hallucination' : 'Không phát hiện hallucination'}
          </Tag>
        </Space>
      )}
      {contribution.examAiAnswer && (
        <div className="expert-training__teacher-exam-answer">
          <strong>AI trả lời từ giáo trình trước khi học Q&A này</strong>
          <Paragraph className="expert-training__preserve-text">{contribution.examAiAnswer}</Paragraph>
        </div>
      )}
    </div>
  );
}

export default function ContributionWorkspace({
  selectedTask,
  userId,
  pendingAction,
  onSubmitGoldQa,
  materialPreview,
  materialLoading,
  materialError,
  contribution,
  rejection,
  onOpenMaterial,
  onSubmitted,
}) {
  const [goldForm] = Form.useForm();

  useEffect(() => {
    if (!selectedTask) return;
    const saved = rejection || contribution;
    goldForm.resetFields();
    goldForm.setFieldsValue({
      chapter: selectedTask.chapter,
      difficulty: saved?.difficulty || 'MEDIUM',
      question: saved?.question || '',
      goldAnswer: saved?.goldAnswer || '',
    });
  }, [contribution, goldForm, rejection, selectedTask]);

  const isGoldQaTask = selectedTask?.type === 'GOLD_QA';
  const isTaskOwner = Boolean(selectedTask && selectedTask.assigneeId === userId);
  const canSubmitSelectedTask = Boolean(
    isGoldQaTask
    && isTaskOwner
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

  return (
    <section className="expert-training__section" aria-labelledby="contributions-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="contributions-heading">Viết Q&A vàng</h2>
          <p>Một task tương ứng một câu hỏi vàng và một đáp án chuẩn trong đúng chương Senior đã chọn.</p>
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

      {!isGoldQaTask && (
        <Alert
          type="error"
          showIcon
          title="Task không thuộc flow GOLD_QA hiện tại"
          description="Màn Teacher chỉ xử lý Q&A vàng được Senior tạo từ mục lục giáo trình."
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

      <div className="expert-training__contribution-layout">
        <Card className="expert-training__editor-card" title="Câu hỏi và đáp án chuẩn">
          <ContributionResult contribution={contribution} />
          <GoldQaContributionForm
            form={goldForm}
            disabled={!canSubmitSelectedTask}
            pendingAction={pendingAction}
            userId={userId}
            onFinish={submitGold}
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
        Teacher chỉ nộp bài. AI được chấm trên giáo trình cũ trước; chỉ Senior mới có quyền nạp GOLD_QA vào RAG.
      </Paragraph>
    </section>
  );
}
