import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Card, Form, Tag, Typography } from 'antd';
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import ActionButton from '../../../components/common/ActionButton';
import { confirmDanger } from '../../../components/common/confirmDialog';
import { getStatusLabel } from '../../../utils/statusLabels';
import { formatTeacherGoldAnswer } from '../../../utils/teacherGoldAnswerFormat';
import { formatPercent } from '../expertTrainingUtils';
import TaskMaterialContext from './TaskMaterialContext';
import GoldQaContributionForm from './contribution/GoldQaContributionForm';
import GoldQaExamCompare from './contribution/GoldQaExamCompare';

const { Paragraph } = Typography;

function statusTone(status) {
  if (status === 'INDEXED' || status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'error';
  if (status === 'PENDING_REVIEW') return 'processing';
  if (status === 'BASELINE_EXAMINED') return 'warning';
  if (status === 'EXAMINED') return 'success';
  return 'default';
}

function summaryPreview(text) {
  const formatted = formatTeacherGoldAnswer(text) || String(text || '').trim();
  const lines = formatted.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.slice(0, 3);
}

function examButtonLabel(status) {
  if (status === 'DRAFT' || status === 'REJECTED') return 'Cho AI đánh giá';
  if (status === 'BASELINE_EXAMINED') return 'Cho AI đánh giá lại (gộp ý GV)';
  return 'Cho AI đánh giá lại';
}

function QaListRow({
  item,
  index,
  expanded,
  canTeacherGate,
  pendingAction,
  onToggle,
  onEdit,
  onExam,
  onSend,
  onDelete,
}) {
  const examining = pendingAction === `exam-gold-qa:${item.id}`;
  const sending = pendingAction === `send-gold-qa:${item.id}`;
  const deleting = pendingAction === `delete-gold-qa:${item.id}`;
  const editable = ['DRAFT', 'BASELINE_EXAMINED', 'EXAMINED', 'REJECTED'].includes(item.status);
  const examable = ['DRAFT', 'BASELINE_EXAMINED', 'REJECTED'].includes(item.status);
  const sendable = item.status === 'EXAMINED' && Boolean(item.examUsedTeachingNote);
  const deletable = ['DRAFT', 'BASELINE_EXAMINED', 'EXAMINED', 'REJECTED'].includes(item.status);
  const bullets = summaryPreview(item.goldAnswer);

  return (
    <article className={`expert-qa-card${expanded ? ' is-expanded' : ''}`}>
      <header className="expert-qa-card__head">
        <button type="button" className="expert-qa-card__toggle" onClick={() => onToggle(item.id)}>
          <span className="expert-qa-card__index">#{index + 1}</span>
          <span className="expert-qa-card__title">{item.question || 'Chưa có câu hỏi'}</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <div className="expert-qa-card__meta">
          <Tag color={statusTone(item.status)}>{getStatusLabel(item.status)}</Tag>
          {item.examScore != null && (
            <Tag color={item.examPassed ? 'success' : 'warning'}>
              {item.examUsedTeachingNote ? 'Sau' : 'Trước'} · AI phủ {formatPercent(item.examScore)}
            </Tag>
          )}
        </div>
      </header>

      <div className="expert-qa-card__summary">
        {bullets.length ? bullets.map((line) => (
          <span key={line}>{line.replace(/^[-*•]\s*/, '')}</span>
        )) : <span>Chưa có tóm tắt ý</span>}
      </div>

      {canTeacherGate && (
        <div className="expert-qa-card__actions">
          {editable && (
            <ActionButton
              icon={<Pencil size={15} />}
              disabled={Boolean(pendingAction)}
              onClick={() => onEdit(item)}
            >
              Sửa
            </ActionButton>
          )}
          {examable && (
            <ActionButton
              intent={item.status === 'DRAFT' || item.status === 'BASELINE_EXAMINED' || item.status === 'REJECTED' ? 'primary' : 'default'}
              icon={item.status === 'BASELINE_EXAMINED' ? <RefreshCw size={15} /> : <Sparkles size={15} />}
              loading={examining}
              disabled={Boolean(pendingAction)}
              onClick={() => onExam(item.id)}
            >
              {examButtonLabel(item.status)}
            </ActionButton>
          )}
          {sendable && (
            <ActionButton
              intent="primary"
              icon={<Send size={15} />}
              loading={sending}
              disabled={Boolean(pendingAction)}
              onClick={() => onSend(item.id)}
            >
              Gửi Senior
            </ActionButton>
          )}
          {deletable && (
            <ActionButton
              intent="danger"
              icon={<Trash2 size={15} />}
              loading={deleting}
              disabled={Boolean(pendingAction)}
              onClick={() => onDelete(item)}
            >
              Xóa
            </ActionButton>
          )}
        </div>
      )}

      {expanded && (item.examAiAnswer || item.examError || item.examBaselineAiAnswer) && (
        <div className="expert-qa-card__exam">
          <GoldQaExamCompare contribution={item} />
        </div>
      )}
      {expanded && item.status === 'DRAFT' && !item.examAiAnswer && (
        <Alert
          type="info"
          showIcon
          title="Chưa cho AI đánh giá"
          description="Tối đa 2 lượt: (1) Cho AI đánh giá — chưa gắn ý GV. (2) Đánh giá lại — gộp lần 1 + ý GV thành câu đầy đủ hơn."
        />
      )}
      {expanded && item.status === 'BASELINE_EXAMINED' && (
        <Alert
          type="warning"
          showIcon
          title="Còn 1 lượt đánh giá lại"
          description="Đánh giá lại sẽ gộp câu lần 1 với ý chính của bạn. Sau đó chỉ còn Gửi Senior (không đánh giá lần 3)."
        />
      )}
      {expanded && item.status === 'EXAMINED' && (
        <Alert
          type="success"
          showIcon
          title="Đã hết 2 lượt đánh giá"
          description="Gửi Senior duyệt. Nếu Senior từ chối, hệ thống reset lượt đánh giá để bạn hiệu chỉnh và đánh giá lại tốt hơn."
        />
      )}
      {expanded && item.status === 'REJECTED' && (
        <Alert
          type="error"
          showIcon
          title="Senior đã trả về — lượt đánh giá đã reset"
          description="Sửa ý chính nếu cần, rồi Cho AI đánh giá (lần 1) và đánh giá lại (lần 2) trước khi gửi lại Senior."
        />
      )}
    </article>
  );
}

export default function ContributionWorkspace({
  selectedTask,
  userId,
  pendingAction,
  onSubmitGoldQa,
  onExamGoldQa,
  onExamAllDrafts,
  onSendForReview,
  onDeleteGoldQa,
  materialPreview,
  materialLoading,
  materialError,
  contributions = [],
  contribution,
  onOpenMaterial,
}) {
  const [goldForm] = Form.useForm();
  const hydrateKeyRef = useRef('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const items = useMemo(() => {
    if (Array.isArray(contributions) && contributions.length) return contributions;
    if (contribution) return [contribution];
    return [];
  }, [contribution, contributions]);

  const draftIds = useMemo(
    () => items.filter((item) => item.status === 'DRAFT').map((item) => item.id).filter(Boolean),
    [items],
  );
  const baselineCount = items.filter((item) => item.status === 'BASELINE_EXAMINED').length;
  const examinedCount = items.filter((item) => item.status === 'EXAMINED').length;
  const editingItem = editingId ? items.find((item) => item.id === editingId) : null;

  useEffect(() => {
    if (!selectedTask?.id) {
      setComposerOpen(false);
      setEditingId(null);
      setExpandedId(null);
      return;
    }
    if (!items.length) {
      setComposerOpen(true);
      setEditingId(null);
    }
  }, [items.length, selectedTask?.id]);

  useEffect(() => {
    if (!composerOpen || !selectedTask?.id) return;
    const key = `${selectedTask.id}:${editingId || 'new'}:${editingItem?.updatedAt || ''}`;
    if (hydrateKeyRef.current === key) return;
    goldForm.setFieldsValue({
      chapter: selectedTask.chapter,
      difficulty: editingItem?.difficulty || 'MEDIUM',
      question: editingItem?.question || '',
      goldAnswer: editingItem?.goldAnswer || '',
    });
    hydrateKeyRef.current = key;
  }, [composerOpen, editingId, editingItem, goldForm, selectedTask]);

  const isGoldQaTask = selectedTask?.type === 'GOLD_QA';
  const isTaskOwner = Boolean(selectedTask && selectedTask.assigneeId === userId);
  const canSubmitSelectedTask = Boolean(
    isGoldQaTask
    && isTaskOwner
    && ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED'].includes(selectedTask.status)
  );

  const openNewComposer = () => {
    hydrateKeyRef.current = '';
    setEditingId(null);
    setComposerOpen(true);
    goldForm.setFieldsValue({
      chapter: selectedTask?.chapter,
      difficulty: 'MEDIUM',
      question: '',
      goldAnswer: '',
    });
  };

  const openEditComposer = (item) => {
    hydrateKeyRef.current = '';
    setEditingId(item.id);
    setComposerOpen(true);
    setExpandedId(item.id);
  };

  const closeComposer = () => {
    setComposerOpen(false);
    setEditingId(null);
    hydrateKeyRef.current = '';
  };

  const goldPayload = (values) => ({
    ...values,
    usage: 'TRAINING',
    sourceTaskId: selectedTask?.type === 'GOLD_QA' ? selectedTask.id : undefined,
    goldQaId: editingId || undefined,
  });

  const saveToList = async (values) => {
    const result = await onSubmitGoldQa(goldPayload(values), { exam: false });
    if (result) {
      closeComposer();
      setExpandedId(result.id || null);
    }
  };

  const saveAndExam = async (values) => {
    if (editingItem?.status === 'EXAMINED') {
      await saveToList(values);
      return;
    }
    const result = await onSubmitGoldQa(goldPayload(values), { exam: false });
    if (!result?.id) return;
    closeComposer();
    setExpandedId(result.id);
    await onExamGoldQa?.(result.id);
  };

  const sendToSenior = async (goldQaId) => {
    await onSendForReview?.(goldQaId);
  };

  const deleteFromList = (item) => {
    confirmDanger({
      title: 'Xóa câu hỏi này?',
      content: 'Câu hỏi sẽ bị xóa khỏi danh sách. Không thể hoàn tác.',
      okText: 'Xóa',
      cancelText: 'Giữ lại',
      onOk: async () => {
        const ok = await onDeleteGoldQa?.(item.id);
        if (ok && editingId === item.id) closeComposer();
        if (ok && expandedId === item.id) setExpandedId(null);
      },
    });
  };

  return (
    <section className="expert-training__section" aria-labelledby="contributions-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="contributions-heading">Danh sách câu hỏi theo giáo trình</h2>
          <p>
            Soạn Q + ý chính → Lưu list → Cho AI đánh giá (lần 1) → Đánh giá lại gộp ý GV (lần 2) → Gửi Senior.
          </p>
        </div>
      </div>

      {selectedTask && (
        <Alert
          type="info"
          showIcon
          title={`${selectedTask.title} · ${selectedTask.chapter}`}
          description={`${getStatusLabel(selectedTask.status)} · ${items.length} câu · ${draftIds.length} nháp · ${baselineCount} đã đánh giá lần 1 · ${examinedCount} đã đánh giá lại`}
        />
      )}

      {!isGoldQaTask && (
        <Alert type="error" showIcon title="Task không thuộc flow GOLD_QA" description="Chỉ soạn Q&A từ task Senior tạo theo mục lục." />
      )}
      {!isTaskOwner && (
        <Alert type="warning" showIcon title="Task này không thuộc về bạn" description="Chỉ giảng viên đã nhận task mới soạn được." />
      )}

      {canSubmitSelectedTask && (
        <div className="expert-qa-toolbar">
          <ActionButton
            intent="primary"
            icon={<Plus size={16} />}
            disabled={Boolean(pendingAction) || composerOpen}
            onClick={openNewComposer}
          >
            Thêm câu hỏi
          </ActionButton>
          {draftIds.length > 0 && (
            <ActionButton
              icon={<Sparkles size={16} />}
              loading={String(pendingAction || '').startsWith('exam-gold-qa:')}
              disabled={Boolean(pendingAction)}
              onClick={() => onExamAllDrafts?.(draftIds)}
            >
              {`Cho AI đánh giá ${draftIds.length} câu nháp`}
            </ActionButton>
          )}
        </div>
      )}

      <div className="expert-training__contribution-layout">
        <div className="expert-training__editor-stack">
          {composerOpen && canSubmitSelectedTask && (
            <Card
              className="expert-training__editor-card"
              title={editingId ? `Sửa câu hỏi #${items.findIndex((item) => item.id === editingId) + 1}` : `Thêm câu hỏi #${items.length + 1}`}
            >
              <GoldQaContributionForm
                form={goldForm}
                disabled={false}
                pendingAction={pendingAction}
                userId={userId}
                onFinish={saveToList}
                onExam={saveAndExam}
                onCancel={closeComposer}
                showCancel={items.length > 0}
                submitLabel={editingId ? 'Cập nhật danh sách' : 'Lưu vào danh sách'}
                examLabel={examButtonLabel(editingItem?.status || 'DRAFT')}
                showExam={editingItem?.status !== 'EXAMINED'}
              />
            </Card>
          )}

          {!items.length && !composerOpen && (
            <Alert
              type="info"
              showIcon
              title="Chưa có câu hỏi trong danh sách"
              description="Bấm Thêm câu hỏi để bắt đầu soạn."
            />
          )}

          <div className="expert-qa-list" aria-label="Danh sách câu hỏi">
            {items.map((item, index) => (
              <QaListRow
                key={item.id || `qa-${index}`}
                item={item}
                index={index}
                expanded={expandedId === item.id}
                canTeacherGate={canSubmitSelectedTask}
                pendingAction={pendingAction}
                onToggle={(id) => setExpandedId((current) => (current === id ? null : id))}
                onEdit={openEditComposer}
                onExam={onExamGoldQa}
                onSend={sendToSenior}
                onDelete={deleteFromList}
              />
            ))}
          </div>
        </div>

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
        Giáo trình là chuẩn. Lần 1 AI trả lời chưa gắn ý GV; lần 2 gắn ý chính để thấy cải thiện. Senior chỉ duyệt nạp RAG.
      </Paragraph>
    </section>
  );
}
