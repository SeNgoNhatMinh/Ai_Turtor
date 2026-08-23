import { useEffect, useRef } from 'react';
import { Alert, Card, Form, Space, Typography } from 'antd';
import { RefreshCw, Send } from 'lucide-react';
import ActionButton from '../../../components/common/ActionButton';
import { getStatusLabel } from '../../../utils/statusLabels';
import { formatPercent } from '../expertTrainingUtils';
import TaskMaterialContext from './TaskMaterialContext';
import GoldQaContributionForm from './contribution/GoldQaContributionForm';
import GoldQaExamCompare from './contribution/GoldQaExamCompare';

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
      description: contribution.rejectionReason || contribution.reviewNote || 'Hãy chỉnh lại nội dung theo giáo trình rồi chấm lại trước khi gửi Senior.',
    };
  }
  if (contribution.status === 'PENDING_REVIEW') {
    return {
      type: 'info',
      title: 'Đã gửi Senior duyệt',
      description: 'Bài thi đang chờ Senior quyết định có nạp Q&A vào RAG hay không. AI chưa học nội dung này.',
    };
  }
  if (contribution.status === 'EXAMINED') {
    if (contribution.examError) {
      return {
        type: 'warning',
        title: 'Không chấm được bài thi tự động',
        description: 'Bạn có thể sửa đáp án rồi bấm Thi lại. Chưa gửi Senior.',
      };
    }
    return {
      type: contribution.examPassed ? 'success' : 'warning',
      title: contribution.examPassed
        ? `AI đạt ${formatPercent(contribution.examScore)} trên giáo trình`
        : `AI chưa đạt${contribution.examScore == null ? '' : ` · điểm ${formatPercent(contribution.examScore)}`}`,
      description: contribution.examPassed
        ? 'Đây chỉ là tín hiệu trước khi AI học Q&A. Bạn có thể Thi lại hoặc Gửi Senior duyệt.'
        : 'AI trả lời từ sách chưa khớp đáp án chuẩn. Sửa Q&A rồi Thi lại trước khi gửi Senior.',
    };
  }
  return null;
}

function ContributionResult({
  contribution,
  canTeacherGate,
  pendingAction,
  onExamGoldQa,
  onSendForReview,
}) {
  const feedback = contributionFeedback(contribution);
  if (!feedback) return null;
  return (
    <div className="expert-training__teacher-exam-result">
      <Alert showIcon type={feedback.type} title={feedback.title} description={feedback.description} />
      <GoldQaExamCompare contribution={contribution} />
      {canTeacherGate && contribution.status === 'EXAMINED' && (
        <Space wrap className="expert-training__form-actions">
          <ActionButton
            icon={<RefreshCw size={16} />}
            loading={pendingAction === `exam-gold-qa:${contribution.id}`}
            disabled={Boolean(pendingAction)}
            onClick={() => onExamGoldQa?.(contribution.id)}
          >
            Thi lại
          </ActionButton>
          <ActionButton
            intent="primary"
            icon={<Send size={16} />}
            loading={pendingAction === `send-gold-qa:${contribution.id}`}
            disabled={Boolean(pendingAction)}
            onClick={() => onSendForReview?.(contribution.id)}
          >
            Gửi Senior duyệt
          </ActionButton>
        </Space>
      )}
    </div>
  );
}

export default function ContributionWorkspace({
  selectedTask,
  userId,
  pendingAction,
  onSubmitGoldQa,
  onExamGoldQa,
  onSendForReview,
  materialPreview,
  materialLoading,
  materialError,
  contribution,
  rejection,
  onOpenMaterial,
  onSubmitted,
  onSentToSenior,
}) {
  const [goldForm] = Form.useForm();
  const hydrateKeyRef = useRef('');

  useEffect(() => {
    if (!selectedTask?.id) {
      hydrateKeyRef.current = '';
      return;
    }

    const saved = rejection || contribution;
    const hydrateKey = `${selectedTask.id}:${saved?.id || 'draft'}:${saved?.updatedAt || ''}`;
    goldForm.setFieldsValue({ chapter: selectedTask.chapter });

    if (hydrateKeyRef.current === hydrateKey) return;

    const switchingTask = !hydrateKeyRef.current.startsWith(`${selectedTask.id}:`);
    const question = String(goldForm.getFieldValue('question') || '').trim();
    const goldAnswer = String(goldForm.getFieldValue('goldAnswer') || '').trim();
    const hasLocalDraft = Boolean(question || goldAnswer);

    if (switchingTask || !hasLocalDraft) {
      goldForm.setFieldsValue({
        difficulty: saved?.difficulty || 'MEDIUM',
        question: saved?.question || '',
        goldAnswer: saved?.goldAnswer || '',
      });
    }

    hydrateKeyRef.current = hydrateKey;
  }, [contribution, goldForm, rejection, selectedTask]);

  const isGoldQaTask = selectedTask?.type === 'GOLD_QA';
  const isTaskOwner = Boolean(selectedTask && selectedTask.assigneeId === userId);
  const canSubmitSelectedTask = Boolean(
    isGoldQaTask
    && isTaskOwner
    && ['ASSIGNED', 'IN_PROGRESS'].includes(selectedTask.status)
  );
  const canTeacherGate = Boolean(isTaskOwner && canSubmitSelectedTask);

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

  const sendToSenior = async (goldQaId) => {
    const result = await onSendForReview?.(goldQaId);
    if (result) {
      onSentToSenior?.(result);
    }
  };

  return (
    <section className="expert-training__section" aria-labelledby="contributions-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="contributions-heading">Viết Q&A vàng</h2>
          <p>Chấm AI trên giáo trình trước. Chỉ khi bạn bấm Gửi Senior duyệt thì bài mới vào hàng chờ nạp RAG.</p>
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
          <ContributionResult
            contribution={contribution}
            canTeacherGate={canTeacherGate}
            pendingAction={pendingAction}
            onExamGoldQa={onExamGoldQa}
            onSendForReview={sendToSenior}
          />
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
        AI chỉ nhớ Gold Q&A sau khi Senior nạp vào RAG. Lần chấm trước đó chỉ so sánh AI (sách cũ) với đáp án Teacher.
      </Paragraph>
    </section>
  );
}
