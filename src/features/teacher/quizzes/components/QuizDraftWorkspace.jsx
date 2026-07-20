import { Button, Space, Tooltip } from 'antd';
import QuizDraftEditor from '../../../../pages/teacher/QuizDraftEditor';
import { isQuizDraft } from '../quizAssignmentUtils';

export default function QuizDraftWorkspace({
  draft,
  editorRef,
  editorState,
  saving,
  onSave,
  onStateChange,
  onPublish,
  onDelete,
}) {
  if (!draft) return null;
  const editable = isQuizDraft(draft);

  return (
    <Space ref={editorRef} orientation="vertical" size={12} style={{ width: '100%', scrollMarginTop: 24 }}>
      <QuizDraftEditor
        draft={draft}
        onSave={onSave}
        onStateChange={onStateChange}
        saving={saving}
        readOnly={!editable}
      />
      {editable && (
        <Space>
          <Tooltip title={editorState.dirty ? 'Lưu thay đổi trước khi xuất bản' : !editorState.valid ? 'Sửa lỗi trong draft trước' : ''}>
            <span>
              <Button
                type="primary"
                disabled={editorState.dirty || !editorState.valid}
                onClick={() => onPublish(draft)}
              >
                Xuất bản draft
              </Button>
            </span>
          </Tooltip>
          <Button danger onClick={() => onDelete(draft)}>Xóa draft</Button>
        </Space>
      )}
    </Space>
  );
}
