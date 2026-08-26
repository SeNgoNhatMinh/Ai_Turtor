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
      title: 'Senior đã nạp ghi chú vào RAG',
      description: 'Sinh viên sẽ nhận câu trả lời như bản xem trước Teacher đã chấm. Giáo trình vẫn là chuẩn.',
    };
  }
  if (contribution.status === 'REJECTED') {
    return {
      type: 'error',
      title: 'Senior yêu cầu chỉnh lại cho khớp giáo trình',
      description: contribution.rejectionReason || contribution.reviewNote || 'Chỉnh câu hỏi/tóm tắt cho đúng sách rồi Thi lại (xem trước câu SV) trước khi gửi Senior.',
    };
  }
  if (contribution.status === 'PENDING_REVIEW') {
    return {
      type: 'info',
      title: 'Đã gửi Senior duyệt nạp',
      description: 'Senior chỉ xem bản xem trước và duyệt nạp RAG. AI chưa phục vụ SV bằng ghi chú này cho đến khi được nạp.',
    };
  }
  if (contribution.status === 'EXAMINED') {
    if (contribution.examError) {
      return {
        type: 'warning',
        title: 'Không chấm được bài thi tự động',
        description: 'Sửa tóm tắt theo sách rồi bấm Thi lại để xem trước câu trả lời SV. Chưa gửi Senior.',
      };
    }
    return {
      type: contribution.examPassed ? 'success' : 'warning',
      title: contribution.examPassed
        ? `Xem trước: AI phủ ${formatPercent(contribution.examScore)} ý giáo trình`
        : `Xem trước: AI chưa phủ đủ (${contribution.examScore == null ? '—' : formatPercent(contribution.examScore)})`,
      description: contribution.examPassed
        ? 'Đây là câu AI sẽ trả cho SV sau khi TRAINING được nạp (chưa index thật). Có thể Thi lại hoặc Gửi Senior duyệt nạp.'
        : 'Bản xem trước chưa đủ ý. Chỉnh tóm tắt theo sách rồi bấm Thi lại — Senior chỉ duyệt nạp khi bạn đã thấy câu đủ ý.',
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
            Thi lại · xem trước câu SV
          </ActionButton>
          <ActionButton
            intent="primary"
            icon={<Send size={16} />}
            loading={pendingAction === `send-gold-qa:${contribution.id}`}
            disabled={Boolean(pendingAction)}
            onClick={() => onSendForReview?.(contribution.id)}
          >
            Gửi Senior duyệt nạp
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
          <h2 id="contributions-heading">Soạn theo giáo trình</h2>
          <p>Thi lại = xem trước câu AI sẽ trả cho SV sau training. Senior chỉ duyệt nạp RAG khi bạn đã thấy câu đủ ý.</p>
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
          description="Màn Teacher chỉ xử lý task Q&A do Senior tạo từ mục lục giáo trình. Sách là chuẩn — không soạn đáp án thay sách."
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
        <Card className="expert-training__editor-card" title="Câu hỏi và tóm tắt theo giáo trình">
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
        Giáo trình là chuẩn duy nhất. Teacher dùng Lưu/Thi lại để xem trước câu SV (sách + tóm tắt, chưa index). Senior chỉ xem và duyệt nạp TRAINING vào RAG.
      </Paragraph>
    </section>
  );
}
